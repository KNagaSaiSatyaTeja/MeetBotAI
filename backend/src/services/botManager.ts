import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { MeetingBot, MeetingBotConfig } from './meetingBot';
import { resourceManager } from './resourceManager';
import { connectionPool } from './connectionPool';

export interface BotManagerConfig {
    maxConcurrentBots: number;
    botTimeoutMs: number;
    cleanupIntervalMs: number;
    healthCheckIntervalMs: number;
}

export interface ActiveBot {
    id: string;
    meetingId: string;
    bot: MeetingBot;
    startTime: Date;
    lastActivity: Date;
    status: 'joining' | 'active' | 'ending' | 'failed';
    config: MeetingBotConfig;
}

export class BotManager extends EventEmitter {
    private activeBots: Map<string, ActiveBot> = new Map();
    private config: BotManagerConfig;
    private isRunning = false;
    private cleanupInterval?: NodeJS.Timeout;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(config?: Partial<BotManagerConfig>) {
        super();
        this.config = {
            maxConcurrentBots: config?.maxConcurrentBots || 1000,
            botTimeoutMs: config?.botTimeoutMs || 4 * 60 * 60 * 1000, // 4 hours
            cleanupIntervalMs: config?.cleanupIntervalMs || 60000, // 1 minute
            healthCheckIntervalMs: config?.healthCheckIntervalMs || 30000, // 30 seconds
        };
    }

