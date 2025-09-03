import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
    CreateApiKeySchema,
    IdParamSchema,
    ErrorResponseSchema
} from './schemas';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';

export async function authRoutes(fastify: FastifyInstance) {
    // Create API key
    fastify.post('/api-keys', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            body: CreateApiKeySchema,
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        key: { type: 'string' },
                        label: { type: 'string' },
                        scopes: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string' },
                    },
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Create API key',
            description: 'Creates a new API key for programmatic access',
        },
    }, async (request: FastifyRequest<{ Body: typeof CreateApiKeySchema._type }>, reply: FastifyReply) => {
        const { orgId } = request.user;
        const { label, scopes } = request.body;

        try {
            // Generate API key
            const keyPrefix = 'sk-';
            const keyBody = crypto.randomBytes(32).toString('hex');
            const apiKey = `${keyPrefix}${keyBody}`;

            // Hash the key for storage
            const hash = await bcrypt.hash(apiKey, 12);

            const apiKeyRecord = await fastify.prisma.apiKey.create({
                data: {
                    orgId,
                    hash,
                    label,
                    scopes,
                },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'api_key.created',
                    metaJson: {
                        apiKeyId: apiKeyRecord.id,
                        label,
                        scopes,
                        keyPrefix: `${keyPrefix}****${keyBody.slice(-4)}`,
                    },
                },
            });

            return reply.status(201).send({
                id: apiKeyRecord.id,
                key: apiKey, // Only return the actual key on creation
                label: apiKeyRecord.label,
                scopes: apiKeyRecord.scopes,
                createdAt: apiKeyRecord.createdAt.toISOString(),
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to create API key');
            throw fastify.httpErrors.internalServerError('Failed to create API key');
        }
    });

    // List API keys
    fastify.get('/api-keys', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            label: { type: 'string' },
                            scopes: { type: 'array', items: { type: 'string' } },
                            lastUsedAt: { type: 'string', nullable: true },
                            createdAt: { type: 'string' },
                            updatedAt: { type: 'string' },
                        },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'List API keys',
            description: 'Lists all API keys for the organization',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { orgId } = request.user;

        try {
            const apiKeys = await fastify.prisma.apiKey.findMany({
                where: { orgId },
                select: {
                    id: true,
                    label: true,
                    scopes: true,
                    lastUsedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    // Don't select hash for security
                },
                orderBy: { createdAt: 'desc' },
            });

            return reply.send(
                apiKeys.map(key => ({
                    ...key,
                    lastUsedAt: key.lastUsedAt?.toISOString() || null,
                    createdAt: key.createdAt.toISOString(),
                    updatedAt: key.updatedAt.toISOString(),
                }))
            );
        } catch (error) {
            fastify.log.error(error, 'Failed to list API keys');
            throw fastify.httpErrors.internalServerError('Failed to list API keys');
        }
    });

    // Revoke API key
    fastify.delete('/api-keys/:id', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                204: { type: 'null' },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Authentication'],
            summary: 'Revoke API key',
            description: 'Revokes an API key, making it unusable',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            // Verify API key exists and belongs to org
            const apiKey = await fastify.prisma.apiKey.findFirst({
                where: { id, orgId },
            });

            if (!apiKey) {
                throw fastify.httpErrors.notFound('API key not found');
            }

            await fastify.prisma.apiKey.delete({
                where: { id },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'api_key.revoked',
                    metaJson: {
                        apiKeyId: id,
                        label: apiKey.label,
                    },
                },
            });

            return reply.status(204).send();
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to revoke API key');
            throw fastify.httpErrors.internalServerError('Failed to revoke API key');
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
