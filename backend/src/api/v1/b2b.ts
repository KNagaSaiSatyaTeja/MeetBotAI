import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { botManager } from '../../services/botManager';
import { requireAuth, requireOrgAccess, requireScope } from '../../middleware/auth';
import { ErrorResponseSchema } from './schemas';
import { detectPlatform } from '../../utils/platform';
import { z } from 'zod';

// B2B API Schemas
const CreateBotRequestSchema = z.object({
    meetingLink: z.string().url('Invalid meeting URL'),
    title: z.string().min(1).max(255).optional(),
    displayName: z.string().min(1).max(100).optional(),
    passcode: z.string().max(50).optional(),
    recording: z.boolean().default(true),
    transcription: z.boolean().default(true),
    summary: z.boolean().default(true),
    language: z.string().default('en'),
    webhookUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional()
});

const BotStatusResponseSchema = {
    type: 'object',
    properties: {
        botId: { type: 'string' },
        meetingId: { type: 'string' },
        status: { type: 'string', enum: ['joining', 'active', 'ending', 'failed'] },
        platform: { type: 'string' },
        startTime: { type: 'string' },
        lastActivity: { type: 'string' },
        recordingStarted: { type: 'boolean' },
        recordingFile: { type: 'string' },
        transcript: { type: 'string' },
        summary: { type: 'string' },
        mom: { type: 'string' }
    },
    required: ['botId', 'meetingId', 'status', 'platform', 'startTime', 'lastActivity', 'recordingStarted']
};

