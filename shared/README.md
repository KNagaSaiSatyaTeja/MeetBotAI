# AI Meeting Bot - Shared Library

Shared TypeScript utilities, types, and configurations used across all AI Meeting Bot services.

## Features

- **Domain Types**: Prisma-derived and API types
- **Configuration**: Environment variable validation and management
- **Utilities**: Common functions for crypto, pagination, idempotency
- **Logging**: Structured logging with Pino and OpenTelemetry
- **Validation**: Zod schemas and validators

## Installation

```bash
npm install @ai-meeting-bot/shared
```

## Usage

### Types

```typescript
import { Meeting, User, Organization } from '@ai-meeting-bot/shared/types';
import { CreateMeetingRequest, MeetingResponse } from '@ai-meeting-bot/shared/types/api';

const meeting: Meeting = {
  id: 'meeting_123',
  title: 'Q3 Planning',
  // ...
};
```

### Configuration

```typescript
import { validateEnv, getConfig } from '@ai-meeting-bot/shared/config';

// Validate environment variables
const config = validateEnv({
  DATABASE_URL: 'string',
  REDIS_URL: 'string',
  S3_BUCKET: 'string',
});

// Get typed configuration
const { database, redis, storage } = getConfig();
```

### Utilities

```typescript
import { 
  generateIdempotencyKey,
  hashPassword,
  verifyPassword,
  paginateResults 
} from '@ai-meeting-bot/shared/utils';

// Generate idempotency key
const key = generateIdempotencyKey('create-meeting', userId);

// Hash password
const hashed = await hashPassword('password123');

// Paginate results
const paginated = paginateResults(results, { cursor: 'abc', limit: 20 });
```

### Logging

```typescript
import { createLogger, addTracing } from '@ai-meeting-bot/shared/logging';

// Create structured logger
const logger = createLogger('my-service');

logger.info({ userId: '123' }, 'User action performed');

// Add OpenTelemetry tracing
addTracing(logger);
```

## Environment Variables

Create a `.env` file or set environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Redis
REDIS_URL=redis://localhost:6379

# Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ai-meeting-bot
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# AI Services
STT_PROVIDER=whisper
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Security
JWT_SECRET=your-secret-key
API_RATE_LIMIT=60

# Application
NODE_ENV=development
LOG_LEVEL=info
REGION=us
RETENTION_DAYS=30
```

See `src/config/README.md` for complete environment variable documentation.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## Structure

```
src/
├── types/           # Type definitions
│   ├── domain.ts    # Prisma-derived domain types
│   ├── api.ts       # API request/response types
│   └── index.ts     # Type exports
├── config/          # Configuration management
│   ├── env.ts       # Environment validation
│   ├── index.ts     # Configuration exports
│   └── README.md    # Environment docs
├── utils/           # Utility functions
│   ├── crypto.ts    # Cryptographic utilities
│   ├── pagination.ts # Pagination helpers
│   ├── idempotency.ts # Idempotency utilities
│   └── index.ts     # Utility exports
├── logging/         # Logging utilities
│   ├── pino.ts      # Pino logger setup
│   ├── otel.ts      # OpenTelemetry integration
│   └── index.ts     # Logging exports
└── index.ts         # Main exports
```
