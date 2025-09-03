// Domain types derived from Prisma schema
// These types should match the Prisma-generated types

export interface User {
    id: string;
    orgId: string;
    role: UserRole;
    email: string;
    provider: string;
    consentFlags: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Organization {
    id: string;
    name: string;
    plan: string;
    region: string;
    retentionDays: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Meeting {
    id: string;
    orgId: string;
    title: string;
    platform: string;
    meetingLink: string | null;
    scheduledAt: Date | null;
    startedAt: Date | null;
    endedAt: Date | null;
    status: MeetingStatus;
    consentFlags: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Recording {
    id: string;
    meetingId: string;
    hasVideo: boolean;
    audioUrl: string | null;
    videoUrl: string | null;
    sizeBytes: bigint;
    checksum: string | null;
    storageRegion: string;
    encryptionMeta: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Transcript {
    id: string;
    meetingId: string;
    language: string;
    text: string;
    wordsJson: Word[];
    speakerTurnsJson: SpeakerTurn[];
    accuracy: number | null;
    readyAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Summary {
    id: string;
    meetingId: string;
    model: string;
    summaryText: string;
    decisionsJson: Decision[];
    actionItemsJson: ActionItem[];
    participantsJson: Participant[];
    readyAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Job {
    id: string;
    type: string;
    status: JobStatus;
    attempts: number;
    payloadJson: Record<string, any>;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ApiKey {
    id: string;
    orgId: string;
    hash: string;
    label: string;
    scopes: string[];
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AuditLog {
    id: string;
    orgId: string;
    actorType: ActorType;
    actorId: string;
    action: string;
    metaJson: Record<string, any>;
    createdAt: Date;
}

export interface Webhook {
    id: string;
    orgId: string;
    url: string;
    secret: string;
    events: string[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface WebhookDelivery {
    id: string;
    webhookId: string;
    event: string;
    payloadJson: Record<string, any>;
    status: WebhookStatus;
    attempts: number;
    responseCode: number | null;
    responseBody: string | null;
    nextRetryAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// Enums
export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
    SERVICE = 'SERVICE',
}

export enum MeetingStatus {
    SCHEDULED = 'SCHEDULED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

export enum JobStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

export enum ActorType {
    USER = 'USER',
    API_KEY = 'API_KEY',
    SYSTEM = 'SYSTEM',
}

export enum WebhookStatus {
    PENDING = 'PENDING',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

// Nested types
export interface Word {
    word: string;
    start: number;
    end: number;
    confidence?: number;
}

export interface SpeakerTurn {
    speaker: string;
    start: number;
    end: number;
    text: string;
}

export interface Decision {
    decision: string;
    owner?: string;
    dueDate?: string;
}

export interface ActionItem {
    task: string;
    owner?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
}

export interface Participant {
    name: string;
    email?: string;
    role?: string;
    speakingTime?: number;
}

// Utility types
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserInput = Partial<Pick<User, 'role' | 'consentFlags'>>;

export type CreateOrganizationInput = Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateOrganizationInput = Partial<Pick<Organization, 'name' | 'plan' | 'retentionDays'>>;

export type CreateMeetingInput = Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'startedAt' | 'endedAt'>;
export type UpdateMeetingInput = Partial<Pick<Meeting, 'title' | 'status' | 'startedAt' | 'endedAt'>>;

export type CreateRecordingInput = Omit<Recording, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateTranscriptInput = Omit<Transcript, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateSummaryInput = Omit<Summary, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateApiKeyInput = Omit<ApiKey, 'id' | 'hash' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>;

export type CreateWebhookInput = Omit<Webhook, 'id' | 'secret' | 'createdAt' | 'updatedAt'>;
export type UpdateWebhookInput = Partial<Pick<Webhook, 'url' | 'events' | 'active'>>;

// Relations with includes
export interface MeetingWithRelations extends Meeting {
    recordings?: Recording[];
    transcripts?: Transcript[];
    summaries?: Summary[];
}

export interface UserWithOrganization extends User {
    organization: Organization;
}

export interface WebhookWithDeliveries extends Webhook {
    deliveries?: WebhookDelivery[];
}
