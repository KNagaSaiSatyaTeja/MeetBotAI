// Export all types
export * from './domain';
export * from './api';

// Re-export commonly used types with aliases
export type {
    User as DomainUser,
    Meeting as DomainMeeting,
    Organization as DomainOrganization,
} from './domain';

export type {
    MeetingResponse as ApiMeeting,
    UserResponse as ApiUser,
    SearchResult as ApiSearchResult,
} from './api';
