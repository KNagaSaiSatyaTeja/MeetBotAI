import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    SearchQuerySchema,
    PaginatedResponseSchema,
    ErrorResponseSchema
} from './schemas';
import { requireAuth, requireOrgAccess } from '../../middleware/auth';

export async function searchRoutes(fastify: FastifyInstance) {
    // Search across meetings, transcripts, and summaries
    fastify.get('/search', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            querystring: SearchQuerySchema,
            response: {
                200: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string', enum: ['meeting', 'transcript', 'summary'] },
                                    id: { type: 'string' },
                                    meetingId: { type: 'string' },
                                    title: { type: 'string' },
                                    snippet: { type: 'string' },
                                    highlights: { type: 'array', items: { type: 'string' } },
                                    relevance: { type: 'number' },
                                    createdAt: { type: 'string' },
                                },
                            },
                        },
                        pagination: {
                            type: 'object',
                            properties: {
                                cursor: { type: 'string', nullable: true },
                                hasMore: { type: 'boolean' },
                                total: { type: 'number' },
                            },
                        },
                    },
                },
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Search'],
            summary: 'Search meetings and content',
            description: 'Full-text search across meetings, transcripts, and summaries with relevance ranking',
        },
    }, async (request: FastifyRequest<{ Querystring: typeof SearchQuerySchema._type }>, reply: FastifyReply) => {
        const { orgId } = request.user;
        const { search, platform, status, dateFrom, dateTo, cursor, limit } = request.query;

        if (!search || search.trim().length < 2) {
            throw fastify.httpErrors.badRequest('Search query must be at least 2 characters');
        }

        try {
            const searchTerm = search.trim();
            const results: any[] = [];

            // Build base where clause for filtering
            const baseWhere: any = {};
            if (platform) baseWhere.platform = platform;
            if (status) baseWhere.status = status;
            if (dateFrom || dateTo) {
                baseWhere.createdAt = {};
                if (dateFrom) baseWhere.createdAt.gte = new Date(dateFrom);
                if (dateTo) baseWhere.createdAt.lte = new Date(dateTo);
            }

            // Search in meetings (title, meeting link)
            const meetingResults = await fastify.prisma.meeting.findMany({
                where: {
                    orgId,
                    ...baseWhere,
                    OR: [
                        { title: { contains: searchTerm, mode: 'insensitive' } },
                        { meetingLink: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    title: true,
                    platform: true,
                    status: true,
                    createdAt: true,
                    meetingLink: true,
                },
                take: limit,
            });

            // Add meeting results
            meetingResults.forEach(meeting => {
                const snippet = meeting.meetingLink || meeting.title;
                const highlights = [
                    ...getHighlights(meeting.title, searchTerm),
                    ...getHighlights(meeting.meetingLink || '', searchTerm),
                ];

                results.push({
                    type: 'meeting',
                    id: meeting.id,
                    meetingId: meeting.id,
                    title: meeting.title,
                    snippet: truncateText(snippet, 200),
                    highlights: highlights.slice(0, 3), // Limit highlights
                    relevance: calculateRelevance(searchTerm, meeting.title, snippet),
                    createdAt: meeting.createdAt.toISOString(),
                    platform: meeting.platform,
                    status: meeting.status,
                });
            });

            // Search in transcripts
            const transcriptResults = await fastify.prisma.transcript.findMany({
                where: {
                    meeting: { orgId, ...baseWhere },
                    text: { contains: searchTerm, mode: 'insensitive' },
                },
                include: {
                    meeting: {
                        select: {
                            id: true,
                            title: true,
                            platform: true,
                            status: true,
                        },
                    },
                },
                take: limit,
            });

            // Add transcript results
            transcriptResults.forEach(transcript => {
                const snippet = extractSnippet(transcript.text, searchTerm, 300);
                const highlights = getHighlights(transcript.text, searchTerm);

                results.push({
                    type: 'transcript',
                    id: transcript.id,
                    meetingId: transcript.meetingId,
                    title: transcript.meeting.title,
                    snippet,
                    highlights: highlights.slice(0, 3),
                    relevance: calculateRelevance(searchTerm, transcript.text, snippet),
                    createdAt: transcript.createdAt.toISOString(),
                    platform: transcript.meeting.platform,
                    status: transcript.meeting.status,
                });
            });

            // Search in summaries
            const summaryResults = await fastify.prisma.summary.findMany({
                where: {
                    meeting: { orgId, ...baseWhere },
                    summaryText: { contains: searchTerm, mode: 'insensitive' },
                },
                include: {
                    meeting: {
                        select: {
                            id: true,
                            title: true,
                            platform: true,
                            status: true,
                        },
                    },
                },
                take: limit,
            });

            // Add summary results
            summaryResults.forEach(summary => {
                const snippet = extractSnippet(summary.summaryText, searchTerm, 300);
                const highlights = getHighlights(summary.summaryText, searchTerm);

                results.push({
                    type: 'summary',
                    id: summary.id,
                    meetingId: summary.meetingId,
                    title: summary.meeting.title,
                    snippet,
                    highlights: highlights.slice(0, 3),
                    relevance: calculateRelevance(searchTerm, summary.summaryText, snippet),
                    createdAt: summary.createdAt.toISOString(),
                    platform: summary.meeting.platform,
                    status: summary.meeting.status,
                });
            });

            // Sort by relevance and apply pagination
            results.sort((a, b) => b.relevance - a.relevance);

            const startIndex = cursor ? results.findIndex(r => r.id === cursor) + 1 : 0;
            const endIndex = startIndex + limit;
            const paginatedResults = results.slice(startIndex, endIndex);

            const hasMore = endIndex < results.length;
            const nextCursor = hasMore ? paginatedResults[paginatedResults.length - 1]?.id : null;

            return reply.send({
                data: paginatedResults,
                pagination: {
                    cursor: nextCursor,
                    hasMore,
                    total: results.length,
                },
            });
        } catch (error) {
            fastify.log.error(error, 'Search failed');
            throw fastify.httpErrors.internalServerError('Search failed');
        }
    });

    // Get search suggestions
    fastify.get('/search/suggestions', {
        preHandler: [requireAuth, requireOrgAccess],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    q: { type: 'string', minLength: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 10, default: 5 },
                },
                required: ['q'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        suggestions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    text: { type: 'string' },
                                    type: { type: 'string' },
                                    count: { type: 'number' },
                                },
                            },
                        },
                    },
                },
                401: ErrorResponseSchema,
                403: ErrorResponseSchema,
            },
            tags: ['Search'],
            summary: 'Get search suggestions',
            description: 'Returns search suggestions based on partial query',
        },
    }, async (request: FastifyRequest<{
        Querystring: { q: string, limit?: number }
    }>, reply: FastifyReply) => {
        const { orgId } = request.user;
        const { q: query, limit = 5 } = request.query;

        try {
            const suggestions: Array<{ text: string, type: string, count: number }> = [];

            // Get meeting title suggestions
            const meetingTitles = await fastify.prisma.meeting.findMany({
                where: {
                    orgId,
                    title: { contains: query, mode: 'insensitive' },
                },
                select: { title: true },
                distinct: ['title'],
                take: limit,
            });

            meetingTitles.forEach(meeting => {
                suggestions.push({
                    text: meeting.title,
                    type: 'meeting_title',
                    count: 1,
                });
            });

            // Get platform suggestions
            if ('zoom'.includes(query.toLowerCase()) || 'google'.includes(query.toLowerCase()) || 'teams'.includes(query.toLowerCase())) {
                const platforms = ['zoom', 'google-meet', 'teams'].filter(p =>
                    p.toLowerCase().includes(query.toLowerCase())
                );

                for (const platform of platforms) {
                    const count = await fastify.prisma.meeting.count({
                        where: { orgId, platform },
                    });

                    if (count > 0) {
                        suggestions.push({
                            text: platform,
                            type: 'platform',
                            count,
                        });
                    }
                }
            }

            // Sort by relevance and limit
            suggestions.sort((a, b) => b.count - a.count);

            return reply.send({
                suggestions: suggestions.slice(0, limit),
            });
        } catch (error) {
            fastify.log.error(error, 'Failed to get search suggestions');
            throw fastify.httpErrors.internalServerError('Failed to get search suggestions');
        }
    });
}

