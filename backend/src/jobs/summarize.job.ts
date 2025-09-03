import { Job } from 'bullmq';
import { JobContext, JobStatus, updateJobStatus, incrementJobAttempts } from './queue';
import { llmAdapter } from '../adapters/llm';

export interface SummarizeJobData {
    transcriptId: string;
    meetingId: string;
    orgId: string;
    text: string;
    jobId?: string;
}

export async function summarizeHandler(job: Job<SummarizeJobData>, context: JobContext): Promise<void> {
    const { transcriptId, meetingId, orgId, text, jobId } = job.data;

    console.log(`Starting summarization job for transcript ${transcriptId}`);

    try {
        // Update job status to in progress
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.IN_PROGRESS);
        }

        // Verify transcript exists and belongs to the organization
        const transcript = await context.prisma.transcript.findFirst({
            where: {
                id: transcriptId,
                meeting: { orgId },
            },
            include: {
                meeting: {
                    select: {
                        id: true,
                        title: true,
                        orgId: true,
                    },
                },
            },
        });

        if (!transcript) {
            throw new Error(`Transcript ${transcriptId} not found or access denied`);
        }

        // Check if summary already exists
        const existingSummary = await context.prisma.summary.findFirst({
            where: { meetingId },
        });

        if (existingSummary) {
            console.log(`Summary already exists for meeting ${meetingId}, skipping`);
            return;
        }

        // Generate summary using LLM adapter
        console.log(`Generating summary for transcript ${transcriptId}`);
        const summaryResult = await llmAdapter.summarize(text);

        // Save summary to database
        const summary = await context.prisma.summary.create({
            data: {
                meetingId,
                model: summaryResult.metadata?.model || 'unknown',
                summaryText: summaryResult.summaryText,
                decisionsJson: summaryResult.decisions,
                actionItemsJson: summaryResult.actionItems,
                participantsJson: summaryResult.participants,
                readyAt: new Date(),
            },
        });

        console.log(`Summary created with ID: ${summary.id}`);

        // Update job status to completed
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
        }

        // Send webhook notification for summary completion
        await sendWebhookNotification(context, orgId, 'summary.ready', {
            meetingId,
            transcriptId,
            summaryId: summary.id,
            keyTopics: summaryResult.keyTopics,
            sentiment: summaryResult.sentiment,
            decisionsCount: summaryResult.decisions.length,
            actionItemsCount: summaryResult.actionItems.length,
        });

        // Send webhook notification for meeting processing completion
        await sendWebhookNotification(context, orgId, 'meeting.processed', {
            meetingId,
            transcriptId,
            summaryId: summary.id,
            title: transcript.meeting.title,
            completedAt: new Date().toISOString(),
        });

        console.log(`Summarization job completed for transcript ${transcriptId}`);
    } catch (error) {
        console.error(`Summarization job failed for transcript ${transcriptId}:`, error);

        // Update job attempts
        if (jobId) {
            await incrementJobAttempts(context.prisma, jobId);
        }

        // Update job status to failed if this is the final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.FAILED, error.message);
            }

            // Send webhook notification for failure
            await sendWebhookNotification(context, orgId, 'meeting.failed', {
                meetingId,
                transcriptId,
                error: error.message,
                stage: 'summarization',
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
