import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { detectPlatform, MeetingPlatform } from '../utils/platform';
import { ZoomAdapter } from './bot-adapters/zoom';
import { RecordingService } from './recordingService';
import { storageAdapter } from '../adapters/storage';
import { resourceManager } from './resourceManager';
import { connectionPool } from './connectionPool';
import path from 'path';
import fs from 'fs/promises';

export interface MeetingBotConfig {
    meetingLink: string;
    orgId: string;
    title?: string;
    displayName?: string;
    passcode?: string;
    consentFlags?: {
        recording?: boolean;
        transcription?: boolean;
        summary?: boolean;
    };
}

export interface MeetingBotEvents {
    'meeting.joined': (meetingId: string) => void;
    'meeting.started': (meetingId: string) => void;
    'meeting.ended': (meetingId: string) => void;
    'recording.started': (meetingId: string) => void;
    'recording.stopped': (meetingId: string, filePath: string) => void;
    'error': (error: Error) => void;
}

export class MeetingBot extends EventEmitter {
    private prisma: PrismaClient;
    private meetingId: string | null = null;
    private botRowId: string | null = null;
    private platform: MeetingPlatform = 'unknown';
    private adapter: any = null;
    private recordingService: RecordingService;
    private isActive = false;
    private browserResourceId?: string;
    private recordingResourceId?: string;

    constructor(prisma: PrismaClient) {
        super();
        this.prisma = prisma;
        this.recordingService = new RecordingService();
    }

    async joinMeeting(config: MeetingBotConfig): Promise<string> {
        try {
            console.log(`🤖 MeetingBot joining: ${config.meetingLink}`);

            // Check resource availability
            const hasResources = await resourceManager.waitForResourceAvailability(30000);
            if (!hasResources) {
                throw new Error('System resources unavailable. Please try again later.');
            }

            // Acquire browser resource
            this.browserResourceId = await resourceManager.acquireBrowser();

            const detected = detectPlatform(config.meetingLink);
            this.platform = detected.platform;

            if (detected.platform === 'unknown') {
                throw new Error('Unsupported meeting platform');
            }

            // Create meeting record
            const meeting = await this.prisma.meeting.create({
                data: {
                    orgId: config.orgId,
                    title: config.title || `Meeting ${detected.meetingId || 'Auto'}`,
                    platform: detected.platform,
                    meetingLink: config.meetingLink,
                    scheduledAt: new Date(),
                    status: 'IN_PROGRESS',
                    consentFlags: config.consentFlags || {
                        recording: true,
                        transcription: true,
                        summary: true
                    }
                }
            });

            this.meetingId = meeting.id;

            // Create bot tracking record
            const botRow = await this.prisma.meetingsBot.create({
                data: {
                    meetingId: meeting.id,
                    platform: detected.platform,
                    status: 'JOINING',
                    joinLink: config.meetingLink,
                    startedAt: new Date(),
                    metaJson: {
                        platform: detected.platform,
                        meetingId: detected.meetingId,
                        displayName: config.displayName || process.env.BOT_DISPLAY_NAME || 'MeetingBot AI'
                    }
                }
            });

            this.botRowId = botRow.id;
            await this.logBot('INFO', 'bot.joining', 'Bot joining meeting');

            // Initialize platform adapter
            await this.initializeAdapter(config, detected);

            // Start the join process
            await this.performJoin(config, detected);

            this.isActive = true;
            this.emit('meeting.joined', meeting.id);

            return meeting.id;

        } catch (error) {
            console.error('❌ Failed to join meeting:', error);
            await this.updateBotStatus('FAILED');
            this.emit('error', error as Error);
            throw error;
        }
    }

    private async initializeAdapter(config: MeetingBotConfig, detected: any) {
        switch (this.platform) {
            case 'zoom':
                this.adapter = new ZoomAdapter();
                this.setupAdapterEvents();
                break;
            default:
                throw new Error(`Platform ${this.platform} not yet implemented`);
        }
    }

    private setupAdapterEvents() {
        if (!this.adapter) return;

        this.adapter.on('joined', async () => {
            await this.updateBotStatus('IN_MEETING');
            await this.startRecording();
            this.emit('meeting.started', this.meetingId!);
        });

        this.adapter.on('left', async () => {
            await this.endMeeting();
        });

        this.adapter.on('error', (error: Error) => {
            this.emit('error', error);
        });
    }

    private async performJoin(config: MeetingBotConfig, detected: any) {
        const joinConfig = {
            meetingLink: config.meetingLink,
            displayName: config.displayName || process.env.BOT_DISPLAY_NAME || 'MeetingBot AI',
            audio: false, // Bot joins muted
            video: false, // Bot joins with video off
            password: config.passcode || detected.password
        };

        await this.adapter.join(joinConfig);
    }

    private async startRecording() {
        if (!this.meetingId) return;

        try {
            // Acquire recording resource
            this.recordingResourceId = await resourceManager.acquireRecording();

            await this.updateBotStatus('RECORDING');

            const outputDir = process.env.RECORDINGS_DIR || '/tmp/recordings';
            await fs.mkdir(outputDir, { recursive: true });

            const filePath = path.join(outputDir, `${this.meetingId}.wav`);

            await this.recordingService.startRecording(filePath, {
                device: process.env.FFMPEG_AUDIO_DEVICE || 'default'
            });

            await this.logBot('INFO', 'recording.started', 'Recording started');
            this.emit('recording.started', this.meetingId);

        } catch (error) {
            console.error('Failed to start recording:', error);
            await this.logBot('ERROR', 'recording.failed', 'Recording failed to start', { error: (error as Error).message });
        }
    }

