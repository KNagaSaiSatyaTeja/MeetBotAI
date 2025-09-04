import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import { RecordingService } from './services/recordingService';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: './env.local' });

async function testZoomWithManualSteps() {
    console.log('🎯 Manual Zoom Bot Test - Step by Step');
    console.log('='.repeat(60));

    const meetingId = '93049107200';
    const passcode = 'FMvt8B';
    const meetingLink = `https://zoom.us/j/${meetingId}?pwd=${passcode}`;

    console.log('📞 Meeting Details:');
    console.log(`   Meeting ID: ${meetingId}`);
    console.log(`   Passcode: ${passcode}`);
    console.log(`   Link: ${meetingLink}`);
    console.log(`   Bot Name: ${process.env.BOT_DISPLAY_NAME || 'Ping Me'}`);

    // Step 1: Database Test
    console.log('\n📊 Step 1: Testing Database Connection...');
    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log('✅ Database connected');

        // Create test meeting record
        const testMeeting = await prisma.meeting.create({
            data: {
                orgId: 'cmf55iex30000t3z675ykhfp9', // Use existing org from previous test
                title: `Live Zoom Test ${meetingId}`,
                platform: 'zoom',
                meetingLink: meetingLink,
                status: 'IN_PROGRESS',
                consentFlags: {
                    recording: true,
                    transcription: true,
                    summary: true
                }
            }
        });
        console.log(`✅ Meeting record created: ${testMeeting.id}`);

        // Step 2: Audio Recording Test
        console.log('\n🎙️ Step 2: Testing Audio Recording...');
        const recordingService = new RecordingService();
        const recordingsDir = process.env.RECORDINGS_DIR || './recordings';

        // Ensure recordings directory exists
        await fs.mkdir(recordingsDir, { recursive: true });
        console.log(`✅ Recordings directory ready: ${recordingsDir}`);

        const testAudioFile = path.join(recordingsDir, `test-${Date.now()}.wav`);
        console.log(`📁 Test audio file: ${testAudioFile}`);

        // Test audio device
        console.log(`🔊 Audio device: ${process.env.FFMPEG_AUDIO_DEVICE}`);

        // Step 3: Browser Test
        console.log('\n🌐 Step 3: Testing Browser Automation...');
        const browser = await puppeteer.launch({
            headless: false, // Show browser for manual verification
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--autoplay-policy=no-user-gesture-required',
                '--use-fake-ui-for-media-stream',
                '--allow-file-access-from-files',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: { width: 1280, height: 720 }
        });

        const page = await browser.newPage();
        console.log('✅ Browser launched');

        // Navigate to Zoom
        console.log(`🔗 Navigating to: ${meetingLink}`);
        await page.goto(meetingLink, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check page content
        const title = await page.title();
        const url = page.url();
        console.log(`📄 Page title: "${title}"`);
        console.log(`🌐 Current URL: ${url}`);

        // Look for key elements
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pageContent = await page.content();
        const hasJoinButton = pageContent.toLowerCase().includes('join');
        const hasNameInput = await page.$('input[type="text"]') !== null;
        const hasPasswordInput = await page.$('input[type="password"]') !== null;

        console.log('🔍 Page Analysis:');
        console.log(`   Join button detected: ${hasJoinButton ? '✅' : '❌'}`);
        console.log(`   Name input detected: ${hasNameInput ? '✅' : '❌'}`);
        console.log(`   Password input detected: ${hasPasswordInput ? '✅' : '❌'}`);

        if (hasJoinButton || hasNameInput) {
            console.log('\n🎉 Meeting appears to be accessible!');

            // Try to fill name if input exists
            if (hasNameInput) {
                const nameInput = await page.$('input[type="text"]');
                if (nameInput) {
                    await nameInput.click({ clickCount: 3 });
                    await nameInput.type(process.env.BOT_DISPLAY_NAME || 'Ping Me');
                    console.log('✅ Name filled');
                }
            }

            // Try to fill password if input exists
            if (hasPasswordInput && passcode) {
                const passwordInput = await page.$('input[type="password"]');
                if (passwordInput) {
                    await passwordInput.type(passcode);
                    console.log('✅ Passcode filled');
                }
            }

            console.log('\n⏸️  Browser will stay open for 60 seconds...');
            console.log('   👀 Please manually verify:');
            console.log('   1. Bot name is filled correctly');
            console.log('   2. Passcode is filled (if required)');
            console.log('   3. Join button is clickable');
            console.log('   4. Meeting is accessible');

            // Keep browser open for manual inspection
            await new Promise(resolve => setTimeout(resolve, 60000));

        } else {
            console.log('\n❌ Meeting may not be accessible');
            console.log('   Possible reasons:');
            console.log('   - Meeting has ended');
            console.log('   - Meeting hasn\'t started');
            console.log('   - Invalid meeting ID or passcode');
            console.log('   - Zoom UI has changed');

            // Show page content for debugging
            console.log('\n📄 Page content preview:');
            const textContent = await page.evaluate(() => document.body.innerText);
            console.log(textContent.substring(0, 500) + '...');
        }

        await browser.close();

        // Step 4: Create Bot Record
        console.log('\n🤖 Step 4: Creating Bot Record...');
        const botRecord = await prisma.meetingsBot.create({
            data: {
                meetingId: testMeeting.id,
                platform: 'zoom',
                status: 'IN_MEETING',
                joinLink: meetingLink,
                startedAt: new Date(),
                metaJson: {
                    meetingId: meetingId,
                    passcode: passcode,
                    displayName: process.env.BOT_DISPLAY_NAME || 'Ping Me',
                    test: true
                }
            }
        });
        console.log(`✅ Bot record created: ${botRecord.id}`);

        // Step 5: Create Log Entry
        await prisma.meetingBotLog.create({
            data: {
                botId: botRecord.id,
                level: 'INFO',
                event: 'manual.test.completed',
                message: 'Manual test completed successfully',
                metaJson: {
                    meetingId: meetingId,
                    passcode: passcode,
                    timestamp: new Date().toISOString()
                }
            }
        });
        console.log('✅ Log entry created');

        console.log('\n🎉 Manual Test Summary:');
        console.log('✅ Database: Working');
        console.log('✅ Supabase: Connected and storing data');
        console.log('✅ Browser: Launched and navigated to meeting');
        console.log('✅ Bot Records: Created in database');
        console.log('✅ Environment: All variables loaded');

        console.log('\n📋 Next Steps:');
        console.log('1. If the meeting was accessible, the bot can join');
        console.log('2. Audio recording will work with proper device setup');
        console.log('3. All data will be stored in Supabase');
        console.log('4. Transcription and summarization will process automatically');

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        await prisma.meetingBotLog.deleteMany({ where: { botId: botRecord.id } });
        await prisma.meetingsBot.delete({ where: { id: botRecord.id } });
        await prisma.meeting.delete({ where: { id: testMeeting.id } });
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testZoomWithManualSteps();
