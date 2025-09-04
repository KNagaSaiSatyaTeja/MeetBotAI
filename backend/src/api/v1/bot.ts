import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createMeetingBot, MeetingBot } from '../../services/meetingBot';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';
import { ErrorResponseSchema } from './schemas';

// Store active bots
const activeBots = new Map<string, MeetingBot>();

export async function botRoutes(fastify: FastifyInstance) {
    // Start a bot to join a meeting
    fastify.post('/start', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { 
                        type: 'string', 
                        format: 'uri',
                        pattern: '^https://meet\\.google\\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'
                    },
                    title: { type: 'string', minLength: 1 },
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
                        message: { type: 'string' },
                        meetingId: { type: 'string' },
                        botStatus: { type: 'string' },
                        meetingLink: { type: 'string' }
                    }
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
                500: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Start MeetBot to join a Google Meet',
            description: 'Starts a bot that joins the specified Google Meet link and records the meeting'
        }
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { meetingLink, title, consentFlags } = request.body;
        const { orgId } = request.user;

        try {
            // Validate Google Meet link format
            const meetingCodeMatch = meetingLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
            if (!meetingCodeMatch) {
                return reply.status(400).send({ 
                    error: 'Invalid Google Meet link format. Expected: https://meet.google.com/xxx-xxxx-xxx' 
                });
            }

            const meetingCode = meetingCodeMatch[1];
            
            // Check if bot is already active for this meeting
            if (activeBots.has(meetingCode)) {
                return reply.status(400).send({ 
                    error: 'Bot is already active for this meeting' 
                });
            }

            console.log(`🚀 Starting bot for meeting: ${meetingLink}`);

            // Create and start the meeting bot
            const { bot, meetingId } = await createMeetingBot(fastify.prisma, {
                meetingLink,
                orgId,
                title: title || `Meeting ${meetingCode}`,
                consentFlags: {
                    recording: consentFlags?.recording ?? true,
                    transcription: consentFlags?.transcription ?? true,
                    summary: consentFlags?.summary ?? true
                }
            });

            // Store the bot instance
            activeBots.set(meetingCode, bot);

            // Clean up bot after meeting ends
            bot.once('meeting.ended', () => {
                activeBots.delete(meetingCode);
                console.log(`🧹 Cleaned up bot for meeting: ${meetingCode}`);
            });

            return reply.send({
                success: true,
                message: 'MeetBot started successfully',
                meetingId,
                botStatus: 'active',
                meetingLink
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to start meeting bot');
            return reply.status(500).send({ 
                error: 'Failed to start meeting bot',
                details: error.message 
            });
        }
    });

    // Stop a bot
    fastify.post('/stop', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            body: {
                type: 'object',
                properties: {
                    meetingLink: { 
                        type: 'string', 
                        format: 'uri'
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
                        message: { type: 'string' }
                    }
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
                404: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Stop an active MeetBot',
            description: 'Stops the bot for the specified meeting and saves all recorded data'
        }
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { meetingLink } = request.body;

        try {
            const meetingCodeMatch = meetingLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
            if (!meetingCodeMatch) {
                return reply.status(400).send({ 
                    error: 'Invalid Google Meet link format' 
                });
            }

            const meetingCode = meetingCodeMatch[1];
            const bot = activeBots.get(meetingCode);

            if (!bot) {
                return reply.status(404).send({ 
                    error: 'No active bot found for this meeting' 
                });
            }

            console.log(`🛑 Stopping bot for meeting: ${meetingLink}`);
            
            await bot.endMeeting();
            activeBots.delete(meetingCode);

            return reply.send({
                success: true,
                message: 'MeetBot stopped successfully'
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to stop meeting bot');
            return reply.status(500).send({ 
                error: 'Failed to stop meeting bot',
                details: error.message 
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
                        activeBots: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    meetingCode: { type: 'string' },
                                    status: { type: 'string' },
                                    startedAt: { type: 'string' }
                                }
                            }
                        },
                        totalActive: { type: 'number' }
                    }
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Get active bot status',
            description: 'Returns information about currently active meeting bots'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const botStatus = Array.from(activeBots.entries()).map(([meetingCode, bot]) => ({
            meetingCode,
            status: 'active',
            startedAt: new Date().toISOString() // In real implementation, track start time
        }));

        return reply.send({
            activeBots: botStatus,
            totalActive: activeBots.size
        });
    });

    // Get meeting data after bot has finished
    fastify.get('/meeting/:id/data', {
        preHandler: [requireAuth, requireOrgAccess],
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
                        meeting: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                platform: { type: 'string' },
                                meetingLink: { type: 'string' },
                                status: { type: 'string' },
                                startedAt: { type: 'string', nullable: true },
                                endedAt: { type: 'string', nullable: true },
                                recordings: { type: 'array' },
                                transcripts: { type: 'array' },
                                summaries: { type: 'array' }
                            }
                        }
                    }
                },
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema
            },
            tags: ['Bot'],
            summary: 'Get meeting data',
            description: 'Returns complete meeting data including recordings, transcripts, and summaries'
        }
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { orgId } = request.user;

        try {
            const meeting = await fastify.prisma.meeting.findFirst({
                where: { 
                    id,
                    orgId // Ensure user can only access their org's meetings
                },
                include: {
                    recordings: true,
                    transcripts: true,
                    summaries: true
                }
            });

            if (!meeting) {
                return reply.status(404).send({ 
                    error: 'Meeting not found' 
                });
            }

            return reply.send({
                meeting: {
                    ...meeting,
                    startedAt: meeting.startedAt?.toISOString() || null,
                    endedAt: meeting.endedAt?.toISOString() || null,
                    createdAt: meeting.createdAt.toISOString(),
                    updatedAt: meeting.updatedAt.toISOString(),
                    recordings: meeting.recordings.map(r => ({
                        ...r,
                        sizeBytes: r.sizeBytes.toString(), // Convert BigInt to string
                        createdAt: r.createdAt.toISOString(),
                        updatedAt: r.updatedAt.toISOString()
                    })),
                    transcripts: meeting.transcripts.map(t => ({
                        ...t,
                        readyAt: t.readyAt?.toISOString() || null,
                        createdAt: t.createdAt.toISOString(),
                        updatedAt: t.updatedAt.toISOString()
                    })),
                    summaries: meeting.summaries.map(s => ({
                        ...s,
                        readyAt: s.readyAt?.toISOString() || null,
                        createdAt: s.createdAt.toISOString(),
                        updatedAt: s.updatedAt.toISOString()
                    }))
                }
            });

        } catch (error: any) {
            fastify.log.error(error, 'Failed to get meeting data');
            return reply.status(500).send({ 
                error: 'Failed to get meeting data' 
            });
        }
    });
}