    async endMeeting(): Promise<void> {
        if (!this.meetingId || !this.isActive) return;

        try {
            console.log('🛑 Ending meeting and processing data...');
            this.isActive = false;

            await this.updateBotStatus('LEAVING');

            // Stop recording
            const recordingPath = await this.recordingService.stopRecording();
            if (recordingPath) {
                this.emit('recording.stopped', this.meetingId, recordingPath);
                await this.processRecording(recordingPath);
            }

            // Release recording resource
            if (this.recordingResourceId) {
                resourceManager.releaseResource(this.recordingResourceId);
                this.recordingResourceId = undefined;
            }

            // Update meeting status
            await this.prisma.meeting.update({
                where: { id: this.meetingId },
                data: {
                    endedAt: new Date(),
                    status: 'COMPLETED'
                }
            });

            await this.updateBotStatus('ENDED');
            await this.logBot('INFO', 'meeting.ended', 'Meeting ended successfully');

            this.emit('meeting.ended', this.meetingId);

        } catch (error) {
            console.error('❌ Failed to end meeting:', error);
            await this.updateBotStatus('FAILED');
            this.emit('error', error as Error);
        } finally {
            // Always release browser resource
            if (this.browserResourceId) {
                resourceManager.releaseResource(this.browserResourceId);
                this.browserResourceId = undefined;
            }
        }
    }

    private async processRecording(filePath: string) {
        if (!this.meetingId) return;

        try {
            // Read file buffer
            const fileBuffer = await fs.readFile(filePath);
            const storageKey = `recordings/${this.meetingId}/audio.wav`;

            // Try to upload to storage, but don't fail if it doesn't work
            let uploadResult;
            let audioUrl = `file://${filePath}`; // Local file URL as fallback

            try {
                uploadResult = await storageAdapter.uploadFile(
                    storageKey,
                    fileBuffer,
                    'audio/wav'
                );
                audioUrl = uploadResult.url;
                console.log('✅ Recording uploaded to storage successfully');
            } catch (storageError) {
                console.log('⚠️  Storage upload failed, keeping local file:', storageError.message);
                console.log(`📁 Local recording file: ${filePath}`);
            }

            // Create recording record with local file reference
            const recording = await this.prisma.recording.create({
                data: {
                    meetingId: this.meetingId,
                    hasVideo: false,
                    audioUrl: audioUrl,
                    sizeBytes: BigInt(fileBuffer.length),
                    checksum: uploadResult?.checksum || 'local-file',
                    storageRegion: process.env.S3_REGION || 'local',
                    encryptionMeta: uploadResult?.encryptionMeta || { provider: 'local' }
                }
            });

            // Don't delete local file if storage upload failed
            if (uploadResult) {
                await fs.unlink(filePath).catch(() => { });
                console.log('🗑️  Local recording file cleaned up');
            } else {
                console.log('💾 Local recording file preserved');
            }

            // Enqueue transcription job (only if we have storage)
            if (uploadResult) {
                const { transcribeQueue } = (global as any).__jobQueue || {};
                if (transcribeQueue) {
                    await transcribeQueue.add('transcribe', {
                        recordingId: recording.id,
                        meetingId: this.meetingId,
                        orgId: (await this.prisma.meeting.findUnique({
                            where: { id: this.meetingId },
                            select: { orgId: true }
                        }))?.orgId,
                        storageKey,
                        language: 'en'
                    });
                }
            }

            await this.logBot('INFO', 'recording.processed', 'Recording processed successfully');

        } catch (error) {
            console.error('Failed to process recording:', error);
            await this.logBot('ERROR', 'recording.process_failed', 'Recording processing failed', { error: (error as Error).message });
        }
    }

    async leaveMeeting(): Promise<void> {
        if (this.adapter) {
            await this.adapter.leave();
        }
        await this.endMeeting();
    }

    private async updateBotStatus(status: string) {
        if (!this.botRowId) return;

        await this.prisma.meetingsBot.update({
            where: { id: this.botRowId },
            data: {
                status: status as any,
                updatedAt: new Date(),
                endedAt: ['ENDED', 'FAILED'].includes(status) ? new Date() : undefined
            }
        });
    }

    private async logBot(level: string, event: string, message: string, meta: any = {}) {
        if (!this.botRowId) return;

        await this.prisma.meetingBotLog.create({
            data: {
                botId: this.botRowId,
                level: level as any,
                event,
                message,
                metaJson: meta
            }
        });
    }

    async getMeetingData(meetingId: string) {
        return await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                recordings: true,
                transcripts: true,
                summaries: true,
                bots: {
                    include: {
                        logs: {
                            orderBy: { createdAt: 'desc' },
                            take: 50
                        }
                    }
                },
                moms: true
            }
        });
    }
}

// Factory function
export async function createMeetingBot(
    prisma: PrismaClient,
    config: MeetingBotConfig
): Promise<{ bot: MeetingBot; meetingId: string }> {
    const bot = new MeetingBot(prisma);
    const meetingId = await bot.joinMeeting(config);
    return { bot, meetingId };
}