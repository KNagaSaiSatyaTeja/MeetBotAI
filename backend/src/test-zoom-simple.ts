import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createMeetingBot } from './services/meetingBot';

// Load environment variables
dotenv.config({ path: './env.local' });

async function testZoomBot() {
    console.log('🤖 Testing Zoom Bot with Environment Variables Only');
    console.log('='.repeat(50));

    // Verify environment variables
    const requiredEnvVars = [
        'BOT_DISPLAY_NAME',
        'DATABASE_URL',
        'RECORDINGS_DIR',
        'FFMPEG_AUDIO_DEVICE'
    ];

    console.log('📋 Environment Check:');
    for (const envVar of requiredEnvVars) {
        const value = process.env[envVar];
        console.log(`   ${envVar}: ${value ? '✅' : '❌'} ${value ? `"${value}"` : 'NOT SET'}`);
    }

    // Your Zoom meeting details
    const meetingId = '93049107200'; // Current live meeting
    const passcode = 'FMvt8B';
    const meetingLink = `https://zoom.us/j/${meetingId}?pwd=${passcode}`;

    console.log('\n📞 Meeting Details:');
    console.log(`   Meeting ID: ${meetingId}`);
    console.log(`   Passcode: ${passcode}`);
    console.log(`   Link: ${meetingLink}`);
    console.log(`   Bot Name: ${process.env.BOT_DISPLAY_NAME}`);

    const prisma = new PrismaClient();

    try {
        // Create test org and user
        let org = await prisma.organization.findFirst({
            where: { name: 'Test Organization' }
        });

        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Test Organization',
                    plan: 'free'
                }
            });
        }

        let user = await prisma.user.findFirst({
            where: { email: 'test@meetingbot.ai' }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'test@meetingbot.ai',
                    orgId: org.id,
                    provider: 'test',
                    role: 'ADMIN'
                }
            });
        }

        console.log('\n✅ Database setup complete');

        // Create meeting bot
        console.log('\n🚀 Creating meeting bot...');

        const { bot, meetingId: createdMeetingId } = await createMeetingBot(prisma, {
            meetingLink,
            orgId: org.id,
            title: `Zoom Test Meeting ${meetingId}`,
            displayName: process.env.BOT_DISPLAY_NAME || 'Ping Me',
            passcode,
            consentFlags: {
                recording: true,
                transcription: true,
                summary: true
            }
        });

        console.log(`✅ Bot created with meeting ID: ${createdMeetingId}`);

        // Event listeners
        bot.on('meeting.joined', (id) => {
            console.log(`\n🎉 SUCCESS: Bot joined meeting ${id}`);
            console.log('   - Bot should appear in the Zoom meeting');
            console.log('   - Bot name should be:', process.env.BOT_DISPLAY_NAME);
            console.log('   - Microphone should be muted');
            console.log('   - Video should be off');
        });

        bot.on('recording.started', (id) => {
            console.log(`\n🎙️ RECORDING: Started for meeting ${id}`);
            console.log('   - Audio capture is active');
            console.log('   - Files saved to:', process.env.RECORDINGS_DIR);
        });

        bot.on('meeting.ended', (id) => {
            console.log(`\n🏁 COMPLETED: Meeting ${id} ended`);
            console.log('   - Recording stopped and uploaded');
            console.log('   - Transcription will be processed');
            console.log('   - Summary will be generated');
            process.exit(0);
        });

        bot.on('error', (error) => {
            console.error(`\n❌ ERROR: ${error.message}`);
            console.error('   Stack:', error.stack);
            process.exit(1);
        });

        console.log('\n⏳ Bot is joining the meeting...');
        console.log('   This may take 10-30 seconds');
        console.log('   Watch for the bot to appear in your Zoom meeting');
        console.log('\n🔄 Status updates will appear below:');
        console.log('-'.repeat(50));

        // Timeout after 5 minutes
        setTimeout(async () => {
            console.log('\n⏰ Test timeout (5 minutes) - leaving meeting');
            await bot.leaveMeeting();
            setTimeout(() => process.exit(0), 3000);
        }, 5 * 60 * 1000);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 User interrupted - cleaning up...');
            await bot.leaveMeeting();
            await prisma.$disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

// Run the test
testZoomBot();
