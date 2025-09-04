// Fastify-compatible schemas (JSON Schema format)
export const IdParamSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', pattern: '^c[a-z0-9]{24}$' }
    },
    required: ['id']
};

export const PaginationQuerySchema = {
    type: 'object',
    properties: {
        cursor: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
    }
};

export const SearchQuerySchema = {
    type: 'object',
    properties: {
        search: { type: 'string' },
        platform: { type: 'string', enum: ['zoom', 'google-meet', 'teams'] },
        status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'] },
        dateFrom: { type: 'string', format: 'date-time' },
        dateTo: { type: 'string', format: 'date-time' },
        cursor: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
    }
};

// Meeting schemas
export const CreateMeetingSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        platform: { type: 'string', enum: ['zoom', 'google-meet', 'teams'] },
        meetingLink: { type: 'string', format: 'uri' },
        scheduledAt: { type: 'string', format: 'date-time' },
        consentFlags: { type: 'object', additionalProperties: { type: 'boolean' } }
    },
    required: ['title', 'platform']
};

export const MeetingQuerySchema = {
    type: 'object',
    properties: {
        record: { type: 'boolean', default: false },
        audio: { type: 'boolean', default: false },
        video: { type: 'boolean', default: false }
    }
};

export const UploadRecordingSchema = {
    type: 'object',
    properties: {
        hasVideo: { type: 'boolean', default: false },
        language: { type: 'string', default: 'en' }
    }
};

// Webhook schemas
export const CreateWebhookSchema = {
    type: 'object',
    properties: {
        url: { type: 'string', format: 'uri' },
        events: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'meeting.created',
                    'meeting.started',
                    'meeting.completed',
                    'meeting.failed',
                    'recording.uploaded',
                    'transcript.ready',
                    'summary.ready'
                ]
            }
        },
        active: { type: 'boolean', default: true }
    },
    required: ['url', 'events']
};

export const UpdateWebhookSchema = {
    type: 'object',
    properties: {
        url: { type: 'string', format: 'uri' },
        events: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'meeting.created',
                    'meeting.started',
                    'meeting.completed',
                    'meeting.failed',
                    'recording.uploaded',
                    'transcript.ready',
                    'summary.ready'
                ]
            }
        },
        active: { type: 'boolean' }
    }
};

// API Key schemas
export const CreateApiKeySchema = {
    type: 'object',
    properties: {
        label: { type: 'string', minLength: 1, maxLength: 100 },
        scopes: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'meetings:read',
                    'meetings:write',
                    'recordings:read',
                    'recordings:write',
                    'transcripts:read',
                    'summaries:read',
                    'webhooks:read',
                    'webhooks:write'
                ]
            }
        }
    },
    required: ['label', 'scopes']
};

// Response schemas
export const ErrorResponseSchema = {
    type: 'object',
    properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
        details: { type: 'object', additionalProperties: true }
    },
    required: ['error', 'message', 'statusCode']
};

export const SuccessResponseSchema = {
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        data: { type: 'object', additionalProperties: true },
        message: { type: 'string' }
    },
    required: ['success']
};

// Bot lifecycle schemas
export const BotJoinRequestSchema = {
    type: 'object',
    properties: {
        meetingLink: { type: 'string', format: 'uri' },
        title: { type: 'string', minLength: 1 },
        consentFlags: {
            type: 'object',
            properties: {
                recording: { type: 'boolean' },
                transcription: { type: 'boolean' },
                summary: { type: 'boolean' },
            },
            additionalProperties: false,
        },
    },
    required: ['meetingLink'],
    additionalProperties: false,
} as const;

export const PaginatedResponseSchema = {
    type: 'object',
    properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        pagination: {
            type: 'object',
            properties: {
                cursor: { type: ['string', 'null'] },
                hasMore: { type: 'boolean' },
                total: { type: 'number' }
            },
            required: ['cursor', 'hasMore']
        }
    },
    required: ['data', 'pagination']
};

// Meeting response schemas
export const MeetingResponseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        orgId: { type: 'string' },
        title: { type: 'string' },
        platform: { type: 'string' },
        meetingLink: { type: ['string', 'null'] },
        scheduledAt: { type: ['string', 'null'], format: 'date-time' },
        startedAt: { type: ['string', 'null'], format: 'date-time' },
        endedAt: { type: ['string', 'null'], format: 'date-time' },
        status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'] },
        consentFlags: { type: 'object', additionalProperties: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        recordings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    hasVideo: { type: 'boolean' },
                    audioUrl: { type: ['string', 'null'] },
                    videoUrl: { type: ['string', 'null'] },
                    sizeBytes: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' }
                },
                required: ['id', 'hasVideo', 'createdAt']
            }
        },
        transcripts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    language: { type: 'string' },
                    text: { type: 'string' },
                    accuracy: { type: ['number', 'null'] },
                    readyAt: { type: ['string', 'null'], format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' }
                },
                required: ['id', 'language', 'text', 'createdAt']
            }
        },
        summaries: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    model: { type: 'string' },
                    summaryText: { type: 'string' },
                    decisionsJson: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    actionItemsJson: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    participantsJson: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    readyAt: { type: ['string', 'null'], format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' }
                },
                required: ['id', 'model', 'summaryText', 'createdAt']
            }
        }
    },
    required: ['id', 'orgId', 'title', 'platform', 'status', 'createdAt', 'updatedAt']
};

export const TranscriptResponseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        meetingId: { type: 'string' },
        language: { type: 'string' },
        text: { type: 'string' },
        words: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    word: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' },
                    confidence: { type: 'number' }
                },
                required: ['word', 'start', 'end']
            }
        },
        speakerTurns: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    speaker: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' },
                    text: { type: 'string' }
                },
                required: ['speaker', 'start', 'end', 'text']
            }
        },
        accuracy: { type: ['number', 'null'] },
        readyAt: { type: ['string', 'null'], format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'meetingId', 'language', 'text', 'createdAt']
};

export const SummaryResponseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        meetingId: { type: 'string' },
        model: { type: 'string' },
        summaryText: { type: 'string' },
        decisions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    decision: { type: 'string' },
                    owner: { type: 'string' },
                    dueDate: { type: 'string', format: 'date-time' }
                },
                required: ['decision']
            }
        },
        actionItems: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    task: { type: 'string' },
                    owner: { type: 'string' },
                    dueDate: { type: 'string', format: 'date-time' },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'] }
                },
                required: ['task']
            }
        },
        participants: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string' },
                    speakingTime: { type: 'number' }
                },
                required: ['name']
            }
        },
        readyAt: { type: ['string', 'null'], format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'meetingId', 'model', 'summaryText', 'createdAt']
};

// Webhook response schemas
export const WebhookResponseSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        orgId: { type: 'string' },
        url: { type: 'string' },
        events: { type: 'array', items: { type: 'string' } },
        active: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        deliveries: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    event: { type: 'string' },
                    status: { type: 'string', enum: ['PENDING', 'DELIVERED', 'FAILED', 'CANCELLED'] },
                    attempts: { type: 'number' },
                    responseCode: { type: ['number', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' }
                },
                required: ['id', 'event', 'status', 'attempts', 'createdAt']
            }
        }
    },
    required: ['id', 'orgId', 'url', 'events', 'active', 'createdAt', 'updatedAt']
};
