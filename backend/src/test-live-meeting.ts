import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createMeetingBot } from './services/meetingBot';

dotenv.config({ path: './env.local' });

async function testLiveMeeting() {
    console.log('🚀 Testing Live Zoom Meeting');
    console.log('Meeting ID: 951 6498 5716');
    console.log('Passcode: gceBH4');
    console.log('Web-only access (no desktop app)');
    console.log('='.repeat(50));

    const prisma = new PrismaClient();

    try {
        // Get existing test organization
        let org = await prisma.organization.findFirst({
            where: { name: 'Test Organization' }
        });

        if (!org) {
            org = await prisma.organization.create({
                data: { name: 'Test Organization', plan: 'free' }
            });
        }

        console.log('✅ Organization ready:', org.id);

        // Create meeting bot with your NEW LIVE meeting details
        const meetingLink = 'https://zoom.us/j/95164985716?pwd=g6znEZbIYYadCRUbWXhFHqzRyQ8x7b.1';

        console.log('\n🤖 Starting bot with live meeting...');
        console.log('📞 Meeting Link:', meetingLink);
        console.log('👤 Bot Name:', process.env.BOT_DISPLAY_NAME || 'Ping Me');
        console.log('🎙️ Audio Device:', process.env.FFMPEG_AUDIO_DEVICE);

        // Verify audio device is set correctly
        if (!process.env.FFMPEG_AUDIO_DEVICE || process.env.FFMPEG_AUDIO_DEVICE === 'default') {
            console.log('⚠️  WARNING: Audio device not configured properly');
            console.log('   Please set FFMPEG_AUDIO_DEVICE="Stereo Mix (Realtek(R) Audio)" in env.local');
        }
        console.log('💾 Recordings Dir:', process.env.RECORDINGS_DIR);

        const { bot, meetingId } = await createMeetingBot(prisma, {
            meetingLink,
            orgId: org.id,
            title: 'Live Zoom Meeting Test',
            displayName: process.env.BOT_DISPLAY_NAME || 'Ping Me',
            passcode: 'gceBH4',
            consentFlags: {
                recording: true,
                transcription: true,
                summary: true
            }
        });

        console.log('✅ Bot created for meeting:', meetingId);

        // Set up comprehensive event logging
        bot.on('meeting.joined', async (id) => {
            console.log('\n🎉 SUCCESS: Bot joined the meeting!');
            console.log('   - Meeting ID:', id);
            console.log('   - Bot should now be visible in your Zoom meeting');
            console.log('   - Bot name should appear as:', process.env.BOT_DISPLAY_NAME);
            console.log('   - Microphone should be muted');
            console.log('   - Video should be off');

            // Verify database record
            const meeting = await prisma.meeting.findUnique({
                where: { id },
                include: { bots: true }
            });
            console.log('   - Database status:', meeting?.status);
            console.log('   - Bot status:', meeting?.bots[0]?.status);
        });

        bot.on('recording.started', async (id) => {
            console.log('\n🎙️ AUDIO RECORDING STARTED');
            console.log('   - Meeting ID:', id);
            console.log('   - Recording to:', process.env.RECORDINGS_DIR);
            console.log('   - Audio device:', process.env.FFMPEG_AUDIO_DEVICE);
            console.log('   - File will be saved as WAV format');

            // Check if recording file is being created
            const fs = require('fs');
            const path = require('path');
            const recordingPath = path.join(process.env.RECORDINGS_DIR || './recordings', `${id}.wav`);

            setTimeout(() => {
                if (fs.existsSync(recordingPath)) {
                    const stats = fs.statSync(recordingPath);
                    console.log('   - Recording file size:', stats.size, 'bytes');
                } else {
                    console.log('   - Recording file not yet created (normal for first few seconds)');
                }
            }, 5000);
        });

        bot.on('meeting.ended', async (id) => {
            console.log('\n🏁 MEETING ENDED');
            console.log('   - Meeting ID:', id);
            console.log('   - Recording stopped and will be processed');
            console.log('   - Data being uploaded to Supabase');

            // Check final database state
            setTimeout(async () => {
                const finalMeeting = await prisma.meeting.findUnique({
                    where: { id },
                    include: {
                        bots: { include: { logs: true } },
                        recordings: true,
                        transcripts: true,
                        summaries: true
                    }
                });

                console.log('\n📊 FINAL DATABASE STATE:');
                console.log('   - Meeting status:', finalMeeting?.status);
                console.log('   - Bot logs:', finalMeeting?.bots[0]?.logs?.length || 0);
                console.log('   - Recordings:', finalMeeting?.recordings?.length || 0);
                console.log('   - Transcripts:', finalMeeting?.transcripts?.length || 0);
                console.log('   - Summaries:', finalMeeting?.summaries?.length || 0);

                console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
                process.exit(0);
            }, 10000);
        });

        bot.on('error', async (error) => {
            console.error('\n❌ BOT ERROR:', error.message);
            console.error('   Stack:', error.stack);

            // Log error to database
            try {
                const meeting = await prisma.meeting.findFirst({
                    where: { id: meetingId },
                    include: { bots: true }
                });

                if (meeting?.bots[0]) {
                    await prisma.meetingBotLog.create({
                        data: {
                            botId: meeting.bots[0].id,
                            level: 'ERROR',
                            event: 'bot.error',
                            message: error.message,
                            metaJson: { stack: error.stack }
                        }
                    });
                }
            } catch (logError) {
                console.error('   Failed to log error to database:', logError);
            }

            process.exit(1);
        });

        console.log('\n⏳ Bot is now joining the meeting...');
        console.log('   This may take 15-30 seconds');
        console.log('   Browser will open in web mode (not desktop app)');
        console.log('   Watch your Zoom meeting for the bot to appear');

        console.log('\n🔄 Status updates:');
        console.log('-'.repeat(50));

        // Set up timeout (10 minutes max)
        setTimeout(async () => {
            console.log('\n⏰ Test timeout (10 minutes) - stopping bot');
            await bot.leaveMeeting();
            setTimeout(() => process.exit(0), 5000);
        }, 10 * 60 * 1000);

        // Graceful shutdown on Ctrl+C
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 User interrupted - cleaning up...');
            await bot.leaveMeeting();
            await prisma.$disconnect();
            process.exit(0);
        });

        // Keep process alive
        await new Promise(() => { }); // Infinite wait

    } catch (error) {
        console.error('\n❌ Test setup failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

console.log('🎯 Live Meeting Bot Test Starting...');
console.log('Press Ctrl+C to stop the test at any time');
testLiveMeeting();
