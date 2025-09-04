const fetch = require('node-fetch');

async function testBotAPI() {
    console.log('🚀 Testing Meeting Bot API');
    console.log('='.repeat(40));
    
    const baseUrl = 'http://localhost:5000';
    const meetingLink = 'https://zoom.us/j/93049107200?pwd=FMvt8B';
    
    // Test API endpoints
    const tests = [
        {
            name: 'Health Check',
            method: 'GET',
            url: `${baseUrl}/health`,
            headers: {}
        },
        {
            name: 'Join Meeting',
            method: 'POST',
            url: `${baseUrl}/v1/bot/join`,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-key-123'
            },
            body: JSON.stringify({
                meetingLink: meetingLink,
                title: 'Live Test Meeting',
                displayName: 'Ping Me',
                passcode: 'FMvt8B',
                consentFlags: {
                    recording: true,
                    transcription: true,
                    summary: true
                }
            })
        },
        {
            name: 'Bot Status',
            method: 'GET',
            url: `${baseUrl}/v1/bot/status`,
            headers: {
                'x-api-key': 'test-key-123'
            }
        }
    ];
    
    for (const test of tests) {
        console.log(`\n📡 ${test.name}:`);
        console.log(`   ${test.method} ${test.url}`);
        
        try {
            const options = {
                method: test.method,
                headers: test.headers
            };
            
            if (test.body) {
                options.body = test.body;
            }
            
            const response = await fetch(test.url, options);
            const data = await response.text();
            
            console.log(`   Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                try {
                    const json = JSON.parse(data);
                    console.log(`   Response:`, JSON.stringify(json, null, 2));
                } catch (e) {
                    console.log(`   Response: ${data}`);
                }
            } else {
                console.log(`   Error: ${data}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
            if (test.name === 'Health Check') {
                console.log('   💡 Make sure the server is running: npm run dev');
            }
        }
    }
    
    console.log('\n✅ API test complete');
}

testBotAPI();
