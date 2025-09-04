import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

dotenv.config({ path: './env.local' });

async function debugZoomMeeting() {
    console.log('🔍 Debug Zoom Meeting Access');
    console.log('='.repeat(50));

    const meetingId = '93049107200';
    const passcode = 'FMvt8B';

    // Try different URL formats
    const urls = [
        `https://zoom.us/j/${meetingId}?pwd=${passcode}`,
        `https://zoom.us/wc/join/${meetingId}?pwd=${passcode}`,
        `https://zoom.us/j/${meetingId}`,
        `https://zoom.us/wc/join/${meetingId}`
    ];

    console.log('📞 Meeting Details:');
    console.log(`   Meeting ID: ${meetingId}`);
    console.log(`   Passcode: ${passcode}`);

    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--autoplay-policy=no-user-gesture-required'
        ],
        defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n🌐 Testing URL ${i + 1}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

            // Wait a moment for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get page title and content
            const title = await page.title();
            const content = await page.content();

            console.log(`   📄 Page Title: "${title}"`);

            // Check for common messages
            const checks = [
                { text: 'meeting has ended', status: '❌ Meeting Ended' },
                { text: 'invalid meeting', status: '❌ Invalid Meeting' },
                { text: 'meeting not found', status: '❌ Meeting Not Found' },
                { text: 'join meeting', status: '✅ Join Available' },
                { text: 'enter your name', status: '✅ Name Input Found' },
                { text: 'waiting room', status: '⏳ Waiting Room' },
                { text: 'passcode', status: '🔐 Passcode Required' }
            ];

            console.log('   🔍 Page Analysis:');
            for (const check of checks) {
                if (content.toLowerCase().includes(check.text)) {
                    console.log(`      ${check.status}`);
                }
            }

            // Look for input fields
            const inputs = await page.$$eval('input', inputs =>
                inputs.map(input => ({
                    type: input.type,
                    name: input.name,
                    placeholder: input.placeholder,
                    id: input.id,
                    className: input.className
                }))
            );

            if (inputs.length > 0) {
                console.log('   📝 Input Fields Found:');
                inputs.forEach((input, idx) => {
                    console.log(`      ${idx + 1}. Type: ${input.type}, Name: ${input.name}, Placeholder: "${input.placeholder}"`);
                });
            }

            // Look for buttons
            const buttons = await page.$$eval('button', buttons =>
                buttons.map(button => ({
                    text: button.textContent?.trim(),
                    className: button.className,
                    id: button.id
                }))
            );

            if (buttons.length > 0) {
                console.log('   🔘 Buttons Found:');
                buttons.slice(0, 5).forEach((button, idx) => {
                    if (button.text) {
                        console.log(`      ${idx + 1}. "${button.text}"`);
                    }
                });
            }

            // If this looks like a working URL, stop here
            if (content.toLowerCase().includes('join') &&
                (content.toLowerCase().includes('meeting') || inputs.length > 0)) {
                console.log(`\n✅ Best URL found: ${url}`);
                break;
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        // Wait between attempts
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    await browser.close();
    console.log('🏁 Debug complete');
}

debugZoomMeeting().catch(console.error);
