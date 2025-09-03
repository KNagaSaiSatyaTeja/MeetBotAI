import { FastifyRequest, FastifyReply } from 'fastify';

// Rate limiting configuration
export const RATE_LIMITS = {
    // API endpoints
    'POST /v1/meetings': { max: 10, window: '1 minute' },
    'POST /v1/meetings/:id/recording': { max: 5, window: '1 minute' },
    'GET /v1/meetings': { max: 100, window: '1 minute' },
    'GET /v1/meetings/:id': { max: 200, window: '1 minute' },
    'GET /v1/search': { max: 50, window: '1 minute' },

    // Authentication endpoints
    'POST /v1/api-keys': { max: 5, window: '5 minutes' },
    'DELETE /v1/api-keys/:id': { max: 10, window: '5 minutes' },

    // Webhook endpoints
    'POST /v1/webhooks': { max: 10, window: '5 minutes' },
    'POST /v1/webhooks/:id/test': { max: 3, window: '1 minute' },

    // Default rate limit
    default: { max: 60, window: '1 minute' },
};

// Rate limit key generator
export function generateRateLimitKey(request: FastifyRequest): string {
    // Use API key if present, otherwise fall back to IP
    const apiKey = request.headers['x-api-key'] as string;

    if (apiKey) {
        // Extract key prefix for rate limiting (don't use full key for security)
        const keyPrefix = apiKey.substring(0, 12); // "sk-" + first 9 chars
        return `api_key:${keyPrefix}`;
    }

    // Use user ID if authenticated via JWT
    if (request.user?.type === 'user') {
        return `user:${request.user.id}`;
    }

    // Fall back to IP address
    return `ip:${request.ip}`;
}

// Get rate limit for specific route
export function getRateLimitForRoute(method: string, url: string): { max: number; window: string } {
    // Normalize URL by replacing IDs with placeholders
    const normalizedUrl = url
        .replace(/\/[a-f0-9-]{8,}/g, '/:id') // Replace UUIDs/CUIDs
        .replace(/\/\d+/g, '/:id') // Replace numeric IDs
        .split('?')[0]; // Remove query parameters

    const routeKey = `${method} ${normalizedUrl}`;

    return RATE_LIMITS[routeKey as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
}

// Rate limit error response builder
export function buildRateLimitError(max: number, window: string) {
    return {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${max} requests per ${window} allowed.`,
        statusCode: 429,
        retryAfter: window,
    };
}

// Custom rate limiter for specific use cases
export class CustomRateLimiter {
    private requests: Map<string, { count: number; resetTime: number }> = new Map();
    private max: number;
    private windowMs: number;

    constructor(max: number, windowMs: number) {
        this.max = max;
        this.windowMs = windowMs;

        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
        const now = Date.now();
        const entry = this.requests.get(key);

        if (!entry || now >= entry.resetTime) {
            // New window or expired entry
            const resetTime = now + this.windowMs;
            this.requests.set(key, { count: 1, resetTime });
            return { allowed: true, remaining: this.max - 1, resetTime };
        }

        if (entry.count >= this.max) {
            // Rate limit exceeded
            return { allowed: false, remaining: 0, resetTime: entry.resetTime };
        }

        // Increment counter
        entry.count++;
        this.requests.set(key, entry);

        return { allowed: true, remaining: this.max - entry.count, resetTime: entry.resetTime };
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.requests.entries()) {
            if (now >= entry.resetTime) {
                this.requests.delete(key);
            }
        }
    }
}

// Pre-configured rate limiters for specific use cases
export const uploadRateLimiter = new CustomRateLimiter(5, 60000); // 5 uploads per minute
export const searchRateLimiter = new CustomRateLimiter(50, 60000); // 50 searches per minute
export const webhookTestRateLimiter = new CustomRateLimiter(3, 60000); // 3 webhook tests per minute

// Middleware factory for custom rate limiting
export function createRateLimitMiddleware(limiter: CustomRateLimiter, keyGenerator?: (req: FastifyRequest) => string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const key = keyGenerator ? keyGenerator(request) : generateRateLimitKey(request);
        const result = limiter.check(key);

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', limiter['max']);
        reply.header('X-RateLimit-Remaining', result.remaining);
        reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

        if (!result.allowed) {
            reply.header('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
            throw request.server.httpErrors.tooManyRequests('Rate limit exceeded');
        }
    };
}
