# AI Meeting Bot - Worker Service

Background job processing service using BullMQ and Redis for handling transcription, summarization, and webhook delivery tasks.

## Features

- **Job Processing**: BullMQ-powered job queue with Redis
- **Transcription**: Audio/video to text conversion using multiple STT providers
- **Summarization**: AI-powered meeting summarization with action items
- **Webhook Delivery**: Reliable webhook notifications with retries
- **Retention**: Automated cleanup of old recordings and data
- **Observability**: Structured logging, metrics, and health checks
- **Scalability**: Horizontal scaling with multiple worker instances

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Service   │───▶│   Redis Queue   │◀───│  Worker Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Job Storage   │    │   External APIs │
                       │   (PostgreSQL)  │    │  (STT/LLM/S3)   │
                       └─────────────────┘    └─────────────────┘
```

## Job Types

### Transcription Jobs
- Process uploaded audio/video recordings
- Convert speech to text using configurable STT providers
- Extract speaker turns and word-level timestamps
- Store results in PostgreSQL

### Summarization Jobs
- Analyze meeting transcripts using LLM providers
- Extract decisions, action items, and participants
- Generate structured meeting summaries
- Support multiple AI models (OpenAI, Azure, Gemini, etc.)

### Webhook Jobs
- Deliver event notifications to registered webhooks
- HMAC signature verification for security
- Exponential backoff retry logic
- Dead letter queue for failed deliveries

### Retention Jobs
- Clean up expired recordings based on organization policies
- Remove files from storage (S3/MinIO)
- Audit trail for compliance
- Scheduled daily execution

## Quick Start

### Prerequisites

- Node.js 18+
- Redis 6+
- PostgreSQL 14+
- S3-compatible storage

### Installation

```bash
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure required variables
DATABASE_URL=postgresql://user:pass@localhost:5432/aimeet
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ai-meeting-bot

# AI Service Configuration
STT_PROVIDER=whisper
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Optional: Provider-specific settings
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=...
GEMINI_API_KEY=...
```

### Development

```bash
# Start worker in development mode
npm run dev

# Build for production
npm run build

# Start production worker
npm start
```

### Testing

```bash
# Run unit tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck
```

## Configuration

### Job Concurrency

Configure concurrent job processing per queue:

```typescript
// In src/index.ts
const workers = {
  transcribe: { concurrency: 2 },  // CPU intensive
  summarize: { concurrency: 1 },   // Memory intensive
  webhook: { concurrency: 5 },     // I/O bound
  retention: { concurrency: 1 },   // Resource cleanup
};
```

### Provider Selection

Switch between AI providers via environment variables:

```bash
# Speech-to-Text providers
STT_PROVIDER=whisper    # OpenAI Whisper (default)
STT_PROVIDER=aws        # AWS Transcribe
STT_PROVIDER=gcp        # Google Speech-to-Text
STT_PROVIDER=azure      # Azure Speech Services

# LLM providers
LLM_PROVIDER=openai     # OpenAI GPT (default)
LLM_PROVIDER=azure      # Azure OpenAI
LLM_PROVIDER=gemini     # Google Gemini
LLM_PROVIDER=hf         # Hugging Face
```

### Retry Configuration

Customize retry behavior per job type:

```typescript
const retryConfig = {
  transcribe: { attempts: 3, backoff: 'exponential' },
  summarize: { attempts: 2, backoff: 'fixed' },
  webhook: { attempts: 5, backoff: 'exponential' },
  retention: { attempts: 1 }, // No retries for cleanup
};
```

## Monitoring

### Health Checks

- `GET /health` - Overall service health
- `GET /ready` - Readiness for traffic
- `GET /metrics` - Prometheus metrics

### Logging

Structured JSON logs with correlation IDs:

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "jobId": "job_123",
  "jobType": "transcribe",
  "meetingId": "meet_456",
  "orgId": "org_789",
  "msg": "Transcription job completed"
}
```

### Metrics

Key metrics exposed for monitoring:

- `jobs_processed_total` - Total jobs processed by type
- `jobs_failed_total` - Failed jobs by type and reason
- `job_duration_seconds` - Job processing duration
- `queue_size` - Current queue depth
- `worker_active_jobs` - Active jobs per worker

## Deployment

### Docker

```bash
# Build image
docker build -t ai-meeting-bot-worker .

# Run container
docker run -d \
  --name worker \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  ai-meeting-bot-worker
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
      - name: worker
        image: ai-meeting-bot-worker:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Scaling

Scale workers horizontally based on queue depth:

```bash
# Manual scaling
kubectl scale deployment worker --replicas=5

# Auto-scaling (HPA)
kubectl autoscale deployment worker \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

## Security

- **Secure Configuration**: Environment variables for sensitive data
- **Network Security**: Redis AUTH, TLS connections
- **Data Protection**: Encryption at rest and in transit
- **Access Control**: Isolated worker processes
- **Audit Logging**: All job executions logged

## Troubleshooting

### Common Issues

**Jobs stuck in queue:**
```bash
# Check Redis connection
redis-cli ping

# Monitor queue status
redis-cli llen bullmq:transcribe:waiting
```

**High memory usage:**
```bash
# Reduce concurrency
TRANSCRIBE_CONCURRENCY=1

# Check for memory leaks
node --max-old-space-size=512 dist/index.js
```

**STT/LLM failures:**
```bash
# Check provider credentials
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Verify network connectivity
ping api.openai.com
```

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

Inspect job data:

```bash
# Redis CLI
redis-cli
> LRANGE bullmq:transcribe:waiting 0 -1
> HGETALL bullmq:transcribe:job_123
```

## Contributing

1. Follow TypeScript and ESLint configurations
2. Add tests for new job handlers
3. Update documentation for new features
4. Use conventional commit messages
