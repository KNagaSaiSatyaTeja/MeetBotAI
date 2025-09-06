import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import {
    CreateApiKeySchema,
    IdParamSchema,
    ErrorResponseSchema
} from './schemas';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';
import { generateJWT } from '../../middleware/auth';

export async function authRoutes(fastify: FastifyInstance) {
    // Supabase OAuth token exchange → backend JWT
    fastify.post('/supabase/exchange', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string' },
                },
                required: ['accessToken'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                role: { type: 'string' },
                            },
                        },
                    },
                },
                400: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Exchange Supabase access token for backend JWT',
        },
    }, async (request: FastifyRequest<{ Body: { accessToken: string } }>, reply: FastifyReply) => {
        const { accessToken } = request.body;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/certs` : undefined);

        if (!SUPABASE_JWKS_URL) {
            return reply.status(400).send({ error: 'Supabase configuration missing' });
        }

        try {
            const JWKS = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
            const { payload } = await jwtVerify(accessToken, JWKS);

            const email = (payload as any).email as string | undefined;
            const sub = (payload as any).sub as string | undefined;

            if (!email || !sub) {
                return reply.status(401).send({ error: 'Invalid Supabase token' });
            }

            // Find or create user/org
            let user = await fastify.prisma.user.findUnique({ where: { email } });
            if (!user) {
                const organization = await fastify.prisma.organization.create({
                    data: {
                        name: email.split('@')[1] || 'Personal',
                        plan: 'free',
                        region: 'us',
                        retentionDays: 30,
                    },
                });
                user = await fastify.prisma.user.create({
                    data: {
                        orgId: organization.id,
                        email,
                        role: 'ADMIN',
                        provider: 'supabase',
                        consentFlags: {},
                    },
                });
            }

            const token = generateJWT(user.id, user.orgId, '24h');
            return reply.send({ token, user: { id: user.id, email: user.email, role: user.role } });
        } catch (error) {
            if ((error as any).statusCode) throw error as any;
            fastify.log.error(error, 'Supabase exchange failed');
            return reply.status(401).send({ error: 'Supabase verification failed' });
        }
    });
    // User registration
    fastify.post('/register', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string', minLength: 1 },
                    companyName: { type: 'string' },
                },
                required: ['email', 'password', 'name'],
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                role: { type: 'string' },
                            },
                        },
                        message: { type: 'string' },
                    },
                },
                400: ErrorResponseSchema,
                409: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Register new user',
            description: 'Creates a new user account and organization',
        },
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { email, password, name, companyName } = request.body;

        try {
            // Check if user already exists
            const existingUser = await fastify.prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                return reply.status(409).send({ error: 'User already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Create user (no organization by default)
            const user = await fastify.prisma.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    name,
                    companyName: companyName || null,
                    role: 'USER', // Default role is USER, not ADMIN
                    provider: 'email',
                    isActive: true,
                },
            });

            return reply.status(201).send({
                success: true,
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
            });
        } catch (error: any) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to register user');
            throw new Error('Failed to register user');
        }
    });

    // User login
    fastify.post('/login', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                },
                required: ['email', 'password'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        token: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                role: { type: 'string' },
                            },
                        },
                    },
                },
                401: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'User login',
            description: 'Authenticates user with email and password',
        },
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { email, password } = request.body;

        try {
            // Find user
            const user = await fastify.prisma.user.findUnique({
                where: { email },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!user || !user.isActive) {
                return reply.status(401).send({ error: 'Invalid credentials' });
            }

            // Get password hash from passwordHash field
            if (!user.passwordHash) {
                return reply.status(401).send({ error: 'Invalid credentials' });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return reply.status(401).send({ error: 'Invalid credentials' });
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    sub: user.id,
                    orgId: user.orgId,
                    role: user.role,
                    iat: Math.floor(Date.now() / 1000),
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            return reply.send({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name,
                },
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Login failed');
            throw fastify.httpErrors.internalServerError('Login failed');
        }
    });

    // Create API token for user
    fastify.post('/tokens', {
        preHandler: [requireAuth],
        schema: {
            body: {
                type: 'object',
                properties: {
                    label: { type: 'string', minLength: 1 },
                },
                required: ['label'],
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        token: { type: 'string' },
                        label: { type: 'string' },
                        createdAt: { type: 'string' },
                    },
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Create API token',
            description: 'Creates a new API token for programmatic access',
        },
    }, async (request: FastifyRequest<{ Body: { label: string } }>, reply: FastifyReply) => {
        const { label } = request.body;

        try {
            // Generate API token
            const tokenPrefix = 'mbt_';
            const tokenBody = crypto.randomBytes(32).toString('hex');
            const apiToken = `${tokenPrefix}${tokenBody}`;

            // Hash the token for storage
            const hash = await bcrypt.hash(apiToken, 12);

            const tokenRecord = await fastify.prisma.apiToken.create({
                data: {
                    userId: request.user.id,
                    token: hash,
                    label,
                    status: 'active',
                },
            });

            return reply.status(201).send({
                id: tokenRecord.id,
                token: apiToken, // Only return the actual token on creation
                label: tokenRecord.label,
                createdAt: tokenRecord.createdAt.toISOString(),
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to create API token');
            throw fastify.httpErrors.internalServerError('Failed to create API token');
        }
    });

    // List API tokens for user
    fastify.get('/tokens', {
        preHandler: [requireAuth],
        schema: {
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            label: { type: 'string' },
                            status: { type: 'string' },
                            lastUsedAt: { type: 'string', nullable: true },
                            createdAt: { type: 'string' },
                            updatedAt: { type: 'string' },
                        },
                    },
                },
                401: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'List API tokens',
            description: 'Lists all API tokens for the user',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const apiTokens = await fastify.prisma.apiToken.findMany({
                where: { userId: request.user.id },
                select: {
                    id: true,
                    label: true,
                    status: true,
                    lastUsedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    // Don't select token hash for security
                },
                orderBy: { createdAt: 'desc' },
            });

            return reply.send(
                apiTokens.map(token => ({
                    ...token,
                    lastUsedAt: token.lastUsedAt?.toISOString() || null,
                    createdAt: token.createdAt.toISOString(),
                    updatedAt: token.updatedAt.toISOString(),
                }))
            );
        } catch (error) {
            fastify.log.error(error, 'Failed to list API tokens');
            throw fastify.httpErrors.internalServerError('Failed to list API tokens');
        }
    });

    // Revoke API token
    fastify.delete('/tokens/:id', {
        preHandler: [requireAuth],
        schema: {
            params: IdParamSchema,
            response: {
                204: { type: 'null' },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Revoke API token',
            description: 'Revokes an API token, making it unusable',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        try {
            // Verify API token exists and belongs to user
            const apiToken = await fastify.prisma.apiToken.findFirst({
                where: { id, userId: request.user.id },
            });

            if (!apiToken) {
                throw fastify.httpErrors.notFound('API token not found');
            }

            await fastify.prisma.apiToken.update({
                where: { id },
                data: { status: 'revoked' },
            });

            return reply.status(204).send();
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to revoke API token');
            throw fastify.httpErrors.internalServerError('Failed to revoke API token');
        }
    });

    // Get current user info (for web app)
    fastify.get('/me', {
        preHandler: [requireAuth],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                        organization: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                plan: { type: 'string' },
                                region: { type: 'string' },
                            },
                        },
                    },
                },
                401: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Get current user',
            description: 'Returns information about the authenticated user',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const user = await fastify.prisma.user.findUnique({
                where: { id: request.user.id },
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
                throw fastify.httpErrors.notFound('User not found');
            }

            return reply.send({
                id: user.id,
                email: user.email,
                role: user.role,
                organization: user.organization,
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to get user info');
            throw fastify.httpErrors.internalServerError('Failed to get user info');
        }
    });

    // OAuth callback handler (stub for Google/Microsoft)
    fastify.post('/oauth/callback', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    provider: { type: 'string', enum: ['google', 'microsoft'] },
                    code: { type: 'string' },
                    state: { type: 'string' },
                },
                required: ['provider', 'code'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                role: { type: 'string' },
                            },
                        },
                    },
                },
                400: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'OAuth callback',
            description: 'Handles OAuth callback from identity providers',
        },
    }, async (request: FastifyRequest<{
        Body: { provider: string, code: string, state?: string }
    }>, reply: FastifyReply) => {
        const { provider, code } = request.body;

        try {
            // TODO: Implement actual OAuth flow
            // This is a stub implementation
            fastify.log.info({ provider, code }, 'OAuth callback received');

            // For now, return a mock response
            throw fastify.httpErrors.notImplemented('OAuth integration not yet implemented');
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'OAuth callback failed');
            throw fastify.httpErrors.internalServerError('OAuth callback failed');
        }
    });
}
