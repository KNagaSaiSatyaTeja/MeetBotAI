import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Role-based access control middleware
export async function rbacMiddleware(fastify: FastifyInstance) {
    // Register RBAC helpers
    fastify.decorateRequest('can', function (this: FastifyRequest, action: string, resource?: string) {
        return checkPermission(this.user, action, resource);
    });

    fastify.decorateRequest('cannot', function (this: FastifyRequest, action: string, resource?: string) {
        return !checkPermission(this.user, action, resource);
    });
}

// Extend FastifyRequest to include RBAC methods
declare module 'fastify' {
    interface FastifyRequest {
        can(action: string, resource?: string): boolean;
        cannot(action: string, resource?: string): boolean;
    }
}

// Permission definitions
const PERMISSIONS = {
    // User permissions
    USER: {
        'meetings:read': true,
        'meetings:write': true,
        'recordings:read': true,
        'recordings:write': true,
        'transcripts:read': true,
        'summaries:read': true,
        'search:read': true,
    },

    // Admin permissions (includes all user permissions plus admin-specific ones)
    ADMIN: {
        'meetings:read': true,
        'meetings:write': true,
        'meetings:delete': true,
        'recordings:read': true,
        'recordings:write': true,
        'recordings:delete': true,
        'transcripts:read': true,
        'transcripts:delete': true,
        'summaries:read': true,
        'summaries:delete': true,
        'webhooks:read': true,
        'webhooks:write': true,
        'webhooks:delete': true,
        'api-keys:read': true,
        'api-keys:write': true,
        'api-keys:delete': true,
        'users:read': true,
        'users:write': true,
        'users:delete': true,
        'organization:read': true,
        'organization:write': true,
        'search:read': true,
        'analytics:read': true,
        'audit-logs:read': true,
    },

    // Service account permissions (API keys)
    SERVICE: {
        // Service accounts get permissions based on their scopes
        // This is handled dynamically in checkPermission
    },
};

// Resource-based permissions
const RESOURCE_PERMISSIONS = {
    // Organization-level resources
    'organization': {
        'read': ['ADMIN'],
        'write': ['ADMIN'],
    },

    // User management
    'users': {
        'read': ['ADMIN'],
        'write': ['ADMIN'],
        'delete': ['ADMIN'],
    },

    // Meeting resources
    'meetings': {
        'read': ['USER', 'ADMIN'],
        'write': ['USER', 'ADMIN'],
        'delete': ['ADMIN'],
    },

    // Recording resources
    'recordings': {
        'read': ['USER', 'ADMIN'],
        'write': ['USER', 'ADMIN'],
        'delete': ['ADMIN'],
    },

    // Transcript resources
    'transcripts': {
        'read': ['USER', 'ADMIN'],
        'delete': ['ADMIN'],
    },

    // Summary resources
    'summaries': {
        'read': ['USER', 'ADMIN'],
        'delete': ['ADMIN'],
    },

    // Webhook resources
    'webhooks': {
        'read': ['ADMIN'],
        'write': ['ADMIN'],
        'delete': ['ADMIN'],
    },

    // API key resources
    'api-keys': {
        'read': ['ADMIN'],
        'write': ['ADMIN'],
        'delete': ['ADMIN'],
    },

    // Search functionality
    'search': {
        'read': ['USER', 'ADMIN'],
    },

    // Analytics
    'analytics': {
        'read': ['ADMIN'],
    },

    // Audit logs
    'audit-logs': {
        'read': ['ADMIN'],
    },
};

// Check if user has permission for action on resource
function checkPermission(user: any, action: string, resource?: string): boolean {
    if (!user) return false;

    // Super admin bypass (if implemented)
    if (user.role === 'SUPER_ADMIN') return true;

    // For service accounts (API keys), check scopes
    if (user.type === 'api_key' && user.scopes) {
        return checkApiKeyPermission(user.scopes, action, resource);
    }

    // Check role-based permissions
    const userPermissions = PERMISSIONS[user.role as keyof typeof PERMISSIONS];
    if (!userPermissions) return false;

    // If no resource specified, check direct permission
    if (!resource) {
        return !!userPermissions[action as keyof typeof userPermissions];
    }

    // Check resource-based permissions
    const resourcePerms = RESOURCE_PERMISSIONS[resource as keyof typeof RESOURCE_PERMISSIONS];
    if (!resourcePerms) return false;

    const actionPerms = resourcePerms[action as keyof typeof resourcePerms];
    if (!actionPerms) return false;

    return actionPerms.includes(user.role);
}

