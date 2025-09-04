import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface ZoomJoinConfig {
    meetingLink: string;
    displayName: string;
    audio: boolean;
    video: boolean;
    password?: string;
}

export class ZoomAdapter extends EventEmitter {
    private browser?: Browser;
    private page?: Page;
    private isJoined = false;

    async join(config: ZoomJoinConfig): Promise<void> {
        try {
            this.emit('log', { level: 'INFO', event: 'zoom.join.start', message: 'Starting Zoom join process' });

            await this.launchBrowser();
            await this.navigateToMeeting(config);
            await this.fillJoinForm(config);
            await this.waitForMeetingStart();
            await this.configureMeetingSettings(config);

            this.isJoined = true;
            this.emit('joined');

            // Monitor for meeting end
            this.monitorMeetingEnd();

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    private async launchBrowser(): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--autoplay-policy=no-user-gesture-required',
                '--use-fake-ui-for-media-stream',
                '--allow-file-access-from-files',
                '--use-fake-device-for-media-stream',
                '--disable-features=VizDisplayCompositor',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-extensions-file-access-check',
                '--disable-extensions-http-throttling'
            ],
            defaultViewport: { width: 1280, height: 720 }
        });

        this.page = await this.browser.newPage();

        // Set user agent to avoid bot detection and ensure web client
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Block desktop app downloads and redirects
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            const url = request.url();
            // Block Zoom desktop app downloads and redirects
            if (url.includes('zoom.us/client/') ||
                url.includes('download') ||
                url.includes('.exe') ||
                url.includes('.dmg') ||
                url.includes('.pkg') ||
                url.includes('zoominstaller')) {
                console.log('🚫 Blocked desktop app request:', url);
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    private async navigateToMeeting(config: ZoomJoinConfig): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        // Extract meeting ID and construct web client URL
        const zoomIdMatch = config.meetingLink.match(/zoom\.(?:us|com)\/(?:j|w)\/([0-9]{9,12})/i);
        const meetingId = zoomIdMatch?.[1];

        if (!meetingId) {
            throw new Error('Could not extract meeting ID from Zoom link');
        }

        // Force web client URL with parameters to avoid desktop app
        const pwdParam = config.password ? `?pwd=${encodeURIComponent(config.password)}` : '';
        const webClientUrl = `https://zoom.us/wc/join/${meetingId}${pwdParam}&uname=${encodeURIComponent(config.displayName)}&prefer=1&from=join`;

        console.log(`🌐 Navigating to WEB CLIENT: ${webClientUrl}`);
        console.log('🚫 Desktop app access blocked');

        // Add extra headers to ensure web client
        await this.page.setExtraHTTPHeaders({
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document'
        });

        await this.page.goto(webClientUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Handle any desktop app prompts
        await this.handleBrowserJoinPrompt();

        // Additional check for desktop app redirects
        const currentUrl = this.page.url();
        if (currentUrl.includes('download') || currentUrl.includes('client')) {
            console.log('🔄 Detected desktop app redirect, forcing web client...');
            await this.page.goto(`https://zoom.us/wc/join/${meetingId}${pwdParam}`, { waitUntil: 'networkidle2' });
        }
    }

    private async handleBrowserJoinPrompt(): Promise<void> {
        if (!this.page) return;

        try {
            await this.page.waitForSelector('a[href*="wc/join"], button', { timeout: 5000 });

            // Look for "Join from your browser" link
            const browserJoinLink = await this.page.$('a[href*="wc/join"]');
            if (browserJoinLink) {
                await browserJoinLink.click();
                await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
            }
        } catch (error) {
            // Continue if no browser join prompt found
        }
    }

    private async fillJoinForm(config: ZoomJoinConfig): Promise<void> {
        if (!this.page) return;

        try {
            // Wait for page to load completely
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Wait for join form or error message
            await Promise.race([
                this.page.waitForSelector('input, button', { timeout: 10000 }),
                this.page.waitForSelector('[class*="error"], [class*="invalid"]', { timeout: 5000 }).catch(() => { })
            ]);

            console.log('Filling display name...');
            // Fill display name
            const nameSelectors = [
                'input#inputname',
                'input[name="displayname"]',
                'input[placeholder*="name" i]',
                'input[aria-label*="name" i]',
                'input[type="text"]'
            ];

            let nameSet = false;
            for (const selector of nameSelectors) {
                try {
                    const nameInput = await this.page.$(selector);
                    if (nameInput) {
                        console.log(`Found name input with selector: ${selector}`);

                        // Try different ways to interact with the input
                        try {
                            await nameInput.click({ clickCount: 3 });
                        } catch (clickError) {
                            // If click fails, try focus instead
                            await nameInput.focus();
                            await this.page.keyboard.down('Control');
                            await this.page.keyboard.press('KeyA');
                            await this.page.keyboard.up('Control');
                        }

                        await new Promise(resolve => setTimeout(resolve, 500));
                        await nameInput.type(config.displayName);
                        nameSet = true;
                        break;
                    }
                } catch (error) {
                    console.log(`Failed to interact with ${selector}:`, error.message);
                    continue;
                }
            }

            if (!nameSet) {
                console.log('No name input found, continuing...');
            }

            // Fill passcode if required
            if (config.password) {
                console.log('Filling passcode...');
                const passcodeSelectors = [
                    'input#inputpasscode',
                    'input[type="password"]',
                    'input[name="password"]',
                    'input[placeholder*="password" i]',
                    'input[placeholder*="passcode" i]'
                ];

                for (const selector of passcodeSelectors) {
                    const passcodeInput = await this.page.$(selector);
                    if (passcodeInput) {
                        console.log(`Found passcode input with selector: ${selector}`);
                        await passcodeInput.type(config.password);
                        break;
                    }
                }
            }

            // Click Join button
            console.log('Clicking join button...');
            await this.clickJoinButton();

        } catch (error) {
            console.error('Error filling join form:', error);
            throw error;
        }
    }

    private async clickJoinButton(): Promise<void> {
        if (!this.page) return;

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        const joinSelectors = [
            'button#joinBtn',
            'button[type="submit"]',
            'button[aria-label*="join" i]',
            'input[type="submit"]',
            'button[class*="join" i]',
            'a[class*="join" i]'
        ];

        let joined = false;

        // Try specific selectors first
        for (const selector of joinSelectors) {
            try {
                const button = await this.page.$(selector);
                if (button) {
                    console.log(`Found join button with selector: ${selector}`);
                    await button.click();
                    joined = true;
                    break;
                }
            } catch (error) {
                continue;
            }
        }

        if (!joined) {
            // Fallback: search for button with "join" text (case insensitive)
            try {
                await this.clickByText('button', 'join');
                joined = true;
            } catch (error) {
                // Try other text variations
                const joinTexts = ['join meeting', 'join now', 'enter', 'continue'];
                for (const text of joinTexts) {
                    try {
                        await this.clickByText('button,a,input', text);
                        joined = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
            }
        }

        if (!joined) {
            // Last resort: press Enter key
            console.log('No join button found, pressing Enter key');
            await this.page.keyboard.press('Enter');
        }
    }

    private async waitForMeetingStart(): Promise<void> {
        if (!this.page) return;

        // Wait for meeting interface to load (reduced timeout, more selectors)
        try {
            await Promise.race([
                this.page.waitForSelector('button[aria-label*="leave" i]', { timeout: 15000 }),
                this.page.waitForSelector('.footer__leave-btn', { timeout: 15000 }),
                this.page.waitForSelector('[data-testid="leave-btn"]', { timeout: 15000 }),
                this.page.waitForSelector('div[role="toolbar"]', { timeout: 15000 }),
                this.page.waitForSelector('button[aria-label*="mute" i]', { timeout: 15000 }),
                this.page.waitForSelector('[data-testid="meeting-controls"]', { timeout: 15000 }),
                this.page.waitForFunction(() => {
                    const bodyText = document.body.innerText.toLowerCase();
                    return bodyText.includes('participants') || bodyText.includes('meeting');
                }, { timeout: 15000 })
            ]);
        } catch (error) {
            console.log('⏰ Meeting controls not found quickly, but proceeding anyway');
        }

        console.log('✅ Successfully joined Zoom meeting');
    }

    private async configureMeetingSettings(config: ZoomJoinConfig): Promise<void> {
        if (!this.page) return;

        try {
            console.log('🎛️ Configuring meeting settings...');

            // Join computer audio first
            await this.joinComputerAudio();

            // Wait a moment for UI to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // ALWAYS ensure microphone is muted (bot should be silent)
            console.log('🔇 Muting microphone...');
            await this.muteMicrophone();

            // ALWAYS ensure video is off (bot should be invisible)
            console.log('📹 Turning off video...');
            await this.turnOffVideo();

            // Double-check after a moment
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.muteMicrophone();
            await this.turnOffVideo();

            console.log('✅ Meeting settings configured: Audio OFF, Video OFF');

        } catch (error) {
            console.warn('Some meeting settings could not be configured:', error);
        }
    }

    private async joinComputerAudio(): Promise<void> {
        if (!this.page) return;

        try {
            const audioButtons = [
                'button[aria-label*="join audio" i]',
                'button[aria-label*="computer audio" i]'
            ];

            for (const selector of audioButtons) {
                const button = await this.page.$(selector);
                if (button) {
                    await button.click();
                    await this.page.waitForTimeout(2000);
                    return;
                }
            }

            // Fallback: click by text
            await this.clickByText('button', 'join audio').catch(() => { });
            await this.clickByText('button', 'join with computer audio').catch(() => { });

        } catch (error) {
            console.warn('Could not join computer audio:', error);
        }
    }

    private async muteMicrophone(): Promise<void> {
        if (!this.page) return;

        try {
            // Multiple selectors to find mute button
            const micSelectors = [
                'button[aria-label*="mute" i]',
                'button[aria-label*="unmute" i]',
                'button[data-tooltip*="mute" i]',
                'button[title*="mute" i]',
                '[role="button"][aria-label*="microphone" i]',
                '.footer-button__wrapper button[aria-label*="audio" i]',
                'button[class*="mic"]',
                'button[class*="audio"]'
            ];

            for (const selector of micSelectors) {
                const buttons = await this.page.$$(selector);

                for (const button of buttons) {
                    const ariaLabel = await this.page.evaluate(el =>
                        el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '',
                        button
                    );

                    const labelLower = ariaLabel.toLowerCase();

                    // If button says "unmute", mic is muted (good!)
                    // If button says "mute", mic is unmuted (need to click!)
                    if (labelLower.includes('mute') && !labelLower.includes('unmute')) {
                        console.log(`🔇 Clicking mute button: "${ariaLabel}"`);
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return;
                    }
                }
            }

            console.log('🔇 Microphone appears to already be muted');

        } catch (error) {
            console.warn('Could not mute microphone:', error);
        }
    }

    private async turnOffVideo(): Promise<void> {
        if (!this.page) return;

        try {
            // Multiple selectors to find video button
            const videoSelectors = [
                'button[aria-label*="video" i]',
                'button[aria-label*="camera" i]',
                'button[data-tooltip*="video" i]',
                'button[title*="video" i]',
                '[role="button"][aria-label*="camera" i]',
                '.footer-button__wrapper button[aria-label*="video" i]',
                'button[class*="video"]',
                'button[class*="camera"]'
            ];

            for (const selector of videoSelectors) {
                const buttons = await this.page.$$(selector);

                for (const button of buttons) {
                    const ariaLabel = await this.page.evaluate(el =>
                        el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '',
                        button
                    );

                    const labelLower = ariaLabel.toLowerCase();

                    // If button says "start video", video is off (good!)
                    // If button says "stop video", video is on (need to click!)
                    if (labelLower.includes('stop video') ||
                        labelLower.includes('turn off video') ||
                        labelLower.includes('disable video')) {
                        console.log(`📹 Clicking stop video button: "${ariaLabel}"`);
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return;
                    }
                }
            }

            console.log('📹 Video appears to already be off');

        } catch (error) {
            console.warn('Could not turn off video:', error);
        }
    }

    private async monitorMeetingEnd(): Promise<void> {
        if (!this.page) return;

        try {
            console.log('🔍 Monitoring for meeting end...');

            // Monitor for meeting end indicators with comprehensive checks
            await this.page.waitForFunction(
                () => {
                    const bodyText = document.body.innerText.toLowerCase();
                    const titleText = document.title.toLowerCase();
                    const url = window.location.href.toLowerCase();

                    // Check for various end meeting indicators
                    const endIndicators = [
                        'meeting has ended',
                        'host has ended',
                        'meeting ended',
                        'meeting is over',
                        'session has ended',
                        'meeting concluded',
                        'disconnected from meeting',
                        'left the meeting',
                        'the meeting has been ended by the host',
                        'you have left the meeting',
                        'meeting disconnected',
                        'connection lost',
                        'meeting timeout',
                        'session expired',
                        'thank you for joining',
                        'goodbye',
                        'meeting closed'
                    ];

                    // Also check if we're redirected away from meeting
                    const urlEndIndicators = [
                        '/success',
                        '/end',
                        '/leave',
                        '/goodbye',
                        '/thanks'
                    ];

                    // Check if page elements indicate meeting ended
                    const joinButton = document.querySelector('button[class*="join"]');
                    const meetingEndedElements = document.querySelectorAll('[class*="ended"], [class*="closed"], [class*="finished"]');

                    return endIndicators.some(indicator =>
                        bodyText.includes(indicator) || titleText.includes(indicator)
                    ) ||
                        urlEndIndicators.some(indicator => url.includes(indicator)) ||
                        (joinButton && bodyText.includes('join')) ||
                        meetingEndedElements.length > 0;
                },
                { timeout: 0, polling: 2000 } // Check every 2 seconds
            );

            console.log('🏁 Meeting end detected');
            this.emit('left');

        } catch (error) {
            console.error('Error monitoring meeting end:', error);
            this.emit('error', error);
        }
    }

    private async clickByText(selector: string, text: string, timeout = 5000): Promise<void> {
        if (!this.page) return;

        const elements = await this.page.$$(selector);
        const searchText = text.toLowerCase();

        for (const element of elements) {
            const elementText = await this.page.evaluate(el => {
                return el.textContent || el.getAttribute('aria-label') || '';
            }, element);

            if (elementText.toLowerCase().includes(searchText)) {
                await element.click();
                return;
            }
        }

        throw new Error(`Element with text "${text}" not found`);
    }

    async leave(): Promise<void> {
        try {
            if (this.page && this.isJoined) {
                // Try to leave gracefully first
                await this.clickByText('button', 'leave').catch(() => { });
                await this.page.waitForTimeout(2000);
            }
        } catch (error) {
            console.warn('Error during graceful leave:', error);
        } finally {
            await this.cleanup();
        }
    }

    private async cleanup(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = undefined;
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = undefined;
            }

            this.isJoined = false;
            this.emit('left');

        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}