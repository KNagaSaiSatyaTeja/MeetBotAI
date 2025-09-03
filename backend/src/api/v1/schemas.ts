import { z } from 'zod';

// Common schemas
export const IdParamSchema = z.object({
    id: z.string().cuid(),
});

export const PaginationQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
});

export const SearchQuerySchema = z.object({
    search: z.string().optional(),
    platform: z.enum(['zoom', 'google-meet', 'teams']).optional(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
}).merge(PaginationQuerySchema);

// Meeting schemas
export const CreateMeetingSchema = z.object({
    title: z.string().min(1).max(255),
    platform: z.enum(['zoom', 'google-meet', 'teams']),
    meetingLink: z.string().url().optional(),
    scheduledAt: z.string().datetime().optional(),
    consentFlags: z.record(z.boolean()).optional(),
});

export const MeetingQuerySchema = z.object({
    record: z.coerce.boolean().default(false),
    audio: z.coerce.boolean().default(false),
    video: z.coerce.boolean().default(false),
});

export const UploadRecordingSchema = z.object({
    hasVideo: z.coerce.boolean().default(false),
    language: z.string().default('en'),
});

// Webhook schemas
export const CreateWebhookSchema = z.object({
    url: z.string().url(),
    events: z.array(z.enum([
        'meeting.created',
        'meeting.started',
        'meeting.completed',
        'meeting.failed',
        'recording.uploaded',
        'transcript.ready',
        'summary.ready',
    ])),
    active: z.boolean().default(true),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

// API Key schemas
export const CreateApiKeySchema = z.object({
    label: z.string().min(1).max(100),
    scopes: z.array(z.enum([
        'meetings:read',
        'meetings:write',
        'recordings:read',
        'recordings:write',
        'transcripts:read',
        'summaries:read',
        'webhooks:read',
        'webhooks:write',
    ])),
});

// Response schemas
export const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.any()).optional(),
});

export const SuccessResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    message: z.string().optional(),
});

export const PaginatedResponseSchema = z.object({
    data: z.array(z.any()),
    pagination: z.object({
        cursor: z.string().nullable(),
        hasMore: z.boolean(),
        total: z.number().optional(),
    }),
});

// Meeting response schemas
export const MeetingResponseSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    title: z.string(),
    platform: z.string(),
    meetingLink: z.string().nullable(),
    scheduledAt: z.string().datetime().nullable(),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']),
    consentFlags: z.record(z.any()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    recordings: z.array(z.object({
        id: z.string(),
        hasVideo: z.boolean(),
        audioUrl: z.string().nullable(),
        videoUrl: z.string().nullable(),
        sizeBytes: z.string(), // BigInt as string
        createdAt: z.string().datetime(),
    })).optional(),
    transcripts: z.array(z.object({
        id: z.string(),
        language: z.string(),
        text: z.string(),
        accuracy: z.number().nullable(),
        readyAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
    })).optional(),
    summaries: z.array(z.object({
        id: z.string(),
        model: z.string(),
        summaryText: z.string(),
        decisionsJson: z.array(z.any()),
        actionItemsJson: z.array(z.any()),
        participantsJson: z.array(z.any()),
        readyAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
    })).optional(),
});

export const TranscriptResponseSchema = z.object({
    id: z.string(),
    meetingId: z.string(),
    language: z.string(),
    text: z.string(),
    words: z.array(z.object({
        word: z.string(),
        start: z.number(),
        end: z.number(),
        confidence: z.number().optional(),
    })),
    speakerTurns: z.array(z.object({
        speaker: z.string(),
        start: z.number(),
        end: z.number(),
        text: z.string(),
    })),
    accuracy: z.number().nullable(),
    readyAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
});

export const SummaryResponseSchema = z.object({
    id: z.string(),
    meetingId: z.string(),
    model: z.string(),
    summaryText: z.string(),
    decisions: z.array(z.object({
        decision: z.string(),
        owner: z.string().optional(),
        dueDate: z.string().datetime().optional(),
    })),
    actionItems: z.array(z.object({
        task: z.string(),
        owner: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
    })),
    participants: z.array(z.object({
        name: z.string(),
        email: z.string().optional(),
        role: z.string().optional(),
        speakingTime: z.number().optional(),
    })),
    readyAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
});

// Webhook response schemas
export const WebhookResponseSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    url: z.string(),
    events: z.array(z.string()),
    active: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deliveries: z.array(z.object({
        id: z.string(),
        event: z.string(),
        status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'CANCELLED']),
        attempts: z.number(),
        responseCode: z.number().nullable(),
        createdAt: z.string().datetime(),
    })).optional(),
});

// Export type definitions
export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;
export type MeetingQuery = z.infer<typeof MeetingQuerySchema>;
export type UploadRecordingInput = z.infer<typeof UploadRecordingSchema>;
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;
export type MeetingResponse = z.infer<typeof MeetingResponseSchema>;
export type TranscriptResponse = z.infer<typeof TranscriptResponseSchema>;
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
