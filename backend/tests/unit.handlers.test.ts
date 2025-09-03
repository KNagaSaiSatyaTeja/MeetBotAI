import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeHandler } from '../src/jobs/transcribe.job';
import { summarizeHandler } from '../src/jobs/summarize.job';
import { webhookHandler } from '../src/jobs/webhook.job';
import { Job } from 'bullmq';

// Mock external dependencies
vi.mock('../src/adapters/stt', () => ({
    sttAdapter: {
        transcribe: vi.fn().mockResolvedValue({
            text: 'This is a test transcription',
            words: [
                { word: 'This', start: 0, end: 0.5, confidence: 0.95 },
                { word: 'is', start: 0.5, end: 0.7, confidence: 0.92 },
                { word: 'a', start: 0.7, end: 0.8, confidence: 0.98 },
                { word: 'test', start: 0.8, end: 1.2, confidence: 0.96 },
                { word: 'transcription', start: 1.2, end: 2.0, confidence: 0.94 },
            ],
            speakerTurns: [
                { speaker: 'Speaker 1', start: 0, end: 2.0, text: 'This is a test transcription' },
            ],
            language: 'en',
            accuracy: 0.95,
            metadata: { model: 'whisper-test', provider: 'test' },
        }),
    },
}));

vi.mock('../src/adapters/llm', () => ({
    llmAdapter: {
        summarize: vi.fn().mockResolvedValue({
            summaryText: 'This is a test summary of the meeting discussion.',
            decisions: [
                { decision: 'Test decision', owner: 'John Doe' },
            ],
            actionItems: [
                { task: 'Test action item', owner: 'Jane Smith', priority: 'medium' },
            ],
            participants: [
                { name: 'John Doe', role: 'Manager', speakingTime: 120 },
                { name: 'Jane Smith', role: 'Developer', speakingTime: 90 },
            ],
            keyTopics: ['Testing', 'Development', 'Planning'],
            sentiment: 'positive',
            metadata: { model: 'gpt-4-test', provider: 'test' },
        }),
    },
}));

vi.mock('../src/adapters/storage', () => ({
    storageAdapter: {
        downloadFile: vi.fn().mockResolvedValue(Buffer.from('mock audio data')),
    },
}));

// Mock fetch for webhook tests
global.fetch = vi.fn();

