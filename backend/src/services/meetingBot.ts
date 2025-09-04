import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

interface MeetingBotConfig {
    meetingLink: string;
    orgId: string;
    title?: string;
    consentFlags?: {
        recording?: boolean;
        transcription?: boolean;
        summary?: boolean;
    };
}

interface MeetingBotEvents {
    'meeting.joined': (meetingId: string) => void;
    'meeting.started': (meetingId: string) => void;
    'meeting.ended': (meetingId: string) => void;
    'audio.received': (meetingId: string, audioData: Buffer) => void;
    'transcript.generated': (meetingId: string, transcript: string) => void;
    'error': (error: Error) => void;
}

export class MeetingBot extends EventEmitter {
    private prisma: PrismaClient;
    private meetingId: string | null = null;
    private isRecording = false;
    private audioChunks: Buffer[] = [];
    private transcriptBuffer: string[] = [];

    constructor(prisma: PrismaClient) {
        super();
        this.prisma = prisma;
    }

    async joinMeeting(config: MeetingBotConfig): Promise<string> {
        try {
            console.log(`🤖 MeetBot joining meeting: ${config.meetingLink}`);
            
            // Extract meeting ID from Google Meet link
            const meetingCode = this.extractMeetingCode(config.meetingLink);
            if (!meetingCode) {
                throw new Error('Invalid Google Meet link format');
            }

            // Create meeting record in database
            const meeting = await this.prisma.meeting.create({
                data: {
                    orgId: config.orgId,
                    title: config.title || `Meeting ${meetingCode}`,
                    platform: 'google-meet',
                    meetingLink: config.meetingLink,
                    scheduledAt: new Date(),
                    startedAt: new Date(),
                    status: 'IN_PROGRESS',
                    consentFlags: config.consentFlags || {
                        recording: true,
                        transcription: true,
                        summary: true
                    }
                }
            });

            this.meetingId = meeting.id;
            console.log(`✅ Meeting created in database: ${meeting.id}`);

            // Simulate bot joining the meeting
            await this.simulateBotJoin(meetingCode);
            
            this.emit('meeting.joined', meeting.id);
            this.emit('meeting.started', meeting.id);

            return meeting.id;
        } catch (error) {
            console.error('❌ Failed to join meeting:', error);
            this.emit('error', error as Error);
            throw error;
        }
    }

    private extractMeetingCode(meetingLink: string): string | null {
        // Extract meeting code from Google Meet URL
        // Format: https://meet.google.com/abc-defg-hij
        const match = meetingLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
        return match ? match[1] : null;
    }

    private async simulateBotJoin(meetingCode: string): Promise<void> {
        console.log(`🔗 Connecting to Google Meet room: ${meetingCode}`);
        
        // In a real implementation, this would:
        // 1. Use puppeteer/playwright to open Chrome
        // 2. Navigate to the meeting link
        // 3. Handle permissions for microphone/camera
        // 4. Join as "MeetBot AI"
        // 5. Start capturing audio/video streams
        
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`✅ Bot successfully joined meeting: ${meetingCode}`);
        
        // Start recording simulation
        this.startRecording();
        
