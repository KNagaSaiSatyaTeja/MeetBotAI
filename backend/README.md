# AI Meeting Bot - Backend API

Production-ready REST API service for AI Meeting Bot with Fastify, Prisma, and BullMQ job queues.

## Features

- **REST API**: Fastify-based API with OpenAPI documentation
- **Authentication**: API keys + OAuth2 Client Credentials for B2B
- **Database**: PostgreSQL with Prisma ORM
- **Job Queues**: BullMQ with Redis for async processing
- **Storage**: S3-compatible storage (AWS S3, MinIO)
- **AI Integration**: Speech-to-text and LLM summarization adapters
- **Security**: Rate limiting, RBAC, input validation, audit logging
- **Observability**: Structured logging with Pino, OpenTelemetry ready

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- S3-compatible storage (MinIO for local dev)

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/aimeet
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ai-meeting-bot
# ... see shared/src/config/README.md for full env vars
```

### Database Setup

```bash
npm run db:generate
npm run db:push
```

### Development

```bash
npm run dev
```

API will be available at `http://localhost:3000`
Swagger UI at `http://localhost:3000/docs`

## API Endpoints

- `POST /v1/meetings` - Create meeting
- `POST /v1/meetings/:id/recording` - Upload recording
- `GET /v1/meetings/:id` - Get meeting details
- `GET /v1/meetings/:id/transcript` - Get transcript
- `GET /v1/meetings/:id/summary` - Get AI summary
- `GET /v1/meetings` - List meetings with search/filters
- `POST /v1/webhooks` - Register webhook

## Architecture

### Clean Architecture Layers

- **API Layer**: Fastify routes with Zod validation
- **Business Logic**: Domain services and use cases
- **Data Layer**: Prisma repositories
- **External Adapters**: STT, LLM, Storage providers

### Job Processing

- **Transcribe Job**: Audio → Text via STT providers
- **Summarize Job**: Transcript → Summary via LLM providers
- **Retention Job**: Cleanup old recordings
- **Webhook Job**: Deliver event notifications

## Security

- JWT token validation
- API key authentication
- Rate limiting (60 req/min per key)
- Input validation with Zod
- RBAC with organization boundaries
- Audit logging for sensitive operations
- S3 signed URLs for secure file access

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Linting
npm run lint

# Type checking
npm run typecheck
```

## Deployment

```bash
# Build
npm run build

# Production
npm start
```

See `/infra` directory for Docker and Kubernetes deployment configs.

## Monitoring

- Structured JSON logs via Pino
- OpenTelemetry instrumentation
- Prometheus metrics endpoint at `/metrics`
- Health check at `/health`
