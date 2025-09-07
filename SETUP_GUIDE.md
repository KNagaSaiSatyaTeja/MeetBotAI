# Quick Setup Guide

This guide helps you get the MeetBotAI platform running quickly without external dependencies.

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)

## Quick Start (Minimal Setup)

### 1. Setup Environment Variables

**Backend**:
```bash
cd backend
cp env.example .env
```

Edit `.env` and set at minimum:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/meetbotai"
DIRECT_URL="postgresql://username:password@localhost:5432/meetbotai"
JWT_SECRET="your-super-secret-jwt-key-change-this"
```

**Frontend**:
```bash
cd frontend
cp env.example .env.local
```

The default values should work for local development.

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Setup Database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Create admin user
npm run db:setup
```

Follow the prompts to create your first admin user.

### 4. Start the Services

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

### 5. Access the Platform

- Frontend: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- API Docs: http://localhost:5000/docs

## What Works Without Redis

✅ **Full functionality**:
- User registration and authentication
- Admin dashboard and user management
- Meeting CRUD operations
- API token management
- All API endpoints

❌ **Background jobs disabled**:
- Bot workers (meeting recording)
- Transcription processing
- Summary generation
- Webhook delivery

## Adding Redis Later

To enable background jobs:

1. Install and start Redis:
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu/Debian
   sudo apt install redis-server
   sudo systemctl start redis
   
   # Windows
   # Use Docker: docker run -p 6379:6379 redis:alpine
   ```

2. Add to your `.env`:
   ```env
   REDIS_URL="redis://localhost:6379"
   ```

3. Restart the backend - Redis will be detected automatically.

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 5000
npx kill-port 5000
```

### Database Connection Issues
- Make sure PostgreSQL is running
- Check your DATABASE_URL format
- Ensure the database exists

### Permission Issues
- Make sure your database user has CREATE permissions
- Check that the database is accessible from your app

## Next Steps

Once the basic setup is working:

1. **Add Storage**: Configure AWS S3 or MinIO for file uploads
2. **Add AI Services**: Set up OpenAI/Whisper for transcription
3. **Add OAuth**: Configure Google/Microsoft OAuth
4. **Add Redis**: Enable background job processing
5. **Deploy**: Use Docker or deploy to your preferred platform

## Support

If you encounter issues:
1. Check the terminal output for specific error messages
2. Verify your environment variables
3. Ensure all prerequisites are installed and running
4. Check the troubleshooting section in the main README
