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
import { searchRoutes } from './api/v1/search';


// Job Queue
import { setupQueue } from './jobs/queue';
import dotenv from 'dotenv';

dotenv.config();

// Environment
const PORT = parseInt(process.env.PORT, 10);
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

    const redis = new Redis(process.env.REDIS_URL , {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null, // Fixed for BullMQ compatibility
        lazyConnect: true,
    });

    // Setup job queue
    const jobQueue = await setupQueue(redis);

    // Add services to fastify context
    app.decorate('prisma', prisma);
    app.decorate('redis', redis);
    app.decorate('jobQueue', jobQueue);

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
        max: parseInt(process.env.API_RATE_LIMIT , 10),
        timeWindow: '1 minute',
        keyGenerator: (req) => {
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
    await app.register(require('@fastify/swagger'), {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'AI Meeting Bot API',
                description: 'REST API for AI Meeting Bot - Transcription and Summarization',
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

    // Register middleware
    await app.register(observabilityMiddleware);
    await app.register(authMiddleware);
    await app.register(rbacMiddleware);

    // Health check is handled by observability middleware

    // API Routes
    await app.register(meetingsRoutes, { prefix: '/v1' });
    await app.register(webhooksRoutes, { prefix: '/v1' });
    await app.register(authRoutes, { prefix: '/v1' });
    await app.register(searchRoutes, { prefix: '/v1' });


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
            // Don't leak internal errors to client
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
                await jobQueue.close();
                await redis.quit();
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
        const app = await buildApp();

        await app.listen({
            port: PORT,
            host: HOST,
        });

        app.log.info(`🚀 Server running at http://${HOST}:${PORT}`);
        app.log.info(`📚 API documentation at http://${HOST}:${PORT}/docs`);
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
