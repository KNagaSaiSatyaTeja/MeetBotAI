import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import {
    CreateWebhookSchema,
    UpdateWebhookSchema,
    IdParamSchema,
    WebhookResponseSchema,
    ErrorResponseSchema,
    PaginatedResponseSchema
} from './schemas';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';

export async function webhooksRoutes(fastify: FastifyInstance) {
    // Create webhook
    fastify.post('/webhooks', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            body: CreateWebhookSchema,
            response: {
                201: WebhookResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'Create webhook',
            description: 'Creates a new webhook endpoint for event notifications',
        },
    }, async (request: FastifyRequest<{ Body: typeof CreateWebhookSchema._type }>, reply: FastifyReply) => {
        const { orgId } = request.user;
        const { url, events, active } = request.body;

        try {
            // Generate webhook secret
            const secret = crypto.randomBytes(32).toString('hex');

            const webhook = await fastify.prisma.webhook.create({
                data: {
                    orgId,
                    url,
                    secret,
                    events,
                    active: active ?? true,
                },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'webhook.created',
                    metaJson: { webhookId: webhook.id, url, events },
                },
            });

            return reply.status(201).send({
                ...webhook,
                secret, // Only return secret on creation
                createdAt: webhook.createdAt.toISOString(),
                updatedAt: webhook.updatedAt.toISOString(),
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to create webhook');
            throw fastify.httpErrors.internalServerError('Failed to create webhook');
        }
    });

    // List webhooks
    fastify.get('/webhooks', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            response: {
                200: { type: 'array', items: WebhookResponseSchema },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'List webhooks',
            description: 'Lists all webhooks for the organization',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { orgId } = request.user;

        try {
            const webhooks = await fastify.prisma.webhook.findMany({
                where: { orgId },
                include: {
                    deliveries: {
                        take: 5,
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            event: true,
                            status: true,
                            attempts: true,
                            responseCode: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return reply.send(
                webhooks.map(webhook => ({
                    ...webhook,
                    secret: undefined, // Don't return secrets in list
                    createdAt: webhook.createdAt.toISOString(),
                    updatedAt: webhook.updatedAt.toISOString(),
                    deliveries: webhook.deliveries?.map(d => ({
                        ...d,
                        createdAt: d.createdAt.toISOString(),
                    })),
                }))
            );
        } catch (error) {
            fastify.log.error(error, 'Failed to list webhooks');
            throw fastify.httpErrors.internalServerError('Failed to list webhooks');
        }
    });

    // Get webhook by ID
    fastify.get('/webhooks/:id', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                200: WebhookResponseSchema,
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'Get webhook',
            description: 'Retrieves details for a specific webhook',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            const webhook = await fastify.prisma.webhook.findFirst({
                where: { id, orgId },
                include: {
                    deliveries: {
                        take: 20,
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            event: true,
                            status: true,
                            attempts: true,
                            responseCode: true,
                            responseBody: true,
                            nextRetryAt: true,
                            createdAt: true,
                        },
                    },
                },
            });

            if (!webhook) {
                throw fastify.httpErrors.notFound('Webhook not found');
            }

            return reply.send({
                ...webhook,
                secret: undefined, // Don't return secret
                createdAt: webhook.createdAt.toISOString(),
                updatedAt: webhook.updatedAt.toISOString(),
                deliveries: webhook.deliveries?.map(d => ({
                    ...d,
                    createdAt: d.createdAt.toISOString(),
                    nextRetryAt: d.nextRetryAt?.toISOString(),
                })),
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to get webhook');
            throw fastify.httpErrors.internalServerError('Failed to get webhook');
        }
    });

    // Update webhook
    fastify.put('/webhooks/:id', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            body: UpdateWebhookSchema,
            response: {
                200: WebhookResponseSchema,
                404: ErrorResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'Update webhook',
            description: 'Updates an existing webhook configuration',
        },
    }, async (request: FastifyRequest<{
        Params: { id: string },
        Body: typeof UpdateWebhookSchema._type
    }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;
        const updateData = request.body;

        try {
            // Verify webhook exists and belongs to org
            const existingWebhook = await fastify.prisma.webhook.findFirst({
                where: { id, orgId },
            });

            if (!existingWebhook) {
                throw fastify.httpErrors.notFound('Webhook not found');
            }

            const webhook = await fastify.prisma.webhook.update({
                where: { id },
                data: updateData,
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'webhook.updated',
                    metaJson: { webhookId: id, changes: updateData },
                },
            });

            return reply.send({
                ...webhook,
                secret: undefined, // Don't return secret
                createdAt: webhook.createdAt.toISOString(),
                updatedAt: webhook.updatedAt.toISOString(),
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to update webhook');
            throw fastify.httpErrors.internalServerError('Failed to update webhook');
        }
    });

    // Delete webhook
    fastify.delete('/webhooks/:id', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                204: { type: 'null' },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'Delete webhook',
            description: 'Deletes a webhook endpoint',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            // Verify webhook exists and belongs to org
            const webhook = await fastify.prisma.webhook.findFirst({
                where: { id, orgId },
            });

            if (!webhook) {
                throw fastify.httpErrors.notFound('Webhook not found');
            }

            await fastify.prisma.webhook.delete({
                where: { id },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'webhook.deleted',
                    metaJson: { webhookId: id, url: webhook.url },
                },
            });

            return reply.status(204).send();
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to delete webhook');
            throw fastify.httpErrors.internalServerError('Failed to delete webhook');
        }
    });

    // Test webhook
    fastify.post('/webhooks/:id/test', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                200: { type: 'object', properties: { success: { type: 'boolean' }, deliveryId: { type: 'string' } } },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Webhooks'],
            summary: 'Test webhook',
            description: 'Sends a test event to the webhook endpoint',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            // Verify webhook exists and belongs to org
            const webhook = await fastify.prisma.webhook.findFirst({
                where: { id, orgId },
            });

            if (!webhook) {
                throw fastify.httpErrors.notFound('Webhook not found');
            }

            // Create test delivery record
            const delivery = await fastify.prisma.webhookDelivery.create({
                data: {
                    webhookId: id,
                    event: 'webhook.test',
                    payloadJson: {
                        event: 'webhook.test',
                        timestamp: new Date().toISOString(),
                        data: {
                            message: 'This is a test webhook delivery',
                            orgId,
                        },
                    },
                    status: 'PENDING',
                },
            });

            // Enqueue webhook delivery job
            await fastify.jobQueue.add('webhook', {
                deliveryId: delivery.id,
                webhookId: id,
                url: webhook.url,
                secret: webhook.secret,
                event: 'webhook.test',
                payload: delivery.payloadJson,
            }, {
                attempts: 1, // Only try once for test
            });

            return reply.send({
                success: true,
                deliveryId: delivery.id,
                message: 'Test webhook delivery queued',
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to test webhook');
            throw fastify.httpErrors.internalServerError('Failed to test webhook');
        }
    });
}
