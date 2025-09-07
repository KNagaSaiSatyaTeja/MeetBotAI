import { fastify } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import pino from 'pino';

// Middleware
import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbac';
import { observabilityMiddleware } from './middleware/observability';

// API Routes
import { meetingsRoutes } from './api/v1/meetings';
import { webhooksRoutes } from './api/v1/webhooks';
import { authRoutes } from './api/v1/auth';
import { adminRoutes } from './api/v1/admin';
import { searchRoutes } from './api/v1/search';
import { botRoutes } from './api/v1/bot';
import { b2bRoutes } from './api/v1/b2b';

// Job Queue
import { setupQueue, injectJobContext } from './jobs/queue';

// Services
import { resourceManager } from './services/resourceManager';
import { connectionPool } from './services/connectionPool';
import { botManager } from './services/botManager';

import dotenv from 'dotenv';

dotenv.config();

// Environment
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger
const logger = pino({
    level: NODE_ENV === 'development' ? 'debug' : 'info',
    transport: NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
        },
    } : undefined,
});

async function buildApp() {
    const app = fastify({
        logger,
        requestIdHeader: 'x-request-id',
        trustProxy: true,
    });

    // Initialize external services
    const prisma = new PrismaClient({
        log: NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });

    // Initialize Redis (optional for basic functionality)
    let redis: Redis | null = null;
    let jobQueue: any = null;

    try {
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            retryDelayOnFailover: 100,
            connectTimeout: 5000,
            enableReadyCheck: false,
        });

        // Test Redis connection with timeout
        await Promise.race([
            redis.ping(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout')), 3000)
            )
        ]);

        logger.info('Redis connected successfully');

        // Setup job queue
        jobQueue = await setupQueue(redis);
        injectJobContext(jobQueue, { redis, prisma });
        (global as any).__jobQueue = jobQueue;

        logger.info('Job queue initialized');
    } catch (error) {
        logger.warn('Redis connection failed - running without background jobs');
        if (redis) {
            redis.disconnect();
            redis = null;
        }
        jobQueue = null;
    }

    // Add services to fastify context
    app.decorate('prisma', prisma);
    app.decorate('redis', redis);
    app.decorate('jobQueue', jobQueue);

    // Register error handling
    await app.register(require('@fastify/sensible'));

    // Register plugins
    await app.register(require('@fastify/helmet'), {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
            },
        },
    });

    await app.register(require('@fastify/cors'), {
        origin: NODE_ENV === 'development' ? true : process.env.CORS_ORIGINS?.split(',') || false,
        credentials: true,
    });

    await app.register(require('@fastify/rate-limit'), {
        max: parseInt(process.env.API_RATE_LIMIT || '100', 10),
        timeWindow: '1 minute',
        keyGenerator: (req: any) => {
            const apiKey = req.headers['x-api-key'] as string;
            return apiKey || req.ip;
        },
    });

    await app.register(require('@fastify/multipart'), {
        limits: {
            fileSize: 500 * 1024 * 1024, // 500MB max file size
        },
    });

    // Swagger documentation
    if (process.env.ENABLE_SWAGGER === 'true') {
        await app.register(require('@fastify/swagger'), {
            openapi: {
                openapi: '3.0.0',
                info: {
                    title: 'AI Meeting Bot API',
                    description: 'Production-ready API for AI Meeting Bot with cross-platform support',
                    version: '1.0.0',
                },
                servers: [
                    {
                        url: `http://localhost:${PORT}`,
                        description: 'Development server',
                    },
                ],
                components: {
                    securitySchemes: {
                        ApiKeyAuth: {
                            type: 'apiKey',
                            in: 'header',
                            name: 'x-api-key',
                        },
                        BearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                        },
                    },
                },
                security: [
                    { ApiKeyAuth: [] },
                    { BearerAuth: [] },
                ],
            },
        });

        await app.register(require('@fastify/swagger-ui'), {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'full',
                deepLinking: false,
            },
        });
    }

    // Register middleware
    await app.register(observabilityMiddleware);
    await app.register(authMiddleware);
    await app.register(rbacMiddleware);

    // API Routes
    await app.register(meetingsRoutes, { prefix: '/v1' });
    await app.register(webhooksRoutes, { prefix: '/v1' });
    await app.register(authRoutes, { prefix: '/v1' });
    await app.register(adminRoutes, { prefix: '/v1/admin' });
    await app.register(searchRoutes, { prefix: '/v1' });
    await app.register(botRoutes, { prefix: '/v1/bot' });
    await app.register(b2bRoutes, { prefix: '/v1/b2b' });

    // Global error handler
    app.setErrorHandler(async (error, request, reply) => {
        const statusCode = error.statusCode || 500;

        app.log.error({
            error: error.message,
            stack: error.stack,
            url: request.url,
            method: request.method,
            headers: request.headers,
        }, 'Request error');

        if (statusCode >= 500) {
            return reply.status(statusCode).send({
                error: 'Internal Server Error',
                message: NODE_ENV === 'development' ? error.message : 'An internal error occurred',
                statusCode,
            });
        }

        return reply.status(statusCode).send({
            error: error.name || 'Error',
            message: error.message,
            statusCode,
        });
    });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
        process.on(signal, async () => {
            app.log.info(`Received ${signal}, shutting down gracefully...`);

            try {
                if (jobQueue) {
                    await jobQueue.close();
                }
                if (redis) {
                    await redis.quit();
                }
                await prisma.$disconnect();
                await app.close();
                process.exit(0);
            } catch (error) {
                app.log.error(error, 'Error during shutdown');
                process.exit(1);
            }
        });
    });

    return app;
}

async function start() {
    try {
        // Initialize services
        console.log('🔧 Initializing services...');
        await connectionPool.initialize();
        await botManager.start();
        console.log('✅ Services initialized');

        const app = await buildApp();

        await app.listen({
            port: PORT,
            host: HOST,
        });

        app.log.info(`🚀 AI Meeting Bot API running at http://${HOST}:${PORT}`);
        if (process.env.ENABLE_SWAGGER === 'true') {
            app.log.info(`📚 API documentation at http://${HOST}:${PORT}/docs`);
        }
        app.log.info(`📊 Metrics endpoint at http://${HOST}:${process.env.METRICS_PORT || '9464'}/metrics`);
        app.log.info(`🤖 Bot Manager: Ready for ${botManager.getBotStats().maxBots} concurrent bots`);

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start server if this file is run directly
if (require.main === module) {
    start();
}

export { buildApp };