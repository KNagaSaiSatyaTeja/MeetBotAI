import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Extend FastifyRequest to include user
declare module 'fastify' {
    interface FastifyRequest {
        user: {
            id: string;
            orgId: string;
            role: string;
            email: string;
            type: 'user' | 'api_key' | 'api_token';
            scopes?: string[];
        };
    }
}

export async function authMiddleware(fastify: FastifyInstance) {
    // Register auth decorator
    fastify.decorateRequest('user', null);
}

// Authentication middleware - validates API token, API key, or JWT token
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers['x-api-key'] as string;
    const authHeader = request.headers.authorization as string;

    try {
        if (apiKey) {
            // Check if it's a user API token or organization API key
            if (apiKey.startsWith('mbt_')) {
                // User API token authentication
                await authenticateApiToken(request, reply, apiKey);
            } else {
                // Organization API Key authentication
                await authenticateApiKey(request, reply, apiKey);
            }
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            // JWT authentication
            const token = authHeader.substring(7);
            await authenticateJWT(request, reply, token);
        } else {
            throw request.server.httpErrors.unauthorized('Authentication required');
        }
    } catch (error) {
        if (error.statusCode) throw error;
        request.log.error(error, 'Authentication failed');
        throw request.server.httpErrors.unauthorized('Invalid authentication credentials');
    }
}

// Organization access middleware - ensures user belongs to the org
export async function requireOrgAccess(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
        throw request.server.httpErrors.unauthorized('Authentication required');
    }

    // For API keys, org access is already validated during auth
    // For users, we need to ensure they belong to the org
    if (request.user.type === 'user') {
        const user = await request.server.prisma.user.findUnique({
            where: { id: request.user.id },
            select: { orgId: true, role: true },
        });

        if (!user || user.orgId !== request.user.orgId) {
            throw request.server.httpErrors.forbidden('Access denied to organization');
        }
    }
}

// Admin role middleware
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
        throw request.server.httpErrors.unauthorized('Authentication required');
    }

    if (request.user.role !== 'ADMIN') {
        throw request.server.httpErrors.forbidden('Admin access required');
    }
}

// Scope-based authorization middleware
export function requireScope(requiredScope: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            throw request.server.httpErrors.unauthorized('Authentication required');
        }

        // Users with ADMIN role have all scopes
        if (request.user.role === 'ADMIN') {
            return;
        }

        // Check API key scopes
        if (request.user.type === 'api_key' && request.user.scopes) {
            const hasScope = request.user.scopes.includes(requiredScope) ||
                request.user.scopes.includes('*'); // Wildcard scope

            if (!hasScope) {
                throw request.server.httpErrors.forbidden(`Scope '${requiredScope}' required`);
            }
        }
    };
}

// Helper function to authenticate user API token
async function authenticateApiToken(request: FastifyRequest, reply: FastifyReply, apiToken: string) {
    if (!apiToken.startsWith('mbt_') || apiToken.length < 10) {
        throw request.server.httpErrors.unauthorized('Invalid API token format');
    }

    // Find API token by hash
    const tokens = await request.server.prisma.apiToken.findMany({
        where: { status: 'active' },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                },
            },
        },
    });

    let matchedToken = null;

    // Check each API token hash (constant time comparison)
    for (const token of tokens) {
        const isValid = await bcrypt.compare(apiToken, token.token);
        if (isValid) {
            matchedToken = token;
            break;
        }
    }

    if (!matchedToken || !matchedToken.user.isActive) {
        throw request.server.httpErrors.unauthorized('Invalid API token');
    }

    // Update last used timestamp
    await request.server.prisma.apiToken.update({
        where: { id: matchedToken.id },
        data: { lastUsedAt: new Date() },
    });

    // Set user context
    request.user = {
        id: matchedToken.user.id,
        orgId: matchedToken.user.orgId || '',
        role: matchedToken.user.role,
        email: matchedToken.user.email,
        type: 'api_token',
    };

    // Log API token usage
    request.log.info({
        tokenId: matchedToken.id,
        userId: matchedToken.user.id,
        userEmail: matchedToken.user.email,
        label: matchedToken.label,
    }, 'API token authentication successful');
}

// Helper function to authenticate API key
async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply, apiKey: string) {
    if (!apiKey.startsWith('sk-') || apiKey.length < 10) {
        throw request.server.httpErrors.unauthorized('Invalid API key format');
    }

    // Find API key by hash
    const apiKeys = await request.server.prisma.apiKey.findMany({
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    plan: true,
                    region: true,
                },
            },
        },
    });

    let matchedApiKey = null;

    // Check each API key hash (constant time comparison)
    for (const key of apiKeys) {
        const isValid = await bcrypt.compare(apiKey, key.hash);
        if (isValid) {
            matchedApiKey = key;
            break;
        }
    }

    if (!matchedApiKey) {
        throw request.server.httpErrors.unauthorized('Invalid API key');
    }

    // Update last used timestamp
    await request.server.prisma.apiKey.update({
        where: { id: matchedApiKey.id },
        data: { lastUsedAt: new Date() },
    });

    // Set user context
    request.user = {
        id: matchedApiKey.id,
        orgId: matchedApiKey.orgId,
        role: 'SERVICE', // API keys are service accounts
        email: `api-key-${matchedApiKey.id}@system.local`,
        type: 'api_key',
        scopes: matchedApiKey.scopes,
    };

    // Log API key usage
    request.log.info({
        apiKeyId: matchedApiKey.id,
        orgId: matchedApiKey.orgId,
        label: matchedApiKey.label,
        scopes: matchedApiKey.scopes,
    }, 'API key authentication successful');
}

// Helper function to authenticate JWT token
async function authenticateJWT(request: FastifyRequest, reply: FastifyReply, token: string) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        throw request.server.httpErrors.internalServerError('JWT secret not configured');
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;

        if (!payload.sub) {
            throw request.server.httpErrors.unauthorized('Invalid token payload');
        }

        // Verify user still exists and is active
        const user = await request.server.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        plan: true,
                        region: true,
                    },
                },
            },
        });

        if (!user) {
            throw request.server.httpErrors.unauthorized('User not found');
        }

        if (user.orgId !== payload.orgId) {
            throw request.server.httpErrors.unauthorized('Token organization mismatch');
        }

        // Set user context
        request.user = {
            id: user.id,
            orgId: user.orgId,
            role: user.role,
            email: user.email,
            type: 'user',
        };

        request.log.info({
            userId: user.id,
            orgId: user.orgId,
            role: user.role,
            email: user.email,
        }, 'JWT authentication successful');
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw request.server.httpErrors.unauthorized('Invalid token');
        }
        if (error.name === 'TokenExpiredError') {
            throw request.server.httpErrors.unauthorized('Token expired');
        }
        throw error;
    }
}

// Helper function to generate JWT token
export function generateJWT(userId: string, orgId: string, expiresIn = '24h'): string {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        throw new Error('JWT secret not configured');
    }

    return jwt.sign(
        {
            sub: userId,
            orgId,
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn }
    );
}

// Rate limiting per API key/user
export function createRateLimiter(requestsPerMinute = 60) {
    return {
        max: requestsPerMinute,
        timeWindow: '1 minute',
        keyGenerator: (req: FastifyRequest) => {
            if (req.user) {
                return `${req.user.type}:${req.user.id}`;
            }
            return req.ip; // Fallback to IP for unauthenticated requests
        },
        errorResponseBuilder: () => ({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Maximum ${requestsPerMinute} requests per minute allowed.`,
            statusCode: 429,
        }),
    };
}
