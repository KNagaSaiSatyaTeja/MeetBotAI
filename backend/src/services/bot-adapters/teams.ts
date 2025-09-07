import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface TeamsJoinConfig {
    meetingLink: string;
    displayName: string;
    audio: boolean;
}

export class TeamsAdapter extends EventEmitter {
    private browser?: Browser;
    private page?: Page;
    private isJoined = false;

    async join(config: TeamsJoinConfig): Promise<void> {
        try {
            this.emit('log', { level: 'INFO', event: 'teams.join.start', message: 'Starting Microsoft Teams join process' });

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
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-extensions-file-access-check',
                '--disable-extensions-http-throttling'
            ],
            defaultViewport: { width: 1280, height: 720 }
        });

        this.page = await this.browser.newPage();

        // Set user agent to avoid bot detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Block unnecessary requests
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            const url = request.url();
            // Block analytics and tracking
            if (url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('doubleclick') ||
                url.includes('googlesyndication') ||
                url.includes('microsoft.com/analytics')) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    private async navigateToMeeting(config: TeamsJoinConfig): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        console.log(`🌐 Navigating to Microsoft Teams: ${config.meetingLink}`);
        await this.page.goto(config.meetingLink, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    private async fillJoinForm(config: TeamsJoinConfig): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            // Wait for the join form to appear
            await this.page.waitForSelector('input[data-tid="prejoin-display-name-input"]', { timeout: 15000 });

            // Enter display name
            const nameInput = await this.page.$('input[data-tid="prejoin-display-name-input"]');
            if (nameInput) {
                await nameInput.clear();
                await nameInput.type(config.displayName);
                console.log(`👤 Display name set: ${config.displayName}`);
            }

            // Turn off camera by default
            const cameraButton = await this.page.$('button[data-tid="prejoin-camera-button"]');
            if (cameraButton) {
                const isActive = await this.page.evaluate(el => el.getAttribute('data-is-camera-on') === 'true', cameraButton);
                if (isActive) {
                    await cameraButton.click();
                    console.log('📹 Camera turned off');
                }
            }

            // Turn off microphone by default
            const micButton = await this.page.$('button[data-tid="prejoin-microphone-button"]');
            if (micButton) {
                const isActive = await this.page.evaluate(el => el.getAttribute('data-is-mic-on') === 'true', micButton);
                if (isActive) {
                    await micButton.click();
                    console.log('🎤 Microphone turned off');
                }
            }

            // Click join button
            const joinButton = await this.page.$('button[data-tid="prejoin-join-button"]');
            if (joinButton) {
                await joinButton.click();
                console.log('🚀 Join button clicked');
            }

        } catch (error) {
            console.log('⚠️ Join form handling failed, trying alternative approach:', error);
            // Try alternative selectors or direct join
            await this.tryAlternativeJoin();
        }
    }

    private async tryAlternativeJoin(): Promise<void> {
        if (!this.page) return;

        try {
            // Look for any join button
            const joinSelectors = [
                'button[data-tid="prejoin-join-button"]',
                'button:contains("Join now")',
                'button:contains("Join")',
                '[role="button"]:contains("Join")',
                'button[aria-label*="Join"]'
            ];

            for (const selector of joinSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        await button.click();
                        console.log(`✅ Found and clicked join button with selector: ${selector}`);
                        return;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            // If no button found, try pressing Enter
            await this.page.keyboard.press('Enter');
            console.log('⌨️ Pressed Enter to join');

        } catch (error) {
            console.log('❌ Alternative join failed:', error);
        }
    }

    private async waitForMeetingStart(): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            // Wait for meeting to start - look for meeting controls
            await this.page.waitForSelector('[data-tid="call-controls"]', { timeout: 30000 });
            console.log('✅ Meeting started successfully');
        } catch (error) {
            console.log('⚠️ Meeting start detection failed, continuing anyway');
        }
    }

    private async configureMeetingSettings(config: TeamsJoinConfig): Promise<void> {
        if (!this.page) return;

        try {
            // Ensure microphone is muted
            const micButton = await this.page.$('button[data-tid="call-controls-mute-button"]');
            if (micButton) {
                const isMuted = await this.page.evaluate(el => el.getAttribute('data-is-muted') === 'true', micButton);
                if (!isMuted) {
                    await micButton.click();
                    console.log('🔇 Microphone muted');
                }
            }

            // Ensure camera is off
            const cameraButton = await this.page.$('button[data-tid="call-controls-camera-button"]');
            if (cameraButton) {
                const isCameraOn = await this.page.evaluate(el => el.getAttribute('data-is-camera-on') === 'true', cameraButton);
                if (isCameraOn) {
                    await cameraButton.click();
                    console.log('📹 Camera turned off');
                }
            }

        } catch (error) {
            console.log('⚠️ Meeting settings configuration failed:', error);
        }
    }

    private monitorMeetingEnd(): void {
        if (!this.page) return;

        // Monitor for meeting end indicators
        const checkInterval = setInterval(async () => {
            try {
                if (!this.page || this.page.isClosed()) {
                    clearInterval(checkInterval);
                    this.emit('left');
                    return;
                }

                // Check if we're still in the meeting
                const currentUrl = this.page.url();
                if (!currentUrl.includes('teams.microsoft.com') ||
                    currentUrl.includes('ended') ||
                    currentUrl.includes('left') ||
                    currentUrl.includes('call-ended')) {
                    clearInterval(checkInterval);
                    this.emit('left');
                }

            } catch (error) {
                console.log('❌ Meeting monitoring error:', error);
                clearInterval(checkInterval);
                this.emit('left');
            }
        }, 5000);

        // Clean up interval when bot is destroyed
        this.once('destroyed', () => {
            clearInterval(checkInterval);
        });
    }

    async leave(): Promise<void> {
        if (!this.page || !this.isJoined) return;

        try {
            // Look for leave button
            const leaveSelectors = [
                'button[data-tid="call-controls-hangup-button"]',
                'button:contains("Leave")',
                'button:contains("End call")',
                '[role="button"]:contains("Leave")',
                'button[aria-label*="Leave"]'
            ];

            for (const selector of leaveSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        await button.click();
                        console.log('👋 Left meeting');
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

        } catch (error) {
            console.log('❌ Leave meeting failed:', error);
        } finally {
            await this.cleanup();
        }
    }

    async cleanup(): Promise<void> {
        this.isJoined = false;
        this.emit('destroyed');

        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }
        this.page = undefined;
    }

    isActive(): boolean {
        return this.isJoined;
    }
}