describe('Job Handlers Unit Tests', () => {
    let mockContext: any;
    let mockJob: Partial<Job>;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock Prisma context
        mockContext = {
            prisma: {
                recording: {
                    findUnique: vi.fn(),
                },
                meeting: {
                    update: vi.fn(),
                },
                transcript: {
                    findFirst: vi.fn(),
                    create: vi.fn(),
                },
                summary: {
                    findFirst: vi.fn(),
                    create: vi.fn(),
                },
                webhook: {
                    findMany: vi.fn(),
                },
                webhookDelivery: {
                    create: vi.fn(),
                    update: vi.fn(),
                },
                auditLog: {
                    create: vi.fn(),
                },
                job: {
                    update: vi.fn(),
                },
            },
            redis: {},
        };

        // Mock job
        mockJob = {
            data: {},
            attemptsMade: 0,
            opts: { attempts: 3 },
        };
    });

    describe('transcribeHandler', () => {
        it('should successfully transcribe audio and create transcript', async () => {
            const jobData = {
                recordingId: 'rec_123',
                meetingId: 'meet_123',
                orgId: 'org_123',
                language: 'en',
                storageKey: 'recordings/org_123/meet_123/audio.mp3',
            };

            mockJob.data = jobData;

            // Mock database responses
            mockContext.prisma.recording.findUnique.mockResolvedValue({
                id: 'rec_123',
                audioUrl: 's3://bucket/recordings/org_123/meet_123/audio.mp3',
                meeting: {
                    id: 'meet_123',
                    orgId: 'org_123',
                    title: 'Test Meeting',
                },
            });

            mockContext.prisma.transcript.findFirst.mockResolvedValue(null);
            mockContext.prisma.transcript.create.mockResolvedValue({
                id: 'trans_123',
                meetingId: 'meet_123',
                text: 'This is a test transcription',
            });

            await transcribeHandler(mockJob as Job, mockContext);

            // Verify transcript was created
            expect(mockContext.prisma.transcript.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    meetingId: 'meet_123',
                    language: 'en',
                    text: 'This is a test transcription',
                }),
            });

            // Verify meeting status was updated
            expect(mockContext.prisma.meeting.update).toHaveBeenCalledWith({
                where: { id: 'meet_123' },
                data: expect.objectContaining({
                    status: 'COMPLETED',
                }),
            });
        });

        it('should skip transcription if transcript already exists', async () => {
            const jobData = {
                recordingId: 'rec_123',
                meetingId: 'meet_123',
                orgId: 'org_123',
                storageKey: 'recordings/org_123/meet_123/audio.mp3',
            };

            mockJob.data = jobData;

            mockContext.prisma.recording.findUnique.mockResolvedValue({
                id: 'rec_123',
                audioUrl: 's3://bucket/recordings/org_123/meet_123/audio.mp3',
                meeting: { id: 'meet_123', orgId: 'org_123' },
            });

            // Mock existing transcript
            mockContext.prisma.transcript.findFirst.mockResolvedValue({
                id: 'existing_trans_123',
                meetingId: 'meet_123',
            });

            await transcribeHandler(mockJob as Job, mockContext);

            // Verify transcript creation was skipped
            expect(mockContext.prisma.transcript.create).not.toHaveBeenCalled();
        });

        it('should handle transcription errors', async () => {
            const jobData = {
                recordingId: 'rec_123',
                meetingId: 'meet_123',
                orgId: 'org_123',
                storageKey: 'recordings/org_123/meet_123/audio.mp3',
            };

            mockJob.data = jobData;
            mockJob.attemptsMade = 2; // Final attempt

            mockContext.prisma.recording.findUnique.mockResolvedValue({
                id: 'rec_123',
                audioUrl: 's3://bucket/recordings/org_123/meet_123/audio.mp3',
                meeting: { id: 'meet_123', orgId: 'org_123' },
            });

            mockContext.prisma.transcript.findFirst.mockResolvedValue(null);

            // Mock STT adapter error
            const sttAdapter = await import('../src/adapters/stt');
            vi.mocked(sttAdapter.sttAdapter.transcribe).mockRejectedValue(new Error('STT service error'));

            await expect(transcribeHandler(mockJob as Job, mockContext)).rejects.toThrow('STT service error');

            // Verify meeting status was set to failed
            expect(mockContext.prisma.meeting.update).toHaveBeenCalledWith({
                where: { id: 'meet_123' },
                data: { status: 'FAILED' },
            });
        });
    });

    describe('summarizeHandler', () => {
        it('should successfully generate summary', async () => {
            const jobData = {
                transcriptId: 'trans_123',
                meetingId: 'meet_123',
                orgId: 'org_123',
                text: 'This is the meeting transcript text.',
            };

            mockJob.data = jobData;

            mockContext.prisma.transcript.findFirst.mockResolvedValue({
                id: 'trans_123',
                meetingId: 'meet_123',
                text: 'This is the meeting transcript text.',
                meeting: {
                    id: 'meet_123',
                    title: 'Test Meeting',
                    orgId: 'org_123',
                },
            });

            mockContext.prisma.summary.findFirst.mockResolvedValue(null);
            mockContext.prisma.summary.create.mockResolvedValue({
                id: 'sum_123',
                meetingId: 'meet_123',
                summaryText: 'This is a test summary.',
            });

            await summarizeHandler(mockJob as Job, mockContext);

            // Verify summary was created
            expect(mockContext.prisma.summary.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    meetingId: 'meet_123',
                    summaryText: 'This is a test summary of the meeting discussion.',
                }),
            });
        });

        it('should skip summarization if summary already exists', async () => {
            const jobData = {
                transcriptId: 'trans_123',
                meetingId: 'meet_123',
                orgId: 'org_123',
                text: 'This is the meeting transcript text.',
            };

            mockJob.data = jobData;

            mockContext.prisma.transcript.findFirst.mockResolvedValue({
                id: 'trans_123',
                meeting: { orgId: 'org_123' },
            });

            // Mock existing summary
            mockContext.prisma.summary.findFirst.mockResolvedValue({
                id: 'existing_sum_123',
                meetingId: 'meet_123',
            });

            await summarizeHandler(mockJob as Job, mockContext);

            // Verify summary creation was skipped
            expect(mockContext.prisma.summary.create).not.toHaveBeenCalled();
        });
    });

    describe('webhookHandler', () => {
        it('should successfully deliver webhook', async () => {
            const jobData = {
                deliveryId: 'del_123',
                webhookId: 'hook_123',
                url: 'https://example.com/webhook',
                secret: 'webhook_secret',
                event: 'meeting.completed',
                payload: { test: 'data' },
            };

            mockJob.data = jobData;

            // Mock successful HTTP response
            vi.mocked(fetch).mockResolvedValue({
                status: 200,
                text: () => Promise.resolve('OK'),
            } as Response);

            mockContext.prisma.webhookDelivery.update.mockResolvedValue({});

            await webhookHandler(mockJob as Job, mockContext);

            // Verify webhook was called
            expect(fetch).toHaveBeenCalledWith(
                'https://example.com/webhook',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Webhook-Event': 'meeting.completed',
                    }),
                })
            );

            // Verify delivery status was updated to success
            expect(mockContext.prisma.webhookDelivery.update).toHaveBeenCalledWith({
                where: { id: 'del_123' },
                data: expect.objectContaining({
                    status: 'DELIVERED',
                    responseCode: 200,
                }),
            });
        });

        it('should handle webhook delivery failures', async () => {
            const jobData = {
                deliveryId: 'del_123',
                webhookId: 'hook_123',
                url: 'https://example.com/webhook',
                secret: 'webhook_secret',
                event: 'meeting.completed',
                payload: { test: 'data' },
            };

            mockJob.data = jobData;
            mockJob.attemptsMade = 2; // Final attempt

            // Mock failed HTTP response
            vi.mocked(fetch).mockResolvedValue({
                status: 500,
                text: () => Promise.resolve('Internal Server Error'),
            } as Response);

            await expect(webhookHandler(mockJob as Job, mockContext)).rejects.toThrow();

            // Verify delivery status was updated to failed
            expect(mockContext.prisma.webhookDelivery.update).toHaveBeenCalledWith({
                where: { id: 'del_123' },
                data: expect.objectContaining({
                    status: 'CANCELLED',
                    responseCode: 500,
                }),
            });
        });
    });
});
