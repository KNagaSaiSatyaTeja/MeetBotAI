import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { botManager } from '../../services/botManager';
import { requireAuth, requireOrgAccess, requireScope } from '../../middleware/auth';
import { ErrorResponseSchema } from './schemas';
import { detectPlatform } from '../../utils/platform';

export async function botRoutes(fastify: FastifyInstance) {

    // Join meeting endpoint
    fastify.post('/join', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { type: 'string', format: 'uri' },
                    title: { type: 'string', minLength: 1, maxLength: 255 },
                    displayName: { type: 'string', minLength: 1, maxLength: 100 },
                    passcode: { type: 'string', maxLength: 50 },
                    consentFlags: {
                        type: 'object',
                        properties: {
                            recording: { type: 'boolean' },
                            transcription: { type: 'boolean' },
                            summary: { type: 'boolean' }
                        },
                        additionalProperties: false
                    }
                },
                required: ['meetingLink'],
                additionalProperties: false
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        meetingId: { type: 'string' },
                        platform: { type: 'string' },
                        status: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
                500: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Join meeting with bot',
            description: 'Starts a bot to join the specified meeting (Zoom, Google Meet, or Teams)'
        }
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { meetingLink, title, displayName, passcode, consentFlags } = request.body;
        const { orgId } = request.user;

        try {
            const detected = detectPlatform(meetingLink);

            if (detected.platform === 'unknown') {
                return reply.status(400).send({
                    error: 'Unsupported meeting platform',
                    message: 'Please provide a valid Zoom, Google Meet, or Microsoft Teams meeting link',
                    statusCode: 400
                });
            }

            // Create bot using bot manager
            const botId = await botManager.createBot({
                meetingLink,
                orgId,
                title,
                displayName,
                passcode,
                consentFlags: {
                    recording: consentFlags?.recording ?? true,
                    transcription: consentFlags?.transcription ?? true,
                    summary: consentFlags?.summary ?? true
                }
            });

            const activeBot = botManager.getBot(botId);
            const meetingId = activeBot?.meetingId;

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: request.user.type === 'api_key' ? 'API_KEY' : 'USER',
                    actorId: request.user.id,
                    action: 'bot.meeting.joined',
                    metaJson: {
                        botId,
                        meetingId,
                        platform: detected.platform,
                        meetingLink
                    }
                }
            });

            return reply.send({
                success: true,
                botId,
                meetingId,
                platform: detected.platform,
                status: 'joining',
                message: 'Bot is joining the meeting'
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to join meeting with bot');
            return reply.status(500).send({
                error: 'Failed to join meeting',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // Leave meeting endpoint
    fastify.post('/leave', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { type: 'string', format: 'uri' }
                },
                required: ['meetingLink'],
                additionalProperties: false
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                },
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Leave meeting',
            description: 'Stops the bot and leaves the meeting'
        }
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { meetingLink } = request.body;

        try {
            const detected = detectPlatform(meetingLink);

            // Find bot by meeting link (this is a simplified approach)
            // In production, you might want to store botId in the request or use a different lookup
            const activeBots = Array.from(botManager.getBotStats().statusCounts);
            const bot = Array.from(botManager['activeBots'].values())
                .find(b => b.config.meetingLink === meetingLink);

            if (!bot) {
                return reply.status(404).send({
                    error: 'Bot not found',
                    message: 'No active bot found for this meeting',
                    statusCode: 404
                });
            }

            await botManager.endBot(bot.id);

            return reply.send({
                success: true,
                message: 'Bot left the meeting successfully'
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to leave meeting');
            return reply.status(500).send({
                error: 'Failed to leave meeting',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // Get bot status
    fastify.get('/status', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        stats: {
                            type: 'object',
                            properties: {
                                totalBots: { type: 'number' },
                                maxBots: { type: 'number' },
                                statusCounts: {
                                    type: 'object',
                                    properties: {
                                        joining: { type: 'number' },
                                        active: { type: 'number' },
                                        ending: { type: 'number' },
                                        failed: { type: 'number' }
                                    }
                                },
                                resourceStats: {
                                    type: 'object',
                                    properties: {
                                        activeBrowsers: { type: 'number' },
                                        activeRecordings: { type: 'number' },
                                        totalResources: { type: 'number' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Bot'],
            summary: 'Get bot manager status',
            description: 'Returns information about currently active bots'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { orgId } = request.user;

        // Get bot manager statistics
        const stats = botManager.getBotStats();

        return reply.send({
            stats
        });
    });

    // Get meeting data with bot information
    fastify.get('/meeting/:id/data', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:read')],
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        meeting: { type: 'object' },
                        recordings: { type: 'array' },
                        transcripts: { type: 'array' },
                        summaries: { type: 'array' },
                        bots: { type: 'array' },
                        minutesOfMeeting: { type: 'array' }
                    }
                },
                404: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Get meeting data',
            description: 'Returns complete meeting data including bot information'
        }
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            const meeting = await fastify.prisma.meeting.findFirst({
                where: { id, orgId },
                include: {
                    recordings: true,
                    transcripts: true,
                    summaries: true,
                    bots: {
                        include: {
                            logs: {
                                orderBy: { createdAt: 'desc' },
                                take: 20
                            }
                        }
                    },
                    moms: true
                }
            });

            if (!meeting) {
                return reply.status(404).send({
                    error: 'Meeting not found',
                    message: 'Meeting not found or access denied',
                    statusCode: 404
                });
            }

            // Transform data for response
            const responseData = {
                meeting: {
                    ...meeting,
                    startedAt: meeting.startedAt?.toISOString(),
                    endedAt: meeting.endedAt?.toISOString(),
                    scheduledAt: meeting.scheduledAt?.toISOString(),
                    createdAt: meeting.createdAt.toISOString(),
                    updatedAt: meeting.updatedAt.toISOString()
                },
                recordings: meeting.recordings.map(r => ({
                    ...r,
                    sizeBytes: r.sizeBytes.toString(),
                    createdAt: r.createdAt.toISOString(),
                    updatedAt: r.updatedAt.toISOString()
                })),
                transcripts: meeting.transcripts.map(t => ({
                    ...t,
                    readyAt: t.readyAt?.toISOString(),
                    createdAt: t.createdAt.toISOString(),
                    updatedAt: t.updatedAt.toISOString()
                })),
                summaries: meeting.summaries.map(s => ({
                    ...s,
                    readyAt: s.readyAt?.toISOString(),
                    createdAt: s.createdAt.toISOString(),
                    updatedAt: s.updatedAt.toISOString()
                })),
                bots: meeting.bots.map(b => ({
                    ...b,
                    startedAt: b.startedAt?.toISOString(),
                    endedAt: b.endedAt?.toISOString(),
                    createdAt: b.createdAt.toISOString(),
                    updatedAt: b.updatedAt.toISOString(),
                    logs: b.logs.map(l => ({
                        ...l,
                        createdAt: l.createdAt.toISOString()
                    }))
                })),
                minutesOfMeeting: meeting.moms.map(m => ({
                    ...m,
                    readyAt: m.readyAt?.toISOString(),
                    createdAt: m.createdAt.toISOString(),
                    updatedAt: m.updatedAt.toISOString()
                }))
            };

            return reply.send(responseData);

        } catch (error: any) {
            fastify.log.error(error, 'Failed to get meeting data');
            return reply.status(500).send({
                error: 'Failed to get meeting data',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // Recording control endpoints
    fastify.post('/recording/start', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { type: 'string', format: 'uri' }
                },
                required: ['meetingLink']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                },
                404: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Start recording',
            description: 'Manually start recording for an active bot'
        }
    }, async (request: FastifyRequest<{ Body: { meetingLink: string } }>, reply: FastifyReply) => {
        const detected = detectPlatform(request.body.meetingLink);
        const bot = activeBots.get(detected.canonicalMeetingKey);

        if (!bot) {
            return reply.status(404).send({
                error: 'Bot not found',
                message: 'No active bot found for this meeting',
                statusCode: 404
            });
        }

        return reply.send({
            success: true,
            message: 'Recording is automatically managed by the bot'
        });
    });

    fastify.post('/recording/stop', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { type: 'string', format: 'uri' }
                },
                required: ['meetingLink']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                },
                404: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Stop recording',
            description: 'Manually stop recording for an active bot'
        }
    }, async (request: FastifyRequest<{ Body: { meetingLink: string } }>, reply: FastifyReply) => {
        const detected = detectPlatform(request.body.meetingLink);
        const bot = activeBots.get(detected.canonicalMeetingKey);

        if (!bot) {
            return reply.status(404).send({
                error: 'Bot not found',
                message: 'No active bot found for this meeting',
                statusCode: 404
            });
        }

        return reply.send({
            success: true,
            message: 'Recording will stop when the bot leaves the meeting'
        });
    });
}