import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { transcribeHandler } from './transcribe.job';
import { summarizeHandler } from './summarize.job';
import { webhookHandler } from './webhook.job';
import { retentionHandler } from './retention.job';

export interface JobData {
    [key: string]: any;
}

export interface JobContext {
    redis: Redis;
    prisma: any; // PrismaClient type would be imported
}

export async function setupQueue(redis: Redis): Promise<{
    transcribeQueue: Queue;
    summarizeQueue: Queue;
    webhookQueue: Queue;
    retentionQueue: Queue;
    close: () => Promise<void>;
}> {
    // Create queues
    const transcribeQueue = new Queue('transcribe', { connection: redis });
    const summarizeQueue = new Queue('summarize', { connection: redis });
    const webhookQueue = new Queue('webhook', { connection: redis });
    const retentionQueue = new Queue('retention', { connection: redis });

    // Create workers
    const transcribeWorker = new Worker('transcribe', async (job: Job) => {
        return transcribeHandler(job, getJobContext());
    }, {
        connection: redis,
        concurrency: 2,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
    });

    const summarizeWorker = new Worker('summarize', async (job: Job) => {
        return summarizeHandler(job, getJobContext());
    }, {
        connection: redis,
        concurrency: 1, // Summarization is more resource intensive
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
    });

    const webhookWorker = new Worker('webhook', async (job: Job) => {
        return webhookHandler(job, getJobContext());
    }, {
        connection: redis,
        concurrency: 5,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    });

    const retentionWorker = new Worker('retention', async (job: Job) => {
        return retentionHandler(job, getJobContext());
    }, {
        connection: redis,
        concurrency: 1,
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
    });

    // Error handling
    const workers = [transcribeWorker, summarizeWorker, webhookWorker, retentionWorker];

    workers.forEach(worker => {
        worker.on('completed', (job) => {
            console.log(`Job ${job.id} completed successfully`);
        });

        worker.on('failed', (job, err) => {
            console.error(`Job ${job?.id} failed:`, err);
        });

        worker.on('error', (err) => {
            // Only log non-connection errors to avoid spam
            if (!err.message.includes('ECONNREFUSED') && !err.message.includes('connect')) {
                console.error('Worker error:', err);
            }
        });
    });

    // Schedule recurring jobs
    await scheduleRecurringJobs(retentionQueue);

    // Return queue interface
    return {
        transcribeQueue,
        summarizeQueue,
        webhookQueue,
        retentionQueue,
        close: async () => {
            await Promise.all(workers.map(worker => worker.close()));
            await Promise.all([
                transcribeQueue.close(),
                summarizeQueue.close(),
                webhookQueue.close(),
                retentionQueue.close(),
            ]);
        },
    };
}

// Schedule recurring jobs
async function scheduleRecurringJobs(retentionQueue: Queue) {
    // Schedule retention cleanup job to run daily at 2 AM
    await retentionQueue.add('cleanup', {
        type: 'cleanup',
    }, {
        repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM
        },
        removeOnComplete: 5,
        removeOnFail: 5,
    });

    console.log('Scheduled recurring retention cleanup job');
}

// Job types
export enum JobType {
    TRANSCRIBE = 'transcribe',
    SUMMARIZE = 'summarize',
    WEBHOOK = 'webhook',
    RETENTION = 'retention',
}

// Job status enum (matches Prisma schema)
export enum JobStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

// Helper function to create job record in database
export async function createJobRecord(
    prisma: any,
    type: JobType,
    payload: JobData
): Promise<string> {
    const job = await prisma.job.create({
        data: {
            type,
            status: JobStatus.PENDING,
            payloadJson: payload,
        },
    });

    return job.id;
}

// Helper function to update job status
export async function updateJobStatus(
    prisma: any,
    jobId: string,
    status: JobStatus,
    error?: string
): Promise<void> {
    await prisma.job.update({
        where: { id: jobId },
        data: {
            status,
            error,
            updatedAt: new Date(),
        },
    });
}

// Helper function to increment job attempts
export async function incrementJobAttempts(
    prisma: any,
    jobId: string
): Promise<void> {
    await prisma.job.update({
        where: { id: jobId },
        data: {
            attempts: { increment: 1 },
            updatedAt: new Date(),
        },
    });
}

// Extend the queue setup function to inject context
export function injectJobContext(
    queues: Awaited<ReturnType<typeof setupQueue>>,
    context: JobContext
): void {
    // This would be called from the main app to inject dependencies
    // The actual implementation would use a more sophisticated DI pattern
    (global as any).__jobContext = context;
}

// Helper to get job context (used by job handlers)
export function getJobContext(): JobContext {
    const context = (global as any).__jobContext;
    if (!context) {
        throw new Error('Job context not initialized');
    }
    return context;
}