// Helper functions
function getHighlights(text: string, searchTerm: string, maxHighlights = 5): string[] {
    const highlights: string[] = [];
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    const matches = text.match(regex);

    if (matches) {
        const sentences = text.split(/[.!?]+/);

        for (const sentence of sentences) {
            if (regex.test(sentence) && highlights.length < maxHighlights) {
                const highlightedSentence = sentence.trim().replace(regex, '<mark>$1</mark>');
                highlights.push(truncateText(highlightedSentence, 100));
            }
        }
    }

    return highlights;
}

function extractSnippet(text: string, searchTerm: string, maxLength = 300): string {
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());

    if (index === -1) {
        return truncateText(text, maxLength);
    }

    // Extract text around the search term
    const start = Math.max(0, index - Math.floor(maxLength / 2));
    const end = Math.min(text.length, start + maxLength);

    let snippet = text.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function calculateRelevance(searchTerm: string, ...texts: string[]): number {
    let score = 0;
    const term = searchTerm.toLowerCase();

    for (const text of texts) {
        if (!text) continue;

        const lowerText = text.toLowerCase();

        // Exact match bonus
        if (lowerText === term) score += 100;

        // Title/beginning bonus
        if (lowerText.startsWith(term)) score += 50;

        // Word boundary matches
        const wordMatches = (lowerText.match(new RegExp(`\\b${escapeRegex(term)}\\b`, 'g')) || []).length;
        score += wordMatches * 20;

        // Partial matches
        const partialMatches = (lowerText.match(new RegExp(escapeRegex(term), 'g')) || []).length;
        score += partialMatches * 5;

        // Length penalty (shorter texts are more relevant)
        score += Math.max(0, 50 - text.length / 100);
    }

    return score;
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