    async start(): Promise<void> {
        if (this.isRunning) return;

        console.log('🚀 Starting Bot Manager...');
        console.log(`   Max concurrent bots: ${this.config.maxConcurrentBots}`);
        console.log(`   Bot timeout: ${this.config.botTimeoutMs / 1000 / 60} minutes`);
        console.log(`   Cleanup interval: ${this.config.cleanupIntervalMs / 1000} seconds`);

        this.isRunning = true;

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredBots();
        }, this.config.cleanupIntervalMs);

        // Start health check interval
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckIntervalMs);

        console.log('✅ Bot Manager started');
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;

        console.log('🛑 Stopping Bot Manager...');

        this.isRunning = false;

        // Clear intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // End all active bots
        const botPromises = Array.from(this.activeBots.values()).map(activeBot =>
            this.endBot(activeBot.id).catch(console.error)
        );

        await Promise.all(botPromises);

        console.log('✅ Bot Manager stopped');
    }

    async createBot(config: MeetingBotConfig): Promise<string> {
        if (this.activeBots.size >= this.config.maxConcurrentBots) {
            throw new Error(`Maximum concurrent bots (${this.config.maxConcurrentBots}) exceeded`);
        }

        // Check system resources
        const hasResources = await resourceManager.checkResourceAvailability();
        if (!hasResources) {
            throw new Error('System resources unavailable. Please try again later.');
        }

        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const prisma = await connectionPool.acquire();

        try {
            const bot = new MeetingBot(prisma);
            const meetingId = await bot.joinMeeting(config);

            const activeBot: ActiveBot = {
                id: botId,
                meetingId,
                bot,
                startTime: new Date(),
                lastActivity: new Date(),
                status: 'joining',
                config
            };

            this.activeBots.set(botId, activeBot);

            // Set up bot event listeners
            this.setupBotEventListeners(activeBot);

            this.emit('bot.created', { botId, meetingId });
            console.log(`✅ Bot created: ${botId} for meeting: ${meetingId}`);

            return botId;

        } catch (error) {
            connectionPool.release(prisma);
            throw error;
        }
    }

    async endBot(botId: string): Promise<void> {
        const activeBot = this.activeBots.get(botId);
        if (!activeBot) {
            console.log(`⚠️  Bot not found: ${botId}`);
            return;
        }

        try {
            activeBot.status = 'ending';
            await activeBot.bot.leaveMeeting();
            this.activeBots.delete(botId);
            this.emit('bot.ended', { botId, meetingId: activeBot.meetingId });
            console.log(`✅ Bot ended: ${botId}`);

        } catch (error) {
            console.error(`❌ Failed to end bot ${botId}:`, error);
            activeBot.status = 'failed';
            this.emit('bot.error', { botId, error });
        }
    }

    getBot(botId: string): ActiveBot | undefined {
        return this.activeBots.get(botId);
    }

    getBotStats() {
        const bots = Array.from(this.activeBots.values());
        const statusCounts = {
            joining: 0,
            active: 0,
            ending: 0,
            failed: 0
        };

        bots.forEach(bot => {
            statusCounts[bot.status]++;
        });

        return {
            totalBots: this.activeBots.size,
            maxBots: this.config.maxConcurrentBots,
            statusCounts,
            resourceStats: resourceManager.getResourceStats(),
            connectionStats: connectionPool.getStats()
        };
    }

    private setupBotEventListeners(activeBot: ActiveBot): void {
        const { bot, id: botId } = activeBot;

        bot.on('meeting.joined', (meetingId) => {
            activeBot.status = 'active';
            activeBot.lastActivity = new Date();
            this.emit('bot.joined', { botId, meetingId });
        });

        bot.on('meeting.ended', (meetingId) => {
            activeBot.status = 'ending';
            activeBot.lastActivity = new Date();
            this.emit('bot.meeting.ended', { botId, meetingId });

            // Remove bot after a short delay
            setTimeout(() => {
                this.activeBots.delete(botId);
            }, 5000);
        });

        bot.on('recording.started', (meetingId) => {
            activeBot.lastActivity = new Date();
            this.emit('bot.recording.started', { botId, meetingId });
        });

        bot.on('recording.stopped', (meetingId, filePath) => {
            activeBot.lastActivity = new Date();
            this.emit('bot.recording.stopped', { botId, meetingId, filePath });
        });

        bot.on('error', (error) => {
            activeBot.status = 'failed';
            activeBot.lastActivity = new Date();
            this.emit('bot.error', { botId, error });
        });
    }

    private cleanupExpiredBots(): void {
        const now = new Date();
        const expiredBots: string[] = [];

        for (const [botId, activeBot] of this.activeBots) {
            const age = now.getTime() - activeBot.startTime.getTime();

            if (age > this.config.botTimeoutMs) {
                expiredBots.push(botId);
            }
        }

        for (const botId of expiredBots) {
            console.log(`🧹 Cleaning up expired bot: ${botId}`);
            this.endBot(botId).catch(console.error);
        }

        if (expiredBots.length > 0) {
            console.log(`🧹 Cleaned up ${expiredBots.length} expired bots`);
        }
    }

    private performHealthCheck(): void {
        const stats = this.getBotStats();

        // Log health status
        if (stats.totalBots > 0) {
            console.log(`📊 Bot Manager Health: ${stats.totalBots}/${stats.maxBots} bots active`);
            console.log(`   Status: ${JSON.stringify(stats.statusCounts)}`);
            console.log(`   Resources: ${stats.resourceStats.activeBrowsers} browsers, ${stats.resourceStats.activeRecordings} recordings`);
        }

        // Check for resource issues
        if (stats.resourceStats.activeBrowsers > stats.resourceStats.limits.maxConcurrentBrowsers * 0.9) {
            console.log('⚠️  High browser resource usage detected');
        }

        if (stats.resourceStats.activeRecordings > stats.resourceStats.limits.maxConcurrentRecordings * 0.9) {
            console.log('⚠️  High recording resource usage detected');
        }
    }
}

// Global bot manager instance
export const botManager = new BotManager({
    maxConcurrentBots: 1000,
    botTimeoutMs: 4 * 60 * 60 * 1000, // 4 hours
    cleanupIntervalMs: 60000, // 1 minute
    healthCheckIntervalMs: 30000 // 30 seconds
});
