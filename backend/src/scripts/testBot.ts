#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { createMeetingBot } from '../services/meetingBot';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: npm run test:bot <zoom-meeting-id> [passcode] [duration-minutes]');
        console.log('Example: npm run test:bot 123456789 mypasscode 5');
        process.exit(1);
    }

    const meetingId = args[0];
    const passcode = args[1];
    const durationMinutes = parseInt(args[2] || '5', 10);

    console.log(`🤖 Testing bot with meeting ID: ${meetingId}`);
    if (passcode) console.log(`🔐 Using passcode: ${passcode}`);
    console.log(`⏱️  Test duration: ${durationMinutes} minutes`);

    const prisma = new PrismaClient();

    try {
        // Ensure test organization exists
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
            console.log(`✅ Created test organization: ${org.id}`);
        }

        // Ensure test user exists
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
            console.log(`✅ Created test user: ${user.id}`);
        }

        // Create meeting bot
        const meetingLink = `https://zoom.us/j/${meetingId}${passcode ? `?pwd=${passcode}` : ''}`;

        const { bot, meetingId: createdMeetingId } = await createMeetingBot(prisma, {
            meetingLink,
            orgId: org.id,
            title: `Test Meeting ${meetingId}`,
            displayName: process.env.BOT_DISPLAY_NAME || 'MeetingBot AI Test',
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
            console.log(`🎉 Bot joined meeting: ${id}`);
        });

        bot.on('meeting.started', (id) => {
            console.log(`🚀 Meeting started: ${id}`);
        });

        bot.on('recording.started', (id) => {
            console.log(`🎙️ Recording started: ${id}`);
        });

        bot.on('meeting.ended', (id) => {
            console.log(`🏁 Meeting ended: ${id}`);
            process.exit(0);
        });

        bot.on('error', (error) => {
            console.error(`❌ Bot error:`, error);
            process.exit(1);
        });

        // Set timeout for test duration
        setTimeout(async () => {
            console.log(`⏰ Test timeout reached (${durationMinutes} minutes), leaving meeting...`);
            await bot.leaveMeeting();
            setTimeout(() => process.exit(0), 5000);
        }, durationMinutes * 60 * 1000);

        console.log(`🤖 Bot is now active. Press Ctrl+C to stop.`);

        // Keep process alive
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping bot...');
            await bot.leaveMeeting();
            await prisma.$disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Test failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