// Check API key scopes against required permission
function checkApiKeyPermission(scopes: string[], action: string, resource?: string): boolean {
    // Wildcard scope grants all permissions
    if (scopes.includes('*')) return true;

    // Build required permission string
    const permission = resource ? `${resource}:${action}` : action;

    // Check exact permission match
    if (scopes.includes(permission)) return true;

    // Check wildcard resource permissions (e.g., "meetings:*")
    if (resource) {
        const wildcardPermission = `${resource}:*`;
        if (scopes.includes(wildcardPermission)) return true;
    }

    // Check read-only permissions for write actions (if API key has read access)
    if (action === 'write' && resource) {
        const readPermission = `${resource}:read`;
        if (scopes.includes(readPermission)) {
            // Some resources allow write if you have read (like creating meetings)
            const writeAllowedResources = ['meetings', 'recordings', 'webhooks'];
            return writeAllowedResources.includes(resource);
        }
    }

    return false;
}

// Middleware factory for requiring specific permissions
export function requirePermission(action: string, resource?: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            throw request.server.httpErrors.unauthorized('Authentication required');
        }

        if (!checkPermission(request.user, action, resource)) {
            const permission = resource ? `${resource}:${action}` : action;
            throw request.server.httpErrors.forbidden(`Permission '${permission}' required`);
        }
    };
}

// Middleware for checking organization ownership of resources
export function requireResourceOwnership(resourceType: string, resourceIdParam = 'id') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            throw request.server.httpErrors.unauthorized('Authentication required');
        }

        const resourceId = (request.params as any)[resourceIdParam];
        if (!resourceId) {
            throw request.server.httpErrors.badRequest(`Missing ${resourceIdParam} parameter`);
        }

        const orgId = request.user.orgId;
        let resource: any = null;

        // Check resource ownership based on type
        switch (resourceType) {
            case 'meeting':
                resource = await request.server.prisma.meeting.findFirst({
                    where: { id: resourceId, orgId },
                    select: { id: true, orgId: true },
                });
                break;

            case 'webhook':
                resource = await request.server.prisma.webhook.findFirst({
                    where: { id: resourceId, orgId },
                    select: { id: true, orgId: true },
                });
                break;

            case 'api-key':
                resource = await request.server.prisma.apiKey.findFirst({
                    where: { id: resourceId, orgId },
                    select: { id: true, orgId: true },
                });
                break;

            case 'transcript':
                resource = await request.server.prisma.transcript.findFirst({
                    where: {
                        id: resourceId,
                        meeting: { orgId },
                    },
                    select: { id: true },
                });
                break;

            case 'summary':
                resource = await request.server.prisma.summary.findFirst({
                    where: {
                        id: resourceId,
                        meeting: { orgId },
                    },
                    select: { id: true },
                });
                break;

            default:
                throw request.server.httpErrors.internalServerError(`Unknown resource type: ${resourceType}`);
        }

        if (!resource) {
            throw request.server.httpErrors.notFound(`${resourceType} not found or access denied`);
        }
    };
}

// Helper to get user's effective permissions
export function getUserPermissions(user: any): string[] {
    if (!user) return [];

    if (user.type === 'api_key' && user.scopes) {
        return user.scopes;
    }

    const rolePermissions = PERMISSIONS[user.role as keyof typeof PERMISSIONS];
    if (!rolePermissions) return [];

    return Object.keys(rolePermissions).filter(
        permission => rolePermissions[permission as keyof typeof rolePermissions]
    );
}

// Helper to check if user can access organization data
export function canAccessOrganization(user: any, targetOrgId: string): boolean {
    if (!user) return false;

    // Users can only access their own organization
    if (user.type === 'user') {
        return user.orgId === targetOrgId;
    }

    // API keys can only access their organization's data
    if (user.type === 'api_key') {
        return user.orgId === targetOrgId;
    }

    return false;
}

// Data filtering helper - filters results based on organization access
export function filterByOrganization<T extends { orgId?: string }>(
    user: any,
    data: T[]
): T[] {
    if (!user) return [];

    return data.filter(item =>
        item.orgId && canAccessOrganization(user, item.orgId)
    );
}

// Export permission constants for use in other modules
export { PERMISSIONS, RESOURCE_PERMISSIONS };