export async function b2bRoutes(fastify: FastifyInstance) {

    // Create Bot for Meeting
    fastify.post('/bot/create', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { type: 'string', format: 'uri' },
                    title: { type: 'string', minLength: 1, maxLength: 255 },
                    displayName: { type: 'string', minLength: 1, maxLength: 100 },
                    passcode: { type: 'string', maxLength: 50 },
                    recording: { type: 'boolean', default: true },
                    transcription: { type: 'boolean', default: true },
                    summary: { type: 'boolean', default: true },
                    language: { type: 'string', default: 'en' },
                    webhookUrl: { type: 'string', format: 'uri' },
                    metadata: { type: 'object' }
                },
                required: ['meetingLink'],
                additionalProperties: false
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        botId: { type: 'string' },
                        meetingId: { type: 'string' },
                        platform: { type: 'string' },
                        status: { type: 'string' },
                        message: { type: 'string' },
                        webhookUrl: { type: 'string' }
                    }
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
                500: ErrorResponseSchema
            },
            tags: ['B2B'],
            summary: 'Create bot for meeting',
            description: 'Creates a bot to join a meeting with dynamic parameters'
        }
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { orgId } = request.user;

        try {
            // Validate request body
            const validatedData = CreateBotRequestSchema.parse(request.body);
            const { meetingLink, title, displayName, passcode, recording, transcription, summary, language, webhookUrl, metadata } = validatedData;

            // Detect platform
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
                title: title || `Meeting ${detected.meetingId || 'Auto'}`,
                displayName: displayName || process.env.BOT_DISPLAY_NAME || 'MeetingBot AI',
                passcode,
                consentFlags: {
                    recording,
                    transcription,
                    summary
                }
            });

            const activeBot = botManager.getBot(botId);
            const meetingId = activeBot?.meetingId;

            // Store webhook URL and metadata if provided
            if (webhookUrl || metadata) {
                await fastify.prisma.meeting.update({
                    where: { id: meetingId },
                    data: {
                        webhookUrl,
                        metadata: metadata || {}
                    }
                });
            }

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: request.user.type === 'api_key' ? 'API_KEY' : 'USER',
                    actorId: request.user.id,
                    action: 'b2b.bot.created',
                    metaJson: {
                        botId,
                        meetingId,
                        platform: detected.platform,
                        meetingLink,
                        webhookUrl,
                        metadata
                    }
                }
            });

            return reply.status(201).send({
                success: true,
                botId,
                meetingId,
                platform: detected.platform,
                status: 'joining',
                message: 'Bot is joining the meeting',
                webhookUrl
            });

        } catch (error: any) {
            if (error.name === 'ZodError') {
                return reply.status(400).send({
                    error: 'Validation error',
                    message: error.errors.map((e: any) => e.message).join(', '),
                    statusCode: 400
                });
            }

            fastify.log.error(error, 'Failed to create B2B bot');
            return reply.status(500).send({
                error: 'Failed to create bot',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // Get Bot Status
    fastify.get('/bot/:botId/status', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:read')],
        schema: {
            params: {
                type: 'object',
                properties: {
                    botId: { type: 'string' }
                },
                required: ['botId']
            },
            response: {
                200: BotStatusResponseSchema,
                404: ErrorResponseSchema
            },
            tags: ['B2B'],
            summary: 'Get bot status',
            description: 'Returns the current status and data for a specific bot'
        }
    }, async (request: FastifyRequest<{ Params: { botId: string } }>, reply: FastifyReply) => {
        const { botId } = request.params;
        const { orgId } = request.user;

        try {
            const activeBot = botManager.getBot(botId);
            if (!activeBot) {
                return reply.status(404).send({
                    error: 'Bot not found',
                    message: 'No bot found with the specified ID',
                    statusCode: 404
                });
            }

            // Get meeting data from database
            const meeting = await fastify.prisma.meeting.findUnique({
                where: { id: activeBot.meetingId },
                include: {
                    recordings: true,
                    transcripts: true,
                    summaries: true
                }
            });

            if (!meeting || meeting.orgId !== orgId) {
                return reply.status(404).send({
                    error: 'Meeting not found',
                    message: 'Meeting not found or access denied',
                    statusCode: 404
                });
            }

            // Get latest recording
            const latestRecording = meeting.recordings?.[0];
            const transcript = meeting.transcripts?.[0];
            const summary = meeting.summaries?.[0];

            return reply.send({
                botId: activeBot.id,
                meetingId: activeBot.meetingId,
                status: activeBot.status,
                platform: activeBot.platform,
                startTime: activeBot.startTime.toISOString(),
                lastActivity: activeBot.lastActivity.toISOString(),
                recordingStarted: !!latestRecording,
                recordingFile: latestRecording?.audioUrl,
                transcript: transcript?.content,
                summary: summary?.content,
                mom: summary?.mom
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to get bot status');
            return reply.status(500).send({
                error: 'Failed to get bot status',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // End Bot
    fastify.post('/bot/:botId/end', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:write')],
        schema: {
            params: {
                type: 'object',
                properties: {
                    botId: { type: 'string' }
                },
                required: ['botId']
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
            tags: ['B2B'],
            summary: 'End bot',
            description: 'Ends a specific bot and leaves the meeting'
        }
    }, async (request: FastifyRequest<{ Params: { botId: string } }>, reply: FastifyReply) => {
        const { botId } = request.params;
        const { orgId } = request.user;

        try {
            const activeBot = botManager.getBot(botId);
            if (!activeBot) {
                return reply.status(404).send({
                    error: 'Bot not found',
                    message: 'No bot found with the specified ID',
                    statusCode: 404
                });
            }

            // Verify ownership
            const meeting = await fastify.prisma.meeting.findUnique({
                where: { id: activeBot.meetingId },
                select: { orgId: true }
            });

            if (!meeting || meeting.orgId !== orgId) {
                return reply.status(404).send({
                    error: 'Access denied',
                    message: 'You do not have access to this bot',
                    statusCode: 404
                });
            }

            await botManager.endBot(botId);

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: request.user.type === 'api_key' ? 'API_KEY' : 'USER',
                    actorId: request.user.id,
                    action: 'b2b.bot.ended',
                    metaJson: {
                        botId,
                        meetingId: activeBot.meetingId
                    }
                }
            });

            return reply.send({
                success: true,
                message: 'Bot ended successfully'
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to end bot');
            return reply.status(500).send({
                error: 'Failed to end bot',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // Get Meeting Data (Complete)
    fastify.get('/meeting/:meetingId/data', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:read')],
        schema: {
            params: {
                type: 'object',
                properties: {
                    meetingId: { type: 'string' }
                },
                required: ['meetingId']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        meeting: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                platform: { type: 'string' },
                                meetingLink: { type: 'string' },
                                status: { type: 'string' },
                                startedAt: { type: 'string' },
                                endedAt: { type: 'string' },
                                duration: { type: 'number' }
                            }
                        },
                        recording: {
                            type: 'object',
                            properties: {
                                audioUrl: { type: 'string' },
                                sizeBytes: { type: 'number' },
                                duration: { type: 'number' }
                            }
                        },
                        transcript: {
                            type: 'object',
                            properties: {
                                content: { type: 'string' },
                                language: { type: 'string' },
                                confidence: { type: 'number' }
                            }
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                content: { type: 'string' },
                                mom: { type: 'string' },
                                keyPoints: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    }
                },
                404: ErrorResponseSchema
            },
            tags: ['B2B'],
            summary: 'Get complete meeting data',
            description: 'Returns complete meeting data including recording, transcript, and summary'
        }
    }, async (request: FastifyRequest<{ Params: { meetingId: string } }>, reply: FastifyReply) => {
        const { meetingId } = request.params;
        const { orgId } = request.user;

        try {
            const meeting = await fastify.prisma.meeting.findUnique({
                where: { id: meetingId },
                include: {
                    recordings: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    },
                    transcripts: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    },
                    summaries: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (!meeting || meeting.orgId !== orgId) {
                return reply.status(404).send({
                    error: 'Meeting not found',
                    message: 'Meeting not found or access denied',
                    statusCode: 404
                });
            }

            const recording = meeting.recordings?.[0];
            const transcript = meeting.transcripts?.[0];
            const summary = meeting.summaries?.[0];

            const duration = meeting.endedAt && meeting.startedAt
                ? Math.floor((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000)
                : null;

            return reply.send({
                meeting: {
                    id: meeting.id,
                    title: meeting.title,
                    platform: meeting.platform,
                    meetingLink: meeting.meetingLink,
                    status: meeting.status,
                    startedAt: meeting.startedAt?.toISOString(),
                    endedAt: meeting.endedAt?.toISOString(),
                    duration
                },
                recording: recording ? {
                    audioUrl: recording.audioUrl,
                    sizeBytes: Number(recording.sizeBytes),
                    duration: recording.duration
                } : null,
                transcript: transcript ? {
                    content: transcript.content,
                    language: transcript.language,
                    confidence: transcript.confidence
                } : null,
                summary: summary ? {
                    content: summary.content,
                    mom: summary.mom,
                    keyPoints: summary.keyPoints || []
                } : null
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to get meeting data');
            return reply.status(500).send({
                error: 'Failed to get meeting data',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // List Organization Bots
    fastify.get('/bots', {
        preHandler: [requireAuth, requireOrgAccess, requireScope('meetings:read')],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['joining', 'active', 'ending', 'failed'] },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
                    offset: { type: 'number', minimum: 0, default: 0 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        bots: {
                            type: 'array',
                            items: BotStatusResponseSchema
                        },
                        total: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' }
                    }
                }
            },
            tags: ['B2B'],
            summary: 'List organization bots',
            description: 'Returns a list of bots for the organization'
        }
    }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
        const { orgId } = request.user;
        const { status, limit = 20, offset = 0 } = request.query;

        try {
            // Get meetings for organization
            const meetings = await fastify.prisma.meeting.findMany({
                where: { orgId },
                include: {
                    recordings: { take: 1 },
                    transcripts: { take: 1 },
                    summaries: { take: 1 }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            });

            const bots = meetings.map(meeting => {
                const recording = meeting.recordings?.[0];
                const transcript = meeting.transcripts?.[0];
                const summary = meeting.summaries?.[0];

                return {
                    botId: `meeting_${meeting.id}`,
                    meetingId: meeting.id,
                    status: meeting.status.toLowerCase() as any,
                    platform: meeting.platform,
                    startTime: meeting.createdAt.toISOString(),
                    lastActivity: meeting.updatedAt.toISOString(),
                    recordingStarted: !!recording,
                    recordingFile: recording?.audioUrl,
                    transcript: transcript?.content,
                    summary: summary?.content,
                    mom: summary?.mom
                };
            });

            const total = await fastify.prisma.meeting.count({
                where: { orgId }
            });

            return reply.send({
                bots,
                total,
                limit,
                offset
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to list bots');
            return reply.status(500).send({
                error: 'Failed to list bots',
                message: error.message,
                statusCode: 500
            });
        }
    });

    // System Status
    fastify.get('/system/status', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        system: {
                            type: 'object',
                            properties: {
                                status: { type: 'string' },
                                uptime: { type: 'number' },
                                version: { type: 'string' }
                            }
                        },
                        resources: {
                            type: 'object',
                            properties: {
                                totalBots: { type: 'number' },
                                maxBots: { type: 'number' },
                                activeBrowsers: { type: 'number' },
                                activeRecordings: { type: 'number' },
                                memoryUsage: { type: 'number' }
                            }
                        },
                        database: {
                            type: 'object',
                            properties: {
                                status: { type: 'string' },
                                connections: { type: 'number' }
                            }
                        }
                    }
                }
            },
            tags: ['B2B'],
            summary: 'Get system status',
            description: 'Returns system status and resource information'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const stats = botManager.getBotStats();
            const startTime = process.uptime();

            return reply.send({
                system: {
                    status: 'healthy',
                    uptime: Math.floor(startTime),
                    version: process.env.npm_package_version || '1.0.0'
                },
                resources: {
                    totalBots: stats.totalBots,
                    maxBots: stats.maxBots,
                    activeBrowsers: stats.resourceStats.activeBrowsers,
                    activeRecordings: stats.resourceStats.activeRecordings,
                    memoryUsage: stats.resourceStats.memoryUsage
                },
                database: {
                    status: 'connected',
                    connections: stats.connectionStats.inUseConnections
                }
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to get system status');
            return reply.status(500).send({
                error: 'Failed to get system status',
                message: error.message,
                statusCode: 500
            });
        }
    });
}