        // Simulate meeting duration (for demo, we'll run for 30 seconds)
        setTimeout(() => {
            this.endMeeting();
        }, 30000);
    }

    private startRecording(): void {
        if (!this.meetingId) return;
        
        this.isRecording = true;
        console.log('🎙️ Started recording audio...');
        
        // Simulate audio capture every 5 seconds
        const audioInterval = setInterval(() => {
            if (!this.isRecording) {
                clearInterval(audioInterval);
                return;
            }
            
            // Simulate receiving audio data
            const audioChunk = Buffer.from(`audio-data-${Date.now()}`);
            this.audioChunks.push(audioChunk);
            this.emit('audio.received', this.meetingId!, audioChunk);
            
            // Simulate transcript generation
            const transcript = this.generateMockTranscript();
            this.transcriptBuffer.push(transcript);
            this.emit('transcript.generated', this.meetingId!, transcript);
            
        }, 5000);
    }

    private generateMockTranscript(): string {
        const mockPhrases = [
            "Welcome everyone to today's meeting.",
            "Let's start by reviewing the agenda.",
            "The first item on our list is project updates.",
            "Can everyone hear me clearly?",
            "Let's move on to the next topic.",
            "Are there any questions so far?",
            "I think we're making good progress.",
            "Let's wrap up with action items."
        ];
        
        return mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
    }

    async endMeeting(): Promise<void> {
        if (!this.meetingId) return;
        
        try {
            console.log('🛑 Ending meeting and saving data...');
            this.isRecording = false;
            
            // Update meeting status
            await this.prisma.meeting.update({
                where: { id: this.meetingId },
                data: {
                    endedAt: new Date(),
                    status: 'COMPLETED'
                }
            });

            // Save recording data
            if (this.audioChunks.length > 0) {
                await this.saveRecording();
            }

            // Save transcript
            if (this.transcriptBuffer.length > 0) {
                await this.saveTranscript();
            }

            // Generate summary
            await this.generateSummary();

            console.log('✅ Meeting data saved successfully');
            this.emit('meeting.ended', this.meetingId);
            
        } catch (error) {
            console.error('❌ Failed to end meeting:', error);
            this.emit('error', error as Error);
        }
    }

    private async saveRecording(): Promise<void> {
        if (!this.meetingId) return;
        
        // Simulate saving audio recording
        const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        
        await this.prisma.recording.create({
            data: {
                meetingId: this.meetingId,
                hasVideo: false,
                audioUrl: `s3://meetbot-recordings/${this.meetingId}/audio.wav`,
                sizeBytes: BigInt(totalSize),
                checksum: `sha256-${Date.now()}`,
                storageRegion: 'us',
                encryptionMeta: {}
            }
        });
        
        console.log('💾 Audio recording saved');
    }

    private async saveTranscript(): Promise<void> {
        if (!this.meetingId) return;
        
        const fullTranscript = this.transcriptBuffer.join(' ');
        
        // Generate word-level data
        const words = fullTranscript.split(' ').map((word, index) => ({
            word,
            start: index * 0.5,
            end: (index + 1) * 0.5,
            confidence: 0.85 + Math.random() * 0.14
        }));

        // Generate speaker turns
        const speakerTurns = [{
            speaker: 'Participant 1',
            start: 0,
            end: words.length * 0.5,
            text: fullTranscript
        }];
        
        await this.prisma.transcript.create({
            data: {
                meetingId: this.meetingId,
                language: 'en',
                text: fullTranscript,
                wordsJson: words,
                speakerTurnsJson: speakerTurns,
                accuracy: 0.92,
                readyAt: new Date()
            }
        });
        
        console.log('📝 Transcript saved');
    }

    private async generateSummary(): Promise<void> {
        if (!this.meetingId) return;
        
        const summaryText = `
This meeting covered several key topics including project updates and team coordination. 
The participants discussed current progress and identified areas for improvement. 
Overall, the meeting was productive with clear action items identified.
        `.trim();

        const decisions = [
            {
                decision: 'Proceed with current project timeline',
                assignee: 'Project Manager',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        const actionItems = [
            {
                item: 'Complete API documentation',
                assignee: 'Development Team',
                priority: 'high',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                item: 'Schedule follow-up meeting',
                assignee: 'Meeting Organizer',
                priority: 'medium',
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        const participants = [
            {
                name: 'MeetBot AI',
                email: 'bot@meetbot.ai',
                speakingTime: 0
            },
            {
                name: 'Meeting Participant',
                email: 'participant@example.com',
                speakingTime: 1800 // 30 minutes in seconds
            }
        ];
        
        await this.prisma.summary.create({
            data: {
                meetingId: this.meetingId,
                model: 'gpt-4',
                summaryText,
                decisionsJson: decisions,
                actionItemsJson: actionItems,
                participantsJson: participants,
                readyAt: new Date()
            }
        });
        
        console.log('📊 Meeting summary generated');
    }

    async getMeetingData(meetingId: string) {
        return await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                recordings: true,
                transcripts: true,
                summaries: true
            }
        });
    }
}

// Factory function to create and start a meeting bot
export async function createMeetingBot(
    prisma: PrismaClient,
    config: MeetingBotConfig
): Promise<{ bot: MeetingBot; meetingId: string }> {
    const bot = new MeetingBot(prisma);
    
    // Set up event listeners
    bot.on('meeting.joined', (meetingId) => {
        console.log(`🎯 Bot joined meeting: ${meetingId}`);
    });
    
    bot.on('meeting.started', (meetingId) => {
        console.log(`▶️ Meeting started: ${meetingId}`);
    });
    
    bot.on('meeting.ended', (meetingId) => {
        console.log(`⏹️ Meeting ended: ${meetingId}`);
    });
    
    bot.on('audio.received', (meetingId, audioData) => {
        console.log(`🎵 Audio received: ${audioData.length} bytes`);
    });
    
    bot.on('transcript.generated', (meetingId, transcript) => {
        console.log(`💬 Transcript: "${transcript}"`);
    });
    
    bot.on('error', (error) => {
        console.error(`❌ Bot error:`, error.message);
    });
    
    const meetingId = await bot.joinMeeting(config);
    return { bot, meetingId };
}
