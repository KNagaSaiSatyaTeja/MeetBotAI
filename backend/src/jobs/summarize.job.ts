import { Job } from 'bullmq';
import { JobContext, JobStatus, updateJobStatus, incrementJobAttempts } from './queue';
import { llmAdapter } from '../adapters/llm';

export interface SummarizeJobData {
    transcriptId: string;
    meetingId: string;
    orgId: string;
    text: string;
    platform?: string;
    jobId?: string;
}

export async function summarizeHandler(job: Job<SummarizeJobData>, context: JobContext): Promise<void> {
    const { transcriptId, meetingId, orgId, text, platform, jobId } = job.data;

    console.log(`📊 Starting summarization for transcript ${transcriptId}`);

    try {
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.IN_PROGRESS);
        }

        // Verify transcript exists and belongs to organization
        const transcript = await context.prisma.transcript.findFirst({
            where: {
                id: transcriptId,
                meeting: { orgId }
            },
            include: {
                meeting: {
                    select: {
                        id: true,
                        title: true,
                        orgId: true,
                        platform: true,
                        startedAt: true,
                        endedAt: true
                    }
                }
            }
        });

        if (!transcript) {
            throw new Error(`Transcript ${transcriptId} not found or access denied`);
        }

        // Check if summary already exists
        const existingSummary = await context.prisma.summary.findFirst({
            where: { meetingId }
        });

        if (existingSummary) {
            console.log(`📋 Summary already exists for meeting ${meetingId}`);
            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
            }
            return;
        }

        // Generate comprehensive summary
        console.log(`🤖 Generating AI summary for meeting: ${transcript.meeting.title}`);

        const summaryResult = await generateComprehensiveSummary(text, transcript.meeting, transcript);

        // Save summary to database
        const summary = await context.prisma.summary.create({
            data: {
                meetingId,
                model: summaryResult.metadata?.model || 'unknown',
                summaryText: summaryResult.summaryText,
                decisionsJson: summaryResult.decisions,
                actionItemsJson: summaryResult.actionItems,
                participantsJson: summaryResult.participants,
                readyAt: new Date()
            }
        });

        // Generate and save Minutes of Meeting (MoM)
        const momData = await generateMinutesOfMeeting(summaryResult, transcript.meeting, transcript);

        const mom = await context.prisma.meetingMOM.create({
            data: {
                meetingId,
                summaryText: momData.formattedSummary,
                decisionsJson: momData.decisions,
                actionItemsJson: momData.actionItems,
                attendeesJson: momData.attendees,
                topicsJson: momData.topics,
                readyAt: new Date()
            }
        });

        console.log(`✅ Summary and MoM created: ${summary.id}, ${mom.id}`);

        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
        }

        // Send webhook notifications
        await sendWebhookNotification(context, orgId, 'summary.ready', {
            meetingId,
            transcriptId,
            summaryId: summary.id,
            keyTopics: summaryResult.keyTopics,
            sentiment: summaryResult.sentiment,
            decisionsCount: summaryResult.decisions.length,
            actionItemsCount: summaryResult.actionItems.length
        });

        await sendWebhookNotification(context, orgId, 'meeting.processed', {
            meetingId,
            transcriptId,
            summaryId: summary.id,
            momId: mom.id,
            title: transcript.meeting.title,
            platform: transcript.meeting.platform,
            completedAt: new Date().toISOString()
        });

        console.log(`🎉 Summarization completed for transcript ${transcriptId}`);

    } catch (error) {
        console.error(`❌ Summarization failed for transcript ${transcriptId}:`, error);

        if (jobId) {
            await incrementJobAttempts(context.prisma, jobId);
        }

        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            if (jobId) {
                await updateJobStatus(context.prisma, jobId, JobStatus.FAILED, error.message);
            }

            await sendWebhookNotification(context, orgId, 'meeting.failed', {
                meetingId,
                transcriptId,
                error: error.message,
                stage: 'summarization'
            });
        }

        throw error;
    }
}

