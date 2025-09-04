require('dotenv').config({ path: './env.local' });

const { PrismaClient } = require('@prisma/client');
const { createMeetingBot } = require('./dist/services/meetingBot');

async function testZoomMeeting() {
    // Your meeting details from the previous conversation
    const meetingId = '973 0370 0707'; // or '9730370707'
    const passcode = 'kS4RU5';
    
    console.log('🤖 Starting Zoom Meeting Bot Test');
    console.log(`📞 Meeting ID: ${meetingId}`);
    console.log(`🔐 Passcode: ${passcode}`);
    console.log(`👤 Bot Name: ${process.env.BOT_DISPLAY_NAME}`);
    
    const prisma = new PrismaClient();
    
    try {
        // Create test organization if it doesn't exist
        let org = await prisma.organization.findFirst({
            where: { name: 'Test Organization' }
        });
        
        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Test Organization',
                    slug: 'test-org',
                    tier: 'BASIC'
                }
            });
            console.log('✅ Created test organization');
        }
        
        // Create test user
        let user = await prisma.user.findFirst({
            where: { email: 'test@meetingbot.ai' }
        });
        
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'test@meetingbot.ai',
                    name: 'Test User',
                    orgId: org.id,
                    role: 'ADMIN'
                }
            });
            console.log('✅ Created test user');
        }
        
        // Create the meeting link
        const meetingLink = `https://zoom.us/j/${meetingId.replace(/\s/g, '')}?pwd=${passcode}`;
        console.log(`🔗 Meeting Link: ${meetingLink}`);
        
        // Create and start the bot
        const { bot, meetingId: createdMeetingId } = await createMeetingBot(prisma, {
            meetingLink,
            orgId: org.id,
            title: `Test Meeting ${meetingId}`,
            displayName: process.env.BOT_DISPLAY_NAME || 'Ping Me',
            passcode,
            consentFlags: {
                recording: true,
                transcription: true,
                summary: true
            }
        });
        
        console.log(`✅ Bot created for meeting: ${createdMeetingId}`);
        
        // Set up event listeners
        bot.on('meeting.joined', (id) => {
            console.log(`🎉 Bot successfully joined meeting: ${id}`);
        });
        
        bot.on('meeting.started', (id) => {
            console.log(`🚀 Meeting started and recording: ${id}`);
        });
        
        bot.on('recording.started', (id) => {
            console.log(`🎙️ Audio recording started: ${id}`);
        });
        
        bot.on('meeting.ended', (id) => {
            console.log(`🏁 Meeting ended: ${id}`);
            console.log('✅ Test completed successfully!');
            process.exit(0);
        });
        
        bot.on('error', (error) => {
            console.error('❌ Bot error:', error.message);
            process.exit(1);
        });
        
        // Set a timeout to leave after 3 minutes if meeting doesn't end
        setTimeout(async () => {
            console.log('⏰ Test timeout reached, leaving meeting...');
            await bot.leaveMeeting();
            setTimeout(() => process.exit(0), 5000);
        }, 3 * 60 * 1000); // 3 minutes
        
        console.log('🤖 Bot is now active. It will automatically join the meeting.');
        console.log('📝 Check the console for status updates...');
        
        // Keep the process alive
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping bot...');
            await bot.leaveMeeting();
            await prisma.$disconnect();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await prisma.$disconnect();
        process.exit(1);
    }
}

// Run the test
testZoomMeeting();
