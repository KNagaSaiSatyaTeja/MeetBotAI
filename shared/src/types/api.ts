// API request and response types

// Common API types
export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
    statusCode: number;
}

export interface PaginatedResponse<T = any> {
    data: T[];
    pagination: {
        cursor: string | null;
        hasMore: boolean;
        total?: number;
    };
}

export interface ErrorResponse {
    error: string;
    message: string;
    statusCode: number;
    details?: Record<string, any>;
}

// Meeting API types
export interface CreateMeetingRequest {
    title: string;
    platform: 'zoom' | 'google-meet' | 'teams';
    meetingLink?: string;
    scheduledAt?: string;
    consentFlags?: Record<string, boolean>;
}

export interface MeetingResponse {
    id: string;
    orgId: string;
    title: string;
    platform: string;
    meetingLink: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    consentFlags: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    recordings?: RecordingResponse[];
    transcripts?: TranscriptResponse[];
    summaries?: SummaryResponse[];
}

export interface RecordingResponse {
    id: string;
    hasVideo: boolean;
    audioUrl?: string;
    videoUrl?: string;
    sizeBytes: string; // BigInt as string
    createdAt: string;
}

export interface TranscriptResponse {
    id: string;
    meetingId: string;
    language: string;
    text: string;
    words: Array<{
        word: string;
        start: number;
        end: number;
        confidence?: number;
    }>;
    speakerTurns: Array<{
        speaker: string;
        start: number;
        end: number;
        text: string;
    }>;
    accuracy: number | null;
    readyAt: string | null;
    createdAt: string;
}

export interface SummaryResponse {
    id: string;
    meetingId: string;
    model: string;
    summaryText: string;
    decisions: Array<{
        decision: string;
        owner?: string;
        dueDate?: string;
    }>;
    actionItems: Array<{
        task: string;
        owner?: string;
        dueDate?: string;
        priority?: 'low' | 'medium' | 'high';
    }>;
    participants: Array<{
        name: string;
        email?: string;
        role?: string;
        speakingTime?: number;
    }>;
    readyAt: string | null;
    createdAt: string;
}

// Search API types
export interface SearchRequest {
    search?: string;
    platform?: 'zoom' | 'google-meet' | 'teams';
    status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
}

export interface SearchResult {
    type: 'meeting' | 'transcript' | 'summary';
    id: string;
    meetingId: string;
    title: string;
    snippet: string;
    highlights: string[];
    relevance: number;
    createdAt: string;
    platform?: string;
    status?: string;
}

export interface SearchResponse extends PaginatedResponse<SearchResult> { }

export interface SearchSuggestionsRequest {
    q: string;
    limit?: number;
}

export interface SearchSuggestion {
    text: string;
    type: string;
    count: number;
}

export interface SearchSuggestionsResponse {
    suggestions: SearchSuggestion[];
}

// Webhook API types
export interface CreateWebhookRequest {
    url: string;
    events: Array<
        | 'meeting.created'
        | 'meeting.started'
        | 'meeting.completed'
        | 'meeting.failed'
        | 'recording.uploaded'
        | 'transcript.ready'
        | 'summary.ready'
    >;
    active?: boolean;
}

export interface UpdateWebhookRequest {
    url?: string;
    events?: string[];
    active?: boolean;
}

export interface WebhookResponse {
    id: string;
    orgId: string;
    url: string;
    events: string[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deliveries?: WebhookDeliveryResponse[];
}

export interface WebhookDeliveryResponse {
    id: string;
    event: string;
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
    attempts: number;
    responseCode: number | null;
    createdAt: string;
}

// API Key types
export interface CreateApiKeyRequest {
    label: string;
    scopes: Array<
        | 'meetings:read'
        | 'meetings:write'
        | 'recordings:read'
        | 'recordings:write'
        | 'transcripts:read'
        | 'summaries:read'
        | 'webhooks:read'
        | 'webhooks:write'
    >;
}

export interface ApiKeyResponse {
    id: string;
    key?: string; // Only returned on creation
    label: string;
    scopes: string[];
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// Authentication types
export interface UserResponse {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'SERVICE';
    organization: {
        id: string;
        name: string;
        plan: string;
        region: string;
    };
}

export interface OAuthCallbackRequest {
    provider: 'google' | 'microsoft';
    code: string;
    state?: string;
}

export interface AuthResponse {
    token: string;
    user: UserResponse;
}

// Upload types
export interface UploadRecordingRequest {
    hasVideo?: boolean;
    language?: string;
}

export interface UploadResponse {
    success: boolean;
    recordingId: string;
    message?: string;
}

// Health check types
export interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime?: number;
    services: {
        database: 'connected' | 'disconnected';
        redis: 'connected' | 'disconnected';
        storage?: 'connected' | 'disconnected';
    };
    checkDuration?: number;
}

// Query parameter types
export interface MeetingQueryParams {
    record?: boolean;
    audio?: boolean;
    video?: boolean;
}

export interface PaginationParams {
    cursor?: string;
    limit?: number;
}

// Webhook event payload types
export interface WebhookEventPayload {
    event: string;
    timestamp: string;
    data: Record<string, any>;
}

export interface MeetingCreatedPayload extends WebhookEventPayload {
    event: 'meeting.created';
    data: {
        meetingId: string;
        title: string;
        platform: string;
        orgId: string;
    };
}

export interface TranscriptReadyPayload extends WebhookEventPayload {
    event: 'transcript.ready';
    data: {
        meetingId: string;
        transcriptId: string;
        language: string;
        accuracy?: number;
    };
}

export interface SummaryReadyPayload extends WebhookEventPayload {
    event: 'summary.ready';
    data: {
        meetingId: string;
        summaryId: string;
        keyTopics: string[];
        sentiment: string;
        decisionsCount: number;
        actionItemsCount: number;
    };
}

export interface MeetingProcessedPayload extends WebhookEventPayload {
    event: 'meeting.processed';
    data: {
        meetingId: string;
        transcriptId: string;
        summaryId: string;
        title: string;
        completedAt: string;
    };
}

// Type guards
export function isErrorResponse(response: any): response is ErrorResponse {
    return response && typeof response.error === 'string' && typeof response.statusCode === 'number';
}

export function isPaginatedResponse<T>(response: any): response is PaginatedResponse<T> {
    return response && Array.isArray(response.data) && response.pagination;
}

// API client types
export interface ApiClientConfig {
    baseUrl: string;
    apiKey?: string;
    token?: string;
    timeout?: number;
}

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    params?: Record<string, any>;
    body?: any;
    timeout?: number;
}
