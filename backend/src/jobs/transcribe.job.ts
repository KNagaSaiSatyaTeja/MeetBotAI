import { Job } from 'bullmq';
import { JobContext, JobStatus, updateJobStatus, incrementJobAttempts } from './queue';
import { whisperService } from '../services/whisperService';
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

    console.log(`🎙️ Starting transcription for recording ${recordingId}`);

    try {
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
                        platform: true
                    }
                }
            }
        });

        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }

        if (recording.meeting.orgId !== orgId) {
            throw new Error(`Recording ${recordingId} access denied`);
        }

        // Check if transcript already exists
        const existingTranscript = await context.prisma.transcript.findFirst({
            where: { meetingId }
        });

        if (existingTranscript) {
            console.log(`📝 Transcript already exists for meeting ${meetingId}`);
            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
            }
            return;
        }

        // Get file URL for transcription
        const fileUrl = recording.audioUrl || recording.videoUrl;
        if (!fileUrl) {
            throw new Error(`No media URL found for recording ${recordingId}`);
        }

        console.log(`🔄 Transcribing file: ${fileUrl}`);

        // Perform transcription using Whisper
        let transcriptionResult;
        if (fileUrl.startsWith('file://')) {
            // Local file
            const localPath = fileUrl.replace('file://', '');
            transcriptionResult = await whisperService.transcribeAudio(localPath, { language });
        } else {
            // Remote URL
            transcriptionResult = await whisperService.transcribeFromUrl(fileUrl, { language });
        }

        // Enhance transcript with speaker detection and formatting
        const enhancedResult = await enhanceTranscript(transcriptionResult, recording.meeting);

        // Save transcript to database
        const transcript = await context.prisma.transcript.create({
            data: {
                meetingId,
                language: enhancedResult.language,
                text: enhancedResult.text,
                wordsJson: enhancedResult.words,
                speakerTurnsJson: enhancedResult.speakerTurns,
                accuracy: enhancedResult.accuracy,
                readyAt: new Date()
            }
        });

        console.log(`✅ Transcript created: ${transcript.id}`);

        // Update job status
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
        }

        // Enqueue summarization job
        const jobQueue = (global as any).__jobQueue;
        if (jobQueue?.summarizeQueue) {
            await jobQueue.summarizeQueue.add('summarize', {
                transcriptId: transcript.id,
                meetingId,
                orgId,
                text: enhancedResult.text,
                platform: recording.meeting.platform
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 }
            });

            console.log(`📊 Enqueued summarization for transcript ${transcript.id}`);
        }

        // Send webhook notification
        await sendWebhookNotification(context, orgId, 'transcript.ready', {
            meetingId,
            transcriptId: transcript.id,
            recordingId,
            language: enhancedResult.language,
            accuracy: enhancedResult.accuracy,
            wordCount: enhancedResult.words.length,
            duration: Math.max(...enhancedResult.words.map(w => w.end)) || 0
        });

        console.log(`🎉 Transcription completed for recording ${recordingId}`);

    } catch (error) {
        console.error(`❌ Transcription failed for recording ${recordingId}:`, error);

        if (jobId) {
            await incrementJobAttempts(context.prisma, jobId);
        }

        // Mark as failed if final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            await context.prisma.meeting.update({
                where: { id: meetingId },
                data: { status: 'FAILED' }
            });

            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.FAILED, error.message);
            }

            await sendWebhookNotification(context, orgId, 'meeting.failed', {
                meetingId,
                recordingId,
                error: error.message,
                stage: 'transcription'
            });
        }

        throw error;
    }
}

async function enhanceTranscript(result: any, meeting: any) {
    // Convert Whisper segments to speaker turns format
    const speakerTurns = result.segments?.map((segment: any, index: number) => ({
        speaker: `Speaker ${index + 1}`, // Whisper doesn't provide speaker identification
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: Math.max(0, Math.min(1, Math.exp(segment.avg_logprob))),
        words: segment.tokens || []
    })) || [];

    // Create words array from segments
    const words = result.segments?.flatMap((segment: any) =>
        segment.tokens?.map((token: any, index: number) => ({
            word: token,
            start: segment.start + (index * (segment.end - segment.start) / segment.tokens.length),
            end: segment.start + ((index + 1) * (segment.end - segment.start) / segment.tokens.length),
            confidence: Math.max(0, Math.min(1, Math.exp(segment.avg_logprob)))
        })) || []
    ) || [];

    return {
        text: result.text,
        language: result.language,
        duration: result.duration,
        words,
        speakerTurns,
        accuracy: result.confidence || 0.8,
        metadata: {
            platform: meeting.platform,
            meetingTitle: meeting.title,
            processedAt: new Date().toISOString(),
            whisperModel: 'whisper-1'
        }
    };
}

async function sendWebhookNotification(
    context: JobContext,
    orgId: string,
    event: string,
    data: any
): Promise<void> {
    try {
        const webhooks = await context.prisma.webhook.findMany({
            where: {
                orgId,
                active: true,
                events: { has: event }
            }
        });

        const jobQueue = (global as any).__jobQueue;
        if (jobQueue?.webhookQueue && webhooks.length > 0) {
            for (const webhook of webhooks) {
                const delivery = await context.prisma.webhookDelivery.create({
                    data: {
                        webhookId: webhook.id,
                        event,
                        payloadJson: {
                            event,
                            timestamp: new Date().toISOString(),
                            data
                        },
                        status: 'PENDING'
                    }
                });

                await jobQueue.webhookQueue.add('webhook', {
                    deliveryId: delivery.id,
                    webhookId: webhook.id,
                    url: webhook.url,
                    secret: webhook.secret,
                    event,
                    payload: delivery.payloadJson
                }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 }
                });
            }
        }
    } catch (error) {
        console.error('Failed to send webhook notification:', error);
    }
}