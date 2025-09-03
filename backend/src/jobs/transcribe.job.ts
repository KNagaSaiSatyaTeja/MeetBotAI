import { Job } from 'bullmq';
import { JobContext, JobStatus, updateJobStatus, incrementJobAttempts } from './queue';
import { sttAdapter } from '../adapters/stt';
import { storageAdapter } from '../adapters/storage';

export interface TranscribeJobData {
    recordingId: string;
    meetingId: string;
    orgId: string;
    language?: string;
    storageKey: string;
    jobId?: string;
}

export async function transcribeHandler(job: Job<TranscribeJobData>, context: JobContext): Promise<void> {
    const { recordingId, meetingId, orgId, language = 'en', storageKey, jobId } = job.data;

    console.log(`Starting transcription job for recording ${recordingId}`);

    try {
        // Update job status to in progress
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.IN_PROGRESS);
        }

        // Get recording details
        const recording = await context.prisma.recording.findUnique({
            where: { id: recordingId },
            include: {
                meeting: {
                    select: {
                        id: true,
                        orgId: true,
                        title: true,
                    },
                },
            },
        });

        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }

        if (recording.meeting.orgId !== orgId) {
            throw new Error(`Recording ${recordingId} does not belong to organization ${orgId}`);
        }

        // Check if transcript already exists
        const existingTranscript = await context.prisma.transcript.findFirst({
            where: { meetingId },
        });

        if (existingTranscript) {
            console.log(`Transcript already exists for meeting ${meetingId}, skipping`);
            return;
        }

        // Get file URL for STT service
        const fileUrl = recording.audioUrl || recording.videoUrl;
        if (!fileUrl) {
            throw new Error(`No audio/video URL found for recording ${recordingId}`);
        }

        // Perform transcription
        console.log(`Transcribing file: ${fileUrl} (language: ${language})`);
        const transcriptionResult = await sttAdapter.transcribe(fileUrl, language);

        // Save transcript to database
        const transcript = await context.prisma.transcript.create({
            data: {
                meetingId,
                language: transcriptionResult.language,
                text: transcriptionResult.text,
                wordsJson: transcriptionResult.words,
                speakerTurnsJson: transcriptionResult.speakerTurns,
                accuracy: transcriptionResult.accuracy,
                readyAt: new Date(),
            },
        });

        console.log(`Transcript created with ID: ${transcript.id}`);

        // Update meeting status
        await context.prisma.meeting.update({
            where: { id: meetingId },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
            },
        });

        // Update job status to completed
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
        }

        // Enqueue summarization job
        const { summarizeQueue } = context as any; // Type assertion for queue access
        if (summarizeQueue) {
            await summarizeQueue.add('summarize', {
                transcriptId: transcript.id,
                meetingId,
                orgId,
                text: transcriptionResult.text,
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
            });

            console.log(`Enqueued summarization job for transcript ${transcript.id}`);
        }

        // Send webhook notification
        await sendWebhookNotification(context, orgId, 'transcript.ready', {
            meetingId,
            transcriptId: transcript.id,
            recordingId,
            language: transcriptionResult.language,
            accuracy: transcriptionResult.accuracy,
        });

        console.log(`Transcription job completed for recording ${recordingId}`);
    } catch (error) {
        console.error(`Transcription job failed for recording ${recordingId}:`, error);

        // Update job attempts
        if (jobId) {
            await incrementJobAttempts(context.prisma, jobId);
        }

        // Update meeting status to failed if this is the final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            await context.prisma.meeting.update({
                where: { id: meetingId },
                data: { status: 'FAILED' },
            });

            // Update job status to failed
            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.FAILED, error.message);
            }

            // Send webhook notification for failure
            await sendWebhookNotification(context, orgId, 'meeting.failed', {
                meetingId,
                recordingId,
                error: error.message,
                stage: 'transcription',
            });
        }

        throw error;
    }
}

// Helper function to send webhook notifications
async function sendWebhookNotification(
    context: JobContext,
    orgId: string,
    event: string,
    data: any
): Promise<void> {
    try {
        // Find active webhooks for this organization and event
        const webhooks = await context.prisma.webhook.findMany({
            where: {
                orgId,
                active: true,
                events: { has: event },
            },
        });

        // Enqueue webhook delivery jobs
        const { webhookQueue } = context as any;
        if (webhookQueue && webhooks.length > 0) {
            for (const webhook of webhooks) {
                // Create webhook delivery record
                const delivery = await context.prisma.webhookDelivery.create({
                    data: {
                        webhookId: webhook.id,
                        event,
                        payloadJson: {
                            event,
                            timestamp: new Date().toISOString(),
                            data,
                        },
                        status: 'PENDING',
                    },
                });

                // Enqueue delivery job
                await webhookQueue.add('webhook', {
                    deliveryId: delivery.id,
                    webhookId: webhook.id,
                    url: webhook.url,
                    secret: webhook.secret,
                    event,
                    payload: delivery.payloadJson,
                }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 },
                });
            }
        }
    } catch (error) {
        console.error('Failed to send webhook notification:', error);
        // Don't throw - webhook failures shouldn't fail the main job
    }
}
