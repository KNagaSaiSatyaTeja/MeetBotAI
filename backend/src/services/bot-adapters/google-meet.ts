import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface GoogleMeetJoinConfig {
    meetingLink: string;
    displayName: string;
    audio: boolean;
}

export class GoogleMeetAdapter extends EventEmitter {
    private browser?: Browser;
    private page?: Page;
    private isJoined = false;

    async join(config: GoogleMeetJoinConfig): Promise<void> {
        try {
            this.emit('log', { level: 'INFO', event: 'gmeet.join.start', message: 'Starting Google Meet join process' });

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
                url.includes('googlesyndication')) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    private async navigateToMeeting(config: GoogleMeetJoinConfig): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        console.log(`🌐 Navigating to Google Meet: ${config.meetingLink}`);
        await this.page.goto(config.meetingLink, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    private async fillJoinForm(config: GoogleMeetJoinConfig): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            // Wait for the join form to appear
            await this.page.waitForSelector('input[data-promo-anchor-id="camera"]', { timeout: 10000 });

            // Turn off camera by default
            const cameraButton = await this.page.$('input[data-promo-anchor-id="camera"]');
            if (cameraButton) {
                const isChecked = await this.page.evaluate(el => el.checked, cameraButton);
                if (isChecked) {
                    await cameraButton.click();
                    console.log('📹 Camera turned off');
                }
            }

            // Turn off microphone by default
            const micButton = await this.page.$('input[data-promo-anchor-id="microphone"]');
            if (micButton) {
                const isChecked = await this.page.evaluate(el => el.checked, micButton);
                if (isChecked) {
                    await micButton.click();
                    console.log('🎤 Microphone turned off');
                }
            }

            // Enter display name if field exists
            const nameInput = await this.page.$('input[data-promo-anchor-id="name"]');
            if (nameInput) {
                await nameInput.clear();
                await nameInput.type(config.displayName);
                console.log(`👤 Display name set: ${config.displayName}`);
            }

            // Click join button
            const joinButton = await this.page.$('button[data-promo-anchor-id="join"]');
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
                'button[jsname="Qx7uuf"]',
                'button[data-promo-anchor-id="join"]',
                'button:contains("Join now")',
                'button:contains("Join")',
                '[role="button"]:contains("Join")'
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
            await this.page.waitForSelector('[data-is-muted]', { timeout: 30000 });
            console.log('✅ Meeting started successfully');
        } catch (error) {
            console.log('⚠️ Meeting start detection failed, continuing anyway');
        }
    }

    private async configureMeetingSettings(config: GoogleMeetJoinConfig): Promise<void> {
        if (!this.page) return;

        try {
            // Ensure microphone is muted
            const micButton = await this.page.$('[data-is-muted="false"]');
            if (micButton) {
                await micButton.click();
                console.log('🔇 Microphone muted');
            }

            // Ensure camera is off
            const cameraButton = await this.page.$('[data-is-muted="false"]');
            if (cameraButton) {
                await cameraButton.click();
                console.log('📹 Camera turned off');
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
                if (!currentUrl.includes('meet.google.com') ||
                    currentUrl.includes('ended') ||
                    currentUrl.includes('left')) {
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
                'button[data-promo-anchor-id="leave"]',
                'button:contains("Leave call")',
                'button:contains("Leave")',
                '[role="button"]:contains("Leave")'
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
