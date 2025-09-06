import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    CreateMeetingSchema,
    IdParamSchema,
    MeetingQuerySchema,
    UploadRecordingSchema,
    SearchQuerySchema,
    MeetingResponseSchema,
    ErrorResponseSchema,
    PaginatedResponseSchema
} from './schemas';
import { storageAdapter } from '../../adapters/storage';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';

export async function meetingsRoutes(fastify: FastifyInstance) {
    // Create meeting
    fastify.post('/meetings', {
        preHandler: [requireAuth],
        schema: {
            body: CreateMeetingSchema,
            response: {
                201: MeetingResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'Create a new meeting',
            description: 'Creates a new meeting record for the user',
        },
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        const { id: userId, orgId } = request.user;
        const meetingData = request.body;

        try {
            const meeting = await fastify.prisma.meeting.create({
                data: {
                    ...meetingData,
                    userId,
                    orgId: orgId || null,
                    status: 'SCHEDULED',
                },
                include: {
                    recordings: true,
                    transcripts: true,
                    summaries: true,
                },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'meeting.created',
                    metaJson: { meetingId: meeting.id, title: meeting.title },
                },
            });

            return reply.status(201).send({
                ...meeting,
                sizeBytes: meeting.recordings[0]?.sizeBytes?.toString(),
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to create meeting');
            throw fastify.httpErrors.internalServerError('Failed to create meeting');
        }
    });

    // Get meeting by ID
    fastify.get('/meetings/:id', {
        preHandler: [requireAuth],
        schema: {
            params: IdParamSchema,
            querystring: MeetingQuerySchema,
            response: {
                200: MeetingResponseSchema,
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'Get meeting details',
            description: 'Retrieves detailed information about a specific meeting',
        },
    }, async (request: FastifyRequest<{
        Params: { id: string },
        Querystring: any
    }>, reply: FastifyReply) => {
        const { id } = request.params;
        const { record, audio, video } = request.query;
        const { id: userId, role } = request.user;

        try {
            // Admin can see all meetings, users can only see their own
            const whereClause = role === 'ADMIN' ? { id } : { id, userId };
            
            const meeting = await fastify.prisma.meeting.findFirst({
                where: whereClause,
                include: {
                    recordings: record,
                    transcripts: record,
                    summaries: record,
                },
            });

            if (!meeting) {
                throw fastify.httpErrors.notFound('Meeting not found');
            }

            // Generate signed URLs for media files if requested
            let responseData = { ...meeting };

            if ((audio || video) && meeting.recordings.length > 0) {
                const recording = meeting.recordings[0];
                const signedUrls: any = {};

                if (audio && recording.audioUrl) {
                    signedUrls.audioUrl = await storageAdapter.getSignedUrl(recording.audioUrl, 3600); // 1 hour
                }

                if (video && recording.videoUrl) {
                    signedUrls.videoUrl = await storageAdapter.getSignedUrl(recording.videoUrl, 3600); // 1 hour
                }

                responseData.recordings = [{ ...recording, ...signedUrls }];
            }

            // Log audit event for data access
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'meeting.accessed',
                    metaJson: { meetingId: id, includeRecording: record },
                },
            });

            return reply.send({
                ...responseData,
                recordings: responseData.recordings?.map(r => ({
                    ...r,
                    sizeBytes: r.sizeBytes?.toString(),
                })),
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to get meeting');
            throw fastify.httpErrors.internalServerError('Failed to get meeting');
        }
    });

    // Upload recording
    fastify.post('/meetings/:id/recording', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            consumes: ['multipart/form-data'],
            response: {
                200: { type: 'object', properties: { success: { type: 'boolean' }, recordingId: { type: 'string' } } },
                400: ErrorResponseSchema,
                404: ErrorResponseSchema,
                413: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'Upload meeting recording',
            description: 'Uploads audio/video recording files for a meeting',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id: meetingId } = request.params;
        const { orgId } = request.user;

        try {
            // Verify meeting exists and belongs to org
            const meeting = await fastify.prisma.meeting.findFirst({
                where: { id: meetingId, orgId },
            });

            if (!meeting) {
                throw fastify.httpErrors.notFound('Meeting not found');
            }

            // Process multipart form data
            const data = await request.file();

            if (!data) {
                throw fastify.httpErrors.badRequest('No file uploaded');
            }

            const fileBuffer = await data.toBuffer();
            const fileSize = fileBuffer.length;
            const fileName = data.filename;
            const mimeType = data.mimetype;

            // Validate file type
            const isAudio = mimeType.startsWith('audio/');
            const isVideo = mimeType.startsWith('video/');

            if (!isAudio && !isVideo) {
                throw fastify.httpErrors.badRequest('File must be audio or video');
            }

            // Generate storage key
            const fileExtension = fileName.split('.').pop() || 'bin';
            const storageKey = `recordings/${orgId}/${meetingId}/${Date.now()}.${fileExtension}`;

            // Upload to storage
            const uploadResult = await storageAdapter.uploadFile(storageKey, fileBuffer, mimeType);

            // Create recording record
            const recording = await fastify.prisma.recording.create({
                data: {
                    meetingId,
                    hasVideo: isVideo,
                    audioUrl: isAudio ? uploadResult.url : null,
                    videoUrl: isVideo ? uploadResult.url : null,
                    sizeBytes: BigInt(fileSize),
                    checksum: uploadResult.checksum,
                    storageRegion: process.env.REGION || 'us',
                    encryptionMeta: uploadResult.encryptionMeta || {},
                },
            });

            // Update meeting status
            await fastify.prisma.meeting.update({
                where: { id: meetingId },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: new Date(),
                },
            });

            // Enqueue transcription job
            await fastify.jobQueue.add('transcribe', {
                recordingId: recording.id,
                meetingId,
                orgId,
                language: 'en', // TODO: get from form data
                storageKey,
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
            });

            // Log audit event
            await fastify.prisma.auditLog.create({
                data: {
                    orgId,
                    actorType: 'USER',
                    actorId: request.user.id,
                    action: 'recording.uploaded',
                    metaJson: {
                        meetingId,
                        recordingId: recording.id,
                        fileSize,
                        mimeType,
                        hasVideo: isVideo,
                    },
                },
            });

            return reply.send({
                success: true,
                recordingId: recording.id,
                message: 'Recording uploaded successfully. Transcription will begin shortly.',
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to upload recording');
            throw fastify.httpErrors.internalServerError('Failed to upload recording');
        }
    });

    // List meetings with search and filters
    fastify.get('/meetings', {
        preHandler: [requireAuth],
        schema: {
            querystring: SearchQuerySchema,
            response: {
                200: PaginatedResponseSchema,
                401: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'List meetings',
            description: 'Lists meetings with optional search and filtering',
        },
    }, async (request: FastifyRequest<{ Querystring: typeof SearchQuerySchema._type }>, reply: FastifyReply) => {
        const { id: userId, role } = request.user;
        const { search, platform, status, dateFrom, dateTo, cursor, limit } = request.query;

        try {
            // Build where clause - Admin can see all meetings, users only their own
            const where: any = role === 'ADMIN' ? {} : { userId };

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { meetingLink: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (platform) {
                where.platform = platform;
            }

            if (status) {
                where.status = status;
            }

            if (dateFrom || dateTo) {
                where.createdAt = {};
                if (dateFrom) where.createdAt.gte = new Date(dateFrom);
                if (dateTo) where.createdAt.lte = new Date(dateTo);
            }

            if (cursor) {
                where.id = { lt: cursor };
            }

            // Execute query
            const meetings = await fastify.prisma.meeting.findMany({
                where,
                include: {
                    recordings: {
                        select: {
                            id: true,
                            hasVideo: true,
                            sizeBytes: true,
                            createdAt: true,
                        },
                    },
                    transcripts: {
                        select: {
                            id: true,
                            readyAt: true,
                        },
                    },
                    summaries: {
                        select: {
                            id: true,
                            readyAt: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1, // Take one extra to check if there are more
            });

            // Determine pagination
            const hasMore = meetings.length > limit;
            const data = hasMore ? meetings.slice(0, -1) : meetings;
            const nextCursor = hasMore ? data[data.length - 1]?.id : null;

            // Get total count for first page
            let total: number | undefined;
            if (!cursor) {
                total = await fastify.prisma.meeting.count({ where });
            }

            return reply.send({
                data: data.map(meeting => ({
                    ...meeting,
                    recordings: meeting.recordings.map(r => ({
                        ...r,
                        sizeBytes: r.sizeBytes.toString(),
                    })),
                })),
                pagination: {
                    cursor: nextCursor,
                    hasMore,
                    total,
                },
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to list meetings');
            throw fastify.httpErrors.internalServerError('Failed to list meetings');
        }
    });

    // Get transcript
    fastify.get('/meetings/:id/transcript', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                200: { type: 'object' }, // TranscriptResponseSchema
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'Get meeting transcript',
            description: 'Retrieves the transcript for a specific meeting',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id: meetingId } = request.params;
        const { orgId } = request.user;

        try {
            const transcript = await fastify.prisma.transcript.findFirst({
                where: {
                    meetingId,
                    meeting: { orgId },
                },
                include: {
                    meeting: {
                        select: { id: true, title: true, orgId: true },
                    },
                },
            });

            if (!transcript) {
                throw fastify.httpErrors.notFound('Transcript not found');
            }

            return reply.send({
                id: transcript.id,
                meetingId: transcript.meetingId,
                language: transcript.language,
                text: transcript.text,
                words: transcript.wordsJson,
                speakerTurns: transcript.speakerTurnsJson,
                accuracy: transcript.accuracy,
                readyAt: transcript.readyAt?.toISOString(),
                createdAt: transcript.createdAt.toISOString(),
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to get transcript');
            throw fastify.httpErrors.internalServerError('Failed to get transcript');
        }
    });

    // Get summary
    fastify.get('/meetings/:id/summary', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            params: IdParamSchema,
            response: {
                200: { type: 'object' }, // SummaryResponseSchema
                404: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Meetings'],
            summary: 'Get meeting summary',
            description: 'Retrieves the AI-generated summary for a specific meeting',
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id: meetingId } = request.params;
        const { orgId } = request.user;

        try {
            const summary = await fastify.prisma.summary.findFirst({
                where: {
                    meetingId,
                    meeting: { orgId },
                },
                include: {
                    meeting: {
                        select: { id: true, title: true, orgId: true },
                    },
                },
            });

            if (!summary) {
                throw fastify.httpErrors.notFound('Summary not found');
            }

            return reply.send({
                id: summary.id,
                meetingId: summary.meetingId,
                model: summary.model,
                summaryText: summary.summaryText,
                decisions: summary.decisionsJson,
                actionItems: summary.actionItemsJson,
                participants: summary.participantsJson,
                readyAt: summary.readyAt?.toISOString(),
                createdAt: summary.createdAt.toISOString(),
            });
        } catch (error) {
            if (error.statusCode) throw error;
            fastify.log.error(error, 'Failed to get summary');
            throw fastify.httpErrors.internalServerError('Failed to get summary');
        }
    });
}
