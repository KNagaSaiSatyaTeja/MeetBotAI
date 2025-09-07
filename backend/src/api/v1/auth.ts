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
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return reply.status(400).send({
                error: 'Supabase configuration missing',
                message: 'Supabase URL and API key are required',
                statusCode: 400
            });
        }

        try {
            // Use Supabase REST API to verify the token instead of JWKS
            const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
            });

            if (!response.ok) {
                fastify.log.error({ status: response.status, statusText: response.statusText }, 'Supabase user verification failed');
                return reply.status(401).send({
                    error: 'Invalid Supabase token',
                    message: 'The provided Supabase token is invalid or expired',
                    statusCode: 401
                });
            }

            const userData = await response.json();
            const email = userData.email;
            const sub = userData.id;

            if (!email || !sub) {
                return reply.status(401).send({
                    error: 'Invalid user data from Supabase',
                    message: 'User data from Supabase is missing required fields',
                    statusCode: 401
                });
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
                        name: userData.user_metadata?.full_name || userData.user_metadata?.name || email.split('@')[0],
                        role: 'ADMIN',
                        provider: 'supabase',
                        consentFlags: {},
                    },
                });
            }

            const token = generateJWT(user.id, user.orgId, '24h');
            return reply.send({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name
                }
            });
        } catch (error) {
            if ((error as any).statusCode) throw error as any;
            fastify.log.error(error, 'Supabase exchange failed');
            return reply.status(401).send({
                error: 'Supabase verification failed',
                message: 'Failed to verify Supabase token',
                statusCode: 401
            });
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
                return reply.status(409).send({
                    error: 'User already exists',
                    message: 'A user with this email already exists',
                    statusCode: 409
                });
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
                return reply.status(401).send({
                    error: 'Invalid credentials',
                    message: 'Invalid email or password',
                    statusCode: 401
                });
            }

            // Get password hash from passwordHash field
            if (!user.passwordHash) {
                return reply.status(401).send({
                    error: 'Invalid credentials',
                    message: 'Invalid email or password',
                    statusCode: 401
                });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return reply.status(401).send({
                    error: 'Invalid credentials',
                    message: 'Invalid email or password',
                    statusCode: 401
                });
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

    // Google OAuth callback handler
    fastify.post('/google/callback', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    state: { type: 'string' },
                },
                required: ['code'],
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
            summary: 'Google OAuth callback',
            description: 'Handles Google OAuth callback and creates/logs in user',
        },
    }, async (request: FastifyRequest<{
        Body: { code: string, state?: string }
    }>, reply: FastifyReply) => {
        const { code } = request.body;

        try {
            // Exchange code for tokens with Google
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/v1/auth/google/callback',
                }),
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to exchange code for tokens');
            }

            const tokens = await tokenResponse.json();

            // Get user info from Google
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
            });

            if (!userResponse.ok) {
                throw new Error('Failed to get user info from Google');
            }

            const googleUser = await userResponse.json();
            const { email, name, picture } = googleUser;

            if (!email) {
                return reply.status(400).send({
                    error: 'Email not provided by Google',
                    message: 'Google OAuth did not provide an email address',
                    statusCode: 400
                });
            }

            // Find or create user
            let user = await fastify.prisma.user.findUnique({ where: { email } });
            if (!user) {
                // Create organization for new user
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
                        name,
                        role: 'ADMIN',
                        provider: 'google',
                        consentFlags: {},
                        oauthTokens: {
                            google: {
                                access_token: tokens.access_token,
                                refresh_token: tokens.refresh_token,
                                expires_at: Date.now() + (tokens.expires_in * 1000),
                            },
                        },
                    },
                });

                fastify.log.info({ userId: user.id, email }, 'New user created via Google OAuth');
            } else {
                // Update existing user's OAuth tokens
                await fastify.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        oauthTokens: {
                            ...user.oauthTokens as any,
                            google: {
                                access_token: tokens.access_token,
                                refresh_token: tokens.refresh_token,
                                expires_at: Date.now() + (tokens.expires_in * 1000),
                            },
                        },
                    },
                });
            }

            const token = generateJWT(user.id, user.orgId, '24h');
            return reply.send({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name
                }
            });
        } catch (error) {
            fastify.log.error(error, 'Google OAuth callback failed');
            return reply.status(400).send({
                error: 'Google OAuth authentication failed',
                message: 'Failed to authenticate with Google OAuth',
                statusCode: 400
            });
        }
    });

    // Get Google OAuth URL
    fastify.get('/google/url', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    redirect_uri: { type: 'string', format: 'uri' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', format: 'uri' },
                        state: { type: 'string' },
                    },
                },
                400: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Get Google OAuth URL',
            description: 'Returns Google OAuth authorization URL for frontend redirect',
        },
    }, async (request: FastifyRequest<{
        Querystring: { redirect_uri?: string }
    }>, reply: FastifyReply) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = request.query.redirect_uri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/v1/auth/google/callback';

        if (!clientId) {
            return reply.status(400).send({
                error: 'Google OAuth not configured',
                message: 'Google OAuth credentials are not configured on the server',
                statusCode: 400
            });
        }

        const state = crypto.randomBytes(16).toString('hex');
        const scope = 'openid email profile';

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state,
        });

        const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        return reply.send({ url, state });
    });
}