async function generateComprehensiveSummary(text: string, meeting: any, transcript: any) {
    const prompt = `
Please analyze this meeting transcript and provide a comprehensive summary in JSON format.

Meeting Details:
- Title: ${meeting.title}
- Platform: ${meeting.platform}
- Duration: ${meeting.startedAt && meeting.endedAt ?
            Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 60000) : 'Unknown'} minutes

Transcript:
${text}

Please provide a JSON response with the following structure:
{
    "summaryText": "A comprehensive 2-3 paragraph summary of the meeting",
    "keyTopics": ["topic1", "topic2", "topic3"],
    "decisions": [
        {
            "decision": "What was decided",
            "owner": "Who is responsible",
            "dueDate": "YYYY-MM-DD (if mentioned)",
            "context": "Brief context"
        }
    ],
    "actionItems": [
        {
            "task": "What needs to be done",
            "owner": "Who is responsible",
            "priority": "high|medium|low",
            "dueDate": "YYYY-MM-DD (if mentioned)",
            "status": "pending"
        }
    ],
    "participants": [
        {
            "name": "Participant name (if identifiable)",
            "role": "Their role (if mentioned)",
            "speakingTime": estimated_seconds,
            "keyContributions": ["contribution1", "contribution2"]
        }
    ],
    "sentiment": "positive|neutral|negative",
    "nextSteps": ["step1", "step2"],
    "followUpRequired": true/false
}

Focus on extracting concrete, actionable information. If information is not available, use reasonable defaults or null values.
    `;

    try {
        const result = await llmAdapter.summarize(prompt);

        // Parse JSON response if it's a string
        let parsedResult;
        if (typeof result.summaryText === 'string' && result.summaryText.startsWith('{')) {
            parsedResult = JSON.parse(result.summaryText);
        } else {
            parsedResult = result;
        }

        return {
            summaryText: parsedResult.summaryText || 'Summary not available',
            keyTopics: parsedResult.keyTopics || [],
            decisions: parsedResult.decisions || [],
            actionItems: parsedResult.actionItems || [],
            participants: parsedResult.participants || [],
            sentiment: parsedResult.sentiment || 'neutral',
            nextSteps: parsedResult.nextSteps || [],
            followUpRequired: parsedResult.followUpRequired || false,
            metadata: {
                model: result.metadata?.model || 'unknown',
                generatedAt: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('Error parsing LLM response:', error);

        // Fallback to basic summary
        return {
            summaryText: text.substring(0, 500) + '...',
            keyTopics: ['Meeting Discussion'],
            decisions: [],
            actionItems: [],
            participants: [{ name: 'Unknown', speakingTime: 0 }],
            sentiment: 'neutral',
            nextSteps: [],
            followUpRequired: false,
            metadata: {
                model: 'fallback',
                generatedAt: new Date().toISOString()
            }
        };
    }
}

async function generateMinutesOfMeeting(summaryResult: any, meeting: any, transcript: any) {
    const startTime = meeting.startedAt ? new Date(meeting.startedAt).toLocaleString() : 'Unknown';
    const endTime = meeting.endedAt ? new Date(meeting.endedAt).toLocaleString() : 'Unknown';
    const duration = meeting.startedAt && meeting.endedAt ?
        Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 60000) : 0;

    const formattedSummary = `
# Minutes of Meeting

**Meeting:** ${meeting.title}
**Date:** ${startTime}
**Duration:** ${duration} minutes
**Platform:** ${meeting.platform}

## Summary
${summaryResult.summaryText}

## Key Topics Discussed
${summaryResult.keyTopics.map((topic: string) => `- ${topic}`).join('\n')}

## Decisions Made
${summaryResult.decisions.map((decision: any) =>
        `- **${decision.decision}**
  - Owner: ${decision.owner || 'Not assigned'}
  - Due Date: ${decision.dueDate || 'Not specified'}
  - Context: ${decision.context || 'N/A'}`
    ).join('\n\n')}

## Action Items
${summaryResult.actionItems.map((item: any, index: number) =>
        `${index + 1}. **${item.task}**
   - Assigned to: ${item.owner || 'Not assigned'}
   - Priority: ${item.priority || 'Medium'}
   - Due Date: ${item.dueDate || 'Not specified'}
   - Status: ${item.status || 'Pending'}`
    ).join('\n\n')}

## Participants
${summaryResult.participants.map((participant: any) =>
        `- **${participant.name}** ${participant.role ? `(${participant.role})` : ''}
  - Speaking time: ~${Math.round(participant.speakingTime / 60)} minutes
  - Key contributions: ${participant.keyContributions ? participant.keyContributions.join(', ') : 'N/A'}`
    ).join('\n')}

## Next Steps
${summaryResult.nextSteps.map((step: string) => `- ${step}`).join('\n')}

## Meeting Sentiment
${summaryResult.sentiment.charAt(0).toUpperCase() + summaryResult.sentiment.slice(1)}

${summaryResult.followUpRequired ? '## Follow-up Required\nYes - please review action items and schedule follow-up as needed.' : ''}

---
*Generated automatically by MeetingBot AI*
    `.trim();

    return {
        formattedSummary,
        decisions: summaryResult.decisions,
        actionItems: summaryResult.actionItems,
        attendees: summaryResult.participants,
        topics: summaryResult.keyTopics.map((topic: string) => ({ title: topic, duration: 0 })),
        metadata: {
            generatedAt: new Date().toISOString(),
            sentiment: summaryResult.sentiment,
            followUpRequired: summaryResult.followUpRequired
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