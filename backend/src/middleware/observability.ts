import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

// Initialize OpenTelemetry (call once at app startup)
let telemetryInitialized = false;

export function initializeTelemetry() {
    if (telemetryInitialized) return;

    const sdk = new NodeSDK({
        instrumentations: [getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-express': {
                enabled: false, // We're using Fastify
            },
            '@opentelemetry/instrumentation-fastify': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-pg': {
                enabled: true,
            },
        })],
    });

    // Initialize Prometheus exporter
    const prometheusExporter = new PrometheusExporter({
        port: parseInt(process.env.METRICS_PORT || '9464', 10),
        endpoint: '/metrics',
    });

    try {
        sdk.start();
        telemetryInitialized = true;
        console.log('OpenTelemetry initialized successfully');
    } catch (error) {
        console.error('Failed to initialize OpenTelemetry:', error);
    }
}

// Observability middleware
export async function observabilityMiddleware(fastify: FastifyInstance) {
    // Request logging and metrics
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Add request ID if not present
        if (!request.headers['x-request-id']) {
            const requestId = generateRequestId();
            request.headers['x-request-id'] = requestId;
            reply.header('x-request-id', requestId);
        }

        // Start request timer
        request.startTime = Date.now();

        // Log request start
        request.log.info({
            method: request.method,
            url: request.url,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            userId: request.user?.id,
            orgId: request.user?.orgId,
        }, 'Request started');
    });

    // Response logging and metrics
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        const duration = Date.now() - (request.startTime || Date.now());

        // Log response
        request.log.info({
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            duration,
            userId: request.user?.id,
            orgId: request.user?.orgId,
            responseSize: reply.getHeader('content-length'),
        }, 'Request completed');

        // Update metrics (if Prometheus is available)
        updateMetrics(request, reply, duration);
    });

    // Error logging
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
        const duration = Date.now() - (request.startTime || Date.now());

        request.log.error({
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            method: request.method,
            url: request.url,
            duration,
            userId: request.user?.id,
            orgId: request.user?.orgId,
        }, 'Request error');

        // Update error metrics
        updateErrorMetrics(request, error);
    });

    // Health check endpoint
    fastify.get('/health', {
        schema: {
            tags: ['Health'],
            summary: 'Health check',
            description: 'Returns service health status',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string' },
                        uptime: { type: 'number' },
                        services: {
                            type: 'object',
                            properties: {
                                database: { type: 'string' },
                                redis: { type: 'string' },
                                storage: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const startTime = Date.now();
        const services: any = {};

        try {
            // Check database
            await fastify.prisma.$queryRaw`SELECT 1`;
            services.database = 'healthy';
        } catch (error) {
            services.database = 'unhealthy';
            request.log.error(error, 'Database health check failed');
        }

        try {
            // Check Redis
            await fastify.redis.ping();
            services.redis = 'healthy';
        } catch (error) {
            services.redis = 'unhealthy';
            request.log.error(error, 'Redis health check failed');
        }

        try {
            // Check storage (basic connectivity test)
            // This is a placeholder - implement based on your storage adapter
            services.storage = 'healthy';
        } catch (error) {
            services.storage = 'unhealthy';
            request.log.error(error, 'Storage health check failed');
        }

        const allHealthy = Object.values(services).every(status => status === 'healthy');
        const statusCode = allHealthy ? 200 : 503;

        const response = {
            status: allHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services,
            checkDuration: Date.now() - startTime,
        };

        return reply.status(statusCode).send(response);
    });

    // Readiness check endpoint
    fastify.get('/ready', {
        schema: {
            tags: ['Health'],
            summary: 'Readiness check',
            description: 'Returns service readiness status',
        },
    }, async (request, reply) => {
        try {
            // Check if all critical services are ready
            await fastify.prisma.$queryRaw`SELECT 1`;
            await fastify.redis.ping();

            return reply.send({
                status: 'ready',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            request.log.error(error, 'Readiness check failed');
            return reply.status(503).send({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                error: error.message,
            });
        }
    });

    // Liveness check endpoint
    fastify.get('/live', {
        schema: {
            tags: ['Health'],
            summary: 'Liveness check',
            description: 'Returns service liveness status',
        },
    }, async (request, reply) => {
        return reply.send({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });
}

// Extend FastifyRequest to include timing
declare module 'fastify' {
    interface FastifyRequest {
        startTime?: number;
    }
}

// Metrics tracking (in-memory counters for basic metrics)
const metrics = {
    requests: new Map<string, number>(),
    errors: new Map<string, number>(),
    durations: new Map<string, number[]>(),
};

function updateMetrics(request: FastifyRequest, reply: FastifyReply, duration: number) {
    const key = `${request.method} ${getRoutePattern(request.url)}`;
    const statusKey = `${key} ${reply.statusCode}`;

    // Update request counter
    metrics.requests.set(statusKey, (metrics.requests.get(statusKey) || 0) + 1);

    // Update duration tracking
    if (!metrics.durations.has(key)) {
        metrics.durations.set(key, []);
    }
    const durations = metrics.durations.get(key)!;
    durations.push(duration);

    // Keep only last 1000 durations for memory efficiency
    if (durations.length > 1000) {
        durations.splice(0, durations.length - 1000);
    }
}

function updateErrorMetrics(request: FastifyRequest, error: Error) {
    const key = `${request.method} ${getRoutePattern(request.url)} ${error.name}`;
    metrics.errors.set(key, (metrics.errors.get(key) || 0) + 1);
}

function getRoutePattern(url: string): string {
    // Simple route pattern extraction (replace IDs with placeholders)
    return url
        .replace(/\/[a-f0-9-]{8,}/g, '/:id') // Replace UUIDs/CUIDs with :id
        .replace(/\/\d+/g, '/:id') // Replace numeric IDs with :id
        .split('?')[0]; // Remove query parameters
}

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Audit logging helper
export function auditLog(
    fastify: FastifyInstance,
    orgId: string,
    actorId: string,
    actorType: 'USER' | 'API_KEY' | 'SYSTEM',
    action: string,
    metadata: Record<string, any> = {}
) {
    return fastify.prisma.auditLog.create({
        data: {
            orgId,
            actorId,
            actorType,
            action,
            metaJson: metadata,
        },
    });
}

// Performance monitoring helper
export function measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    logger?: any
): Promise<T> {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();

        try {
            const result = await fn();
            const duration = Date.now() - startTime;

            if (logger) {
                logger.info({ operation, duration }, 'Operation completed');
            }

            resolve(result);
        } catch (error) {
            const duration = Date.now() - startTime;

            if (logger) {
                logger.error({ operation, duration, error }, 'Operation failed');
            }

            reject(error);
        }
    });
}

// Export metrics for Prometheus scraping
export function getMetrics(): string {
    const lines: string[] = [];

    // Request metrics
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');

    for (const [key, count] of metrics.requests.entries()) {
        const [method, route, status] = key.split(' ');
        lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }

    // Error metrics
    lines.push('# HELP http_errors_total Total number of HTTP errors');
    lines.push('# TYPE http_errors_total counter');

    for (const [key, count] of metrics.errors.entries()) {
        const parts = key.split(' ');
        const method = parts[0];
        const route = parts[1];
        const errorType = parts.slice(2).join(' ');
        lines.push(`http_errors_total{method="${method}",route="${route}",error="${errorType}"} ${count}`);
    }

    // Duration metrics (simplified)
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');

    for (const [key, durations] of metrics.durations.entries()) {
        if (durations.length > 0) {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const [method, route] = key.split(' ');
            lines.push(`http_request_duration_seconds{method="${method}",route="${route}"} ${avg / 1000}`);
        }
    }

    return lines.join('\n');
}
