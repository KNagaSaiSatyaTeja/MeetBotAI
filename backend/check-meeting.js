const puppeteer = require('puppeteer');

async function checkMeetingStatus() {
    console.log('🔍 Checking Zoom Meeting Status');
    console.log('Meeting ID: 930 4910 7200');
    console.log('Passcode: FMvt8B');
    console.log('='.repeat(40));
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    // Test different URL formats
    const urls = [
        'https://zoom.us/j/93049107200?pwd=FMvt8B',
        'https://zoom.us/wc/join/93049107200?pwd=FMvt8B',
        'https://zoom.us/j/93049107200?pwd=vr3jiUfybXiVCbQKzesTkUAbmBbWRP.1',
        'https://zoom.us/wc/join/93049107200?pwd=vr3jiUfybXiVCbQKzesTkUAbmBbWRP.1'
    ];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n🌐 Testing URL ${i + 1}: ${url.substring(0, 60)}...`);
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            
            const title = await page.title();
            const currentUrl = page.url();
            
            console.log(`   📄 Title: "${title}"`);
            console.log(`   🔗 Current URL: ${currentUrl.substring(0, 80)}...`);
            
            // Check page content
            const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
            
            const status = {
                hasJoin: bodyText.includes('join'),
                hasEnded: bodyText.includes('ended') || bodyText.includes('meeting has ended'),
                hasInvalid: bodyText.includes('invalid') || bodyText.includes('not found'),
                hasWaiting: bodyText.includes('waiting'),
                hasName: bodyText.includes('name'),
                hasPassword: bodyText.includes('password') || bodyText.includes('passcode')
            };
            
            console.log('   📊 Status:');
            console.log(`      Join available: ${status.hasJoin ? '✅' : '❌'}`);
            console.log(`      Meeting ended: ${status.hasEnded ? '❌' : '✅'}`);
            console.log(`      Invalid meeting: ${status.hasInvalid ? '❌' : '✅'}`);
            console.log(`      Waiting room: ${status.hasWaiting ? '⏳' : '➖'}`);
            console.log(`      Name input: ${status.hasName ? '✅' : '➖'}`);
            console.log(`      Password needed: ${status.hasPassword ? '🔐' : '➖'}`);
            
            // If this looks good, show more details
            if (status.hasJoin && !status.hasEnded && !status.hasInvalid) {
                console.log('\n   ✅ This URL appears to work!');
                
                // Look for input fields
                const inputs = await page.$$eval('input', inputs => 
                    inputs.map(input => ({
                        type: input.type,
                        placeholder: input.placeholder,
                        name: input.name,
                        id: input.id
                    }))
                );
                
                if (inputs.length > 0) {
                    console.log('   📝 Input fields found:');
                    inputs.forEach((input, idx) => {
                        console.log(`      ${idx + 1}. ${input.type} - "${input.placeholder}" (${input.name || input.id})`);
                    });
                }
                
                // Look for buttons
                const buttons = await page.$$eval('button', buttons => 
                    buttons.map(button => button.textContent?.trim()).filter(text => text && text.length > 0)
                );
                
                if (buttons.length > 0) {
                    console.log('   🔘 Buttons found:');
                    buttons.slice(0, 5).forEach((text, idx) => {
                        console.log(`      ${idx + 1}. "${text}"`);
                    });
                }
                
                break; // Stop testing other URLs
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await browser.close();
    console.log('🏁 Meeting status check complete');
}

checkMeetingStatus().catch(console.error);
