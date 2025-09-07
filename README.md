# MeetBotAI - Scalable Meeting Bot Platform

A comprehensive Meeting Bot Platform with admin and user views, supporting Google Meet, Zoom, and Microsoft Teams with full API integration.

## 🌟 Features

### 👥 User Management
- **User Registration & Login**: Username/password and OAuth (Google, Microsoft, Zoom)
- **Role-Based Access**: User and Admin roles with different privileges
- **API Token Management**: Users can generate personal API tokens for integrations
- **Account Management**: Profile settings and company information

### 🤖 Meeting Bot Integration
- **Multi-Platform Support**: Google Meet (WebRTC), Zoom (SDK/Cloud), Microsoft Teams (Graph API + ACS)
- **Automated Recording**: Audio/video capture with cloud storage
- **AI Processing**: Whisper transcription + Gemini summarization
- **Real-time Status**: Bot join tracking and meeting status updates

### 👤 User Dashboard
- **Meeting Management**: Add meetings via UI, view personal meetings only
- **Status Tracking**: scheduled → bot_joined → recording → transcript_ready → summary_ready → archived
- **Content Access**: Download recordings, transcripts, summaries
- **API Integration**: Personal API tokens for programmatic access
- **Webhook Management**: Register webhooks for account events

### 🔧 Admin Dashboard
- **User Oversight**: View all users, manage account status, role management
- **System Monitoring**: View all meetings across users, bot worker status, queue monitoring
- **Token Management**: Revoke/regenerate API tokens for any user
- **System Health**: Monitor Supabase storage usage, API usage per user
- **Audit Logs**: Bot join failures, Whisper/Gemini errors, admin actions

### 🚀 B2B API
- **RESTful API**: Complete API for all platform functionality
- **Authentication**: JWT tokens and API key authentication
- **Rate Limiting**: Per-user and per-API-key rate limiting
- **Documentation**: OpenAPI/Swagger documentation
- **Webhooks**: Event-driven notifications for integrations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Bot Workers   │
│   (Next.js)     │◄──►│   (Fastify)     │◄──►│   (Puppeteer)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   (Prisma ORM)  │
                       └─────────────────┘
```

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand
- **Backend**: Fastify, Prisma ORM, TypeScript
- **Database**: PostgreSQL with Prisma migrations
- **Authentication**: JWT + API tokens, OAuth integration
- **Bot Engine**: Puppeteer for Google Meet, Zoom SDK, Microsoft Graph API
- **AI Processing**: OpenAI Whisper (transcription), Google Gemini (summarization)
- **Storage**: S3-compatible storage for recordings
- **Queue**: Redis + BullMQ for background jobs
- **Monitoring**: OpenTelemetry, Prometheus metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis (for job queue)
- S3-compatible storage (AWS S3, MinIO, etc.)

### 1. Clone and Install
```bash
git clone <repository-url>
cd MeetBotAI

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

**Backend (.env)**:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/meetbotai"
DIRECT_URL="postgresql://username:password@localhost:5432/meetbotai"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-here"

# Redis
REDIS_URL="redis://localhost:6379"

# Storage (S3-compatible)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="meetbotai-recordings"

# AI Services
OPENAI_API_KEY="your-openai-key"
GOOGLE_AI_API_KEY="your-gemini-key"

# OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Setup
```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Run setup script to create admin user
npm run db:setup
```

The setup script will prompt you to create the first admin user and provide you with login credentials.

### 4. Start the Services
```bash
# Start backend (terminal 1)
cd backend
npm run dev

# Start frontend (terminal 2)
cd frontend
npm run dev

# Start worker (terminal 3) - optional for bot functionality
cd worker
npm run dev
```

### 5. Access the Platform
- **Frontend**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin
- **API Documentation**: http://localhost:5000/docs

## 📱 Usage

### For Users
1. **Sign Up**: Create account at `/register`
2. **Add Meetings**: Use the dashboard to add meeting links
3. **Monitor Status**: Track bot joining and processing status
4. **Access Content**: Download recordings, transcripts, summaries
5. **API Integration**: Generate API tokens for programmatic access
6. **Webhooks**: Set up webhooks for real-time notifications

### For Admins
1. **User Management**: View and manage all user accounts
2. **System Monitoring**: Monitor bot workers and system health
3. **Meeting Oversight**: View all meetings across the platform
4. **Token Management**: Revoke API tokens if needed
5. **Audit Logs**: Review system activities and errors

## 🔌 API Usage

### Authentication
```bash
# Using API token
curl -H "X-API-Key: mbt_your_token_here" \
     http://localhost:5000/v1/meetings

# Using JWT token
curl -H "Authorization: Bearer your_jwt_token" \
     http://localhost:5000/v1/meetings
```

### Create Meeting
```bash
curl -X POST http://localhost:5000/v1/meetings \
  -H "X-API-Key: mbt_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Weekly Standup",
    "platform": "google-meet",
    "meetingLink": "https://meet.google.com/abc-def-ghi",
    "scheduledAt": "2024-01-15T10:00:00Z"
  }'
```

### List Meetings
```bash
curl -H "X-API-Key: mbt_your_token_here" \
     "http://localhost:5000/v1/meetings?limit=10&status=COMPLETED"
```

### Get Meeting Details
```bash
curl -H "X-API-Key: mbt_your_token_here" \
     http://localhost:5000/v1/meetings/meeting_id
```

## 🔧 Configuration

### Bot Configuration
Configure bot workers in `worker/config.ts`:
```typescript
export const BOT_CONFIG = {
  google_meet: {
    enabled: true,
    max_concurrent: 5,
    timeout: 3600000, // 1 hour
  },
  zoom: {
    enabled: true,
    sdk_key: process.env.ZOOM_SDK_KEY,
    sdk_secret: process.env.ZOOM_SDK_SECRET,
  },
  teams: {
    enabled: true,
    tenant_id: process.env.MICROSOFT_TENANT_ID,
    client_id: process.env.MICROSOFT_CLIENT_ID,
  }
};
```

### Storage Configuration
The platform supports multiple storage backends:
- AWS S3
- MinIO (self-hosted)
- Google Cloud Storage
- Azure Blob Storage

### AI Processing
- **Transcription**: OpenAI Whisper API or self-hosted Whisper
- **Summarization**: Google Gemini, OpenAI GPT-4, or Azure OpenAI

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or use the production configuration
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring

The platform includes comprehensive monitoring:
- **Health Checks**: `/health` endpoint for service monitoring
- **Metrics**: Prometheus metrics for system performance
- **Logging**: Structured logging with request tracing
- **Audit Trail**: All admin actions and API usage logged

## 🔒 Security Features

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control (RBAC)
- **API Security**: Rate limiting, request validation, CORS protection
- **Data Protection**: Encrypted storage, secure token generation
- **Audit Logging**: Complete audit trail of all system activities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` directory for detailed guides
- **API Reference**: Available at `/docs` when running the backend
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced AI features (sentiment analysis, speaker identification)
- [ ] Integration marketplace (Slack, Discord, etc.)
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Enterprise SSO integration
- [ ] Advanced bot customization options

---

Built with ❤️ for seamless meeting management and AI-powered insights.