import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import {
    IdParamSchema,
    ErrorResponseSchema
} from './schemas';
import { requireAuth, requireAdmin } from '../../middleware/auth';

export async function adminRoutes(fastify: FastifyInstance) {
    // List all users (Admin only)
    fastify.get('/users', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            email: { type: 'string' },
                            name: { type: 'string', nullable: true },
                            companyName: { type: 'string', nullable: true },
                            role: { type: 'string' },
                            provider: { type: 'string' },
                            isActive: { type: 'boolean' },
                            createdAt: { type: 'string' },
                            updatedAt: { type: 'string' },
                        },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'List all users',
            description: 'Returns a list of all users in the system',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const users = await fastify.prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    companyName: true,
                    role: true,
                    provider: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    // Don't select passwordHash for security
                },
                orderBy: { createdAt: 'desc' },
            });

            // Log admin action
            await fastify.prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: 'users.listed',
                    metaJson: {
                        userCount: users.length,
                    },
                },
            });

            return reply.send(
                users.map(user => ({
                    ...user,
                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString(),
                }))
            );
        } catch (error) {
            fastify.log.error(error, 'Failed to list users');
            throw fastify.httpErrors.internalServerError('Failed to list users');
        }
    });

    // Update user status (Admin only)
    fastify.patch('/users/:id/status', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            params: IdParamSchema,
            body: {
                type: 'object',
                properties: {
                    isActive: { type: 'boolean' },
                },
                required: ['isActive'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                    },
                },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'Update user status',
            description: 'Activate or deactivate a user account',
        },
    }, async (request: FastifyRequest<{ 
        Params: { id: string },
        Body: { isActive: boolean }
    }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { isActive } = request.body;

        try {
            // Verify user exists
            const user = await fastify.prisma.user.findUnique({
                where: { id },
                select: { id: true, email: true, isActive: true },
            });

            if (!user) {
                throw fastify.httpErrors.notFound('User not found');
            }

            // Prevent admin from deactivating themselves
            if (id === request.user.id && !isActive) {
                throw fastify.httpErrors.badRequest('Cannot deactivate your own account');
            }

            await fastify.prisma.user.update({
                where: { id },
                data: { isActive },
            });

            // Log admin action
            await fastify.prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: isActive ? 'user.activated' : 'user.deactivated',
                    targetUserId: id,
                    metaJson: {
                        targetEmail: user.email,
                        previousStatus: user.isActive,
                        newStatus: isActive,
                    },
                },
            });

            return reply.send({
                success: true,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to update user status');
            throw fastify.httpErrors.internalServerError('Failed to update user status');
        }
    });

    // List all meetings (Admin only)
    fastify.get('/meetings', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            platform: { type: 'string' },
                            status: { type: 'string' },
                            scheduledAt: { type: 'string', nullable: true },
                            createdAt: { type: 'string' },
                            user: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    email: { type: 'string' },
                                    name: { type: 'string', nullable: true },
                                },
                            },
                        },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'List all meetings',
            description: 'Returns a list of all meetings in the system',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const meetings = await fastify.prisma.meeting.findMany({
                select: {
                    id: true,
                    title: true,
                    platform: true,
                    status: true,
                    scheduledAt: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            // Log admin action
            await fastify.prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: 'meetings.listed',
                    metaJson: {
                        meetingCount: meetings.length,
                    },
                },
            });

            return reply.send(
                meetings.map(meeting => ({
                    ...meeting,
                    scheduledAt: meeting.scheduledAt?.toISOString() || null,
                    createdAt: meeting.createdAt.toISOString(),
                }))
            );
        } catch (error) {
            fastify.log.error(error, 'Failed to list meetings');
            throw fastify.httpErrors.internalServerError('Failed to list meetings');
        }
    });

    // Revoke user's API token (Admin only)
    fastify.delete('/tokens/:id', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            params: IdParamSchema,
            response: {
                204: { type: 'null' },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'Revoke user API token',
            description: 'Revokes any user\'s API token',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        try {
            // Find the API token
            const apiToken = await fastify.prisma.apiToken.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            });

            if (!apiToken) {
                throw fastify.httpErrors.notFound('API token not found');
            }

            await fastify.prisma.apiToken.update({
                where: { id },
                data: { status: 'revoked' },
            });

            // Log admin action
            await fastify.prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: 'token.revoked',
                    targetUserId: apiToken.userId,
                    metaJson: {
                        tokenId: id,
                        tokenLabel: apiToken.label,
                        targetUserEmail: apiToken.user.email,
                    },
                },
            });

            return reply.status(204).send();
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to revoke API token');
            throw fastify.httpErrors.internalServerError('Failed to revoke API token');
        }
    });

    // Get system logs (Admin only)
    fastify.get('/logs', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        logs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    action: { type: 'string' },
                                    targetUserId: { type: 'string', nullable: true },
                                    targetMeetingId: { type: 'string', nullable: true },
                                    metaJson: { type: 'object' },
                                    createdAt: { type: 'string' },
                                    admin: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            email: { type: 'string' },
                                            name: { type: 'string', nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                        total: { type: 'integer' },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'Get system logs',
            description: 'Returns admin action logs',
        },
    }, async (request: FastifyRequest<{ 
        Querystring: { limit?: number, offset?: number }
    }>, reply: FastifyReply) => {
        const { limit = 50, offset = 0 } = request.query;

        try {
            const [logs, total] = await Promise.all([
                fastify.prisma.adminLog.findMany({
                    take: limit,
                    skip: offset,
                    include: {
                        admin: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                fastify.prisma.adminLog.count(),
            ]);

            return reply.send({
                logs: logs.map(log => ({
                    ...log,
                    createdAt: log.createdAt.toISOString(),
                })),
                total,
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to get system logs');
            throw fastify.httpErrors.internalServerError('Failed to get system logs');
        }
    });

    // Get system health metrics (Admin only)
    fastify.get('/health', {
        preHandler: [requireAuth, requireAdmin],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        users: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer' },
                                active: { type: 'integer' },
                                inactive: { type: 'integer' },
                            },
                        },
                        meetings: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer' },
                                scheduled: { type: 'integer' },
                                inProgress: { type: 'integer' },
                                completed: { type: 'integer' },
                            },
                        },
                        apiTokens: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer' },
                                active: { type: 'integer' },
                                revoked: { type: 'integer' },
                            },
                        },
                        bots: {
                            type: 'object',
                            properties: {
                                active: { type: 'integer' },
                                idle: { type: 'integer' },
                                failed: { type: 'integer' },
                            },
                        },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Admin'],
            summary: 'Get system health',
            description: 'Returns system health metrics',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const [
                userStats,
                meetingStats,
                tokenStats,
                botStats,
            ] = await Promise.all([
                // User statistics
                fastify.prisma.user.groupBy({
                    by: ['isActive'],
                    _count: { id: true },
                }),
                // Meeting statistics
                fastify.prisma.meeting.groupBy({
                    by: ['status'],
                    _count: { id: true },
                }),
                // API token statistics
                fastify.prisma.apiToken.groupBy({
                    by: ['status'],
                    _count: { id: true },
                }),
                // Bot statistics
                fastify.prisma.meetingsBot.groupBy({
                    by: ['status'],
                    _count: { id: true },
                }),
            ]);

            // Process user stats
            const users = {
                total: userStats.reduce((sum, stat) => sum + stat._count.id, 0),
                active: userStats.find(stat => stat.isActive)?._count.id || 0,
                inactive: userStats.find(stat => !stat.isActive)?._count.id || 0,
            };

            // Process meeting stats
            const meetings = {
                total: meetingStats.reduce((sum, stat) => sum + stat._count.id, 0),
                scheduled: meetingStats.find(stat => stat.status === 'SCHEDULED')?._count.id || 0,
                inProgress: meetingStats.find(stat => stat.status === 'IN_PROGRESS')?._count.id || 0,
                completed: meetingStats.find(stat => stat.status === 'COMPLETED')?._count.id || 0,
            };

            // Process token stats
            const apiTokens = {
                total: tokenStats.reduce((sum, stat) => sum + stat._count.id, 0),
                active: tokenStats.find(stat => stat.status === 'active')?._count.id || 0,
                revoked: tokenStats.find(stat => stat.status === 'revoked')?._count.id || 0,
            };

            // Process bot stats
            const bots = {
                active: botStats.find(stat => stat.status === 'IN_MEETING')?._count.id || 0,
                idle: botStats.find(stat => stat.status === 'IDLE')?._count.id || 0,
                failed: botStats.find(stat => stat.status === 'FAILED')?._count.id || 0,
            };

            return reply.send({
                users,
                meetings,
                apiTokens,
                bots,
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to get system health');
            throw fastify.httpErrors.internalServerError('Failed to get system health');
        }
    });
}
