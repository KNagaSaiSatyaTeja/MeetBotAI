import { Job } from 'bullmq';
import crypto from 'crypto';
import { JobContext } from './queue';

export interface WebhookJobData {
    deliveryId: string;
    webhookId: string;
    url: string;
    secret: string;
    event: string;
    payload: any;
}

export async function webhookHandler(job: Job<WebhookJobData>, context: JobContext): Promise<void> {
    const { deliveryId, webhookId, url, secret, event, payload } = job.data;

    console.log(`Delivering webhook ${deliveryId} to ${url}`);

    try {
        // Update delivery status to in progress
        await context.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
                status: 'PENDING',
                attempts: job.attemptsMade + 1,
            },
        });

        // Prepare webhook payload
        const payloadString = JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000);

        // Generate HMAC signature
        const signature = generateSignature(payloadString, timestamp, secret);

        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Meeting-Bot/1.0',
            'X-Webhook-Timestamp': timestamp.toString(),
            'X-Webhook-Signature-256': signature,
            'X-Webhook-Event': event,
            'X-Webhook-Delivery': deliveryId,
        };

        // Send webhook request
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: payloadString,
            timeout: 30000, // 30 second timeout
        });

        const responseBody = await response.text();
        const isSuccess = response.status >= 200 && response.status < 300;

        // Update delivery record
        await context.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
                status: isSuccess ? 'DELIVERED' : 'FAILED',
                responseCode: response.status,
                responseBody: responseBody.substring(0, 1000), // Limit response body length
                updatedAt: new Date(),
            },
        });

        if (!isSuccess) {
            throw new Error(`Webhook delivery failed with status ${response.status}: ${responseBody}`);
        }

        console.log(`Webhook ${deliveryId} delivered successfully`);
    } catch (error) {
        console.error(`Webhook delivery failed for ${deliveryId}:`, error);

        // Calculate next retry time (exponential backoff)
        const baseDelay = 1000; // 1 second
        const maxDelay = 300000; // 5 minutes
        const delay = Math.min(baseDelay * Math.pow(2, job.attemptsMade), maxDelay);
        const nextRetryAt = new Date(Date.now() + delay);

        // Update delivery record with failure info
        await context.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
                status: 'FAILED',
                attempts: job.attemptsMade + 1,
                responseCode: error.cause?.status || null,
                responseBody: error.message.substring(0, 1000),
                nextRetryAt: job.attemptsMade < (job.opts.attempts || 3) - 1 ? nextRetryAt : null,
                updatedAt: new Date(),
            },
        });

        // If this is the final attempt, mark as permanently failed
        if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
            await context.prisma.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: 'CANCELLED',
                    nextRetryAt: null,
                },
            });

            console.log(`Webhook ${deliveryId} permanently failed after ${job.attemptsMade + 1} attempts`);
        }

        throw error;
    }
}

// Helper function to generate HMAC signature
function generateSignature(payload: string, timestamp: number, secret: string): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    return `sha256=${signature}`;
}

// Helper function to verify webhook signature (for testing)
export function verifyWebhookSignature(
    payload: string,
    timestamp: number,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = generateSignature(payload, timestamp, secret);

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

// Webhook event types
export const WEBHOOK_EVENTS = {
    MEETING_CREATED: 'meeting.created',
    MEETING_STARTED: 'meeting.started',
    MEETING_COMPLETED: 'meeting.completed',
    MEETING_FAILED: 'meeting.failed',
    MEETING_PROCESSED: 'meeting.processed',
    RECORDING_UPLOADED: 'recording.uploaded',
    TRANSCRIPT_READY: 'transcript.ready',
    SUMMARY_READY: 'summary.ready',
} as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];
