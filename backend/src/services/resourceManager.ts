import { EventEmitter } from 'events';
import { Browser, Page } from 'puppeteer';

export interface ResourceLimits {
    maxConcurrentBrowsers: number;
    maxConcurrentRecordings: number;
    maxMemoryUsageMB: number;
    browserTimeoutMs: number;
    recordingTimeoutMs: number;
}

export interface ActiveResource {
    id: string;
    type: 'browser' | 'recording';
    startTime: Date;
    memoryUsage?: number;
    browser?: Browser;
    page?: Page;
}

export class ResourceManager extends EventEmitter {
    private activeResources: Map<string, ActiveResource> = new Map();
    private resourceLimits: ResourceLimits;
    private resourceCounter = 0;

    constructor(limits?: Partial<ResourceLimits>) {
        super();
        this.resourceLimits = {
            maxConcurrentBrowsers: limits?.maxConcurrentBrowsers || 100,
            maxConcurrentRecordings: limits?.maxConcurrentRecordings || 200,
            maxMemoryUsageMB: limits?.maxMemoryUsageMB || 8192, // 8GB
            browserTimeoutMs: limits?.browserTimeoutMs || 30 * 60 * 1000, // 30 minutes
            recordingTimeoutMs: limits?.recordingTimeoutMs || 4 * 60 * 60 * 1000, // 4 hours
        };

        // Start cleanup interval
        setInterval(() => this.cleanupExpiredResources(), 60000); // Every minute
    }

    async acquireBrowser(): Promise<string> {
        const browserCount = Array.from(this.activeResources.values())
            .filter(r => r.type === 'browser').length;

        if (browserCount >= this.resourceLimits.maxConcurrentBrowsers) {
            throw new Error(`Maximum concurrent browsers (${this.resourceLimits.maxConcurrentBrowsers}) exceeded`);
        }

        const resourceId = `browser_${++this.resourceCounter}_${Date.now()}`;
        this.activeResources.set(resourceId, {
            id: resourceId,
            type: 'browser',
            startTime: new Date()
        });

        this.emit('resource.acquired', { type: 'browser', id: resourceId });
        return resourceId;
    }

    async acquireRecording(): Promise<string> {
        const recordingCount = Array.from(this.activeResources.values())
            .filter(r => r.type === 'recording').length;

        if (recordingCount >= this.resourceLimits.maxConcurrentRecordings) {
            throw new Error(`Maximum concurrent recordings (${this.resourceLimits.maxConcurrentRecordings}) exceeded`);
        }

        const resourceId = `recording_${++this.resourceCounter}_${Date.now()}`;
        this.activeResources.set(resourceId, {
            id: resourceId,
            type: 'recording',
            startTime: new Date()
        });

        this.emit('resource.acquired', { type: 'recording', id: resourceId });
        return resourceId;
    }

    releaseResource(resourceId: string): void {
        const resource = this.activeResources.get(resourceId);
        if (resource) {
            this.activeResources.delete(resourceId);
            this.emit('resource.released', { type: resource.type, id: resourceId });
        }
    }

    updateResource(resourceId: string, updates: Partial<ActiveResource>): void {
        const resource = this.activeResources.get(resourceId);
        if (resource) {
            Object.assign(resource, updates);
        }
    }

    getResourceStats() {
        const browsers = Array.from(this.activeResources.values())
            .filter(r => r.type === 'browser');
        const recordings = Array.from(this.activeResources.values())
            .filter(r => r.type === 'recording');

        return {
            activeBrowsers: browsers.length,
            activeRecordings: recordings.length,
            totalResources: this.activeResources.size,
            limits: this.resourceLimits,
            memoryUsage: this.getMemoryUsage()
        };
    }

    private cleanupExpiredResources(): void {
        const now = new Date();
        const expiredResources: string[] = [];

        for (const [id, resource] of this.activeResources) {
            const age = now.getTime() - resource.startTime.getTime();
            const maxAge = resource.type === 'browser'
                ? this.resourceLimits.browserTimeoutMs
                : this.resourceLimits.recordingTimeoutMs;

            if (age > maxAge) {
                expiredResources.push(id);
            }
        }

        for (const id of expiredResources) {
            const resource = this.activeResources.get(id);
            if (resource) {
                console.log(`🧹 Cleaning up expired ${resource.type} resource: ${id}`);

                // Clean up browser resources
                if (resource.browser) {
                    resource.browser.close().catch(console.error);
                }

                this.activeResources.delete(id);
                this.emit('resource.expired', { type: resource.type, id });
            }
        }
    }

    private getMemoryUsage(): number {
        const memUsage = process.memoryUsage();
        return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    }

    async checkResourceAvailability(): Promise<boolean> {
        const stats = this.getResourceStats();
        const memoryUsage = this.getMemoryUsage();

        return (
            stats.activeBrowsers < this.resourceLimits.maxConcurrentBrowsers &&
            stats.activeRecordings < this.resourceLimits.maxConcurrentRecordings &&
            memoryUsage < this.resourceLimits.maxMemoryUsageMB
        );
    }

    async waitForResourceAvailability(timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.checkResourceAvailability()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }

        return false;
    }
}

// Global resource manager instance
export const resourceManager = new ResourceManager();
