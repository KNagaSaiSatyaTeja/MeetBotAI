#!/bin/bash

# =================================
# AI Meeting Bot Development Startup
# =================================

echo "🚀 Starting AI Meeting Bot Development Environment..."

# Set environment variables
export BACKEND_PORT=5000
export FRONTEND_PORT=3000
export REDIS_PORT=6379
export POSTGRES_PORT=5432
export MINIO_API_PORT=9000
export MINIO_CONSOLE_PORT=9001

echo "📋 Port Configuration:"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   Redis:    localhost:$REDIS_PORT"
echo "   Postgres: localhost:$POSTGRES_PORT"
echo "   MinIO:    http://localhost:$MINIO_API_PORT"
echo "   MinIO Console: http://localhost:$MINIO_CONSOLE_PORT"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start Redis if not running
if ! docker ps | grep -q redis; then
    echo "🔴 Starting Redis..."
    docker run -d --name meetbot-redis -p $REDIS_PORT:6379 redis:7-alpine
else
    echo "✅ Redis is already running"
fi

# Start PostgreSQL if not running
if ! docker ps | grep -q postgres; then
    echo "🐘 Starting PostgreSQL..."
    docker run -d --name meetbot-postgres \
        -p $POSTGRES_PORT:5432 \
        -e POSTGRES_DB=aimeet_dev \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=password \
        postgres:15
else
    echo "✅ PostgreSQL is already running"
fi

# Start MinIO if not running
if ! docker ps | grep -q minio; then
    echo "📦 Starting MinIO..."
    docker run -d --name meetbot-minio \
        -p $MINIO_API_PORT:9000 \
        -p $MINIO_CONSOLE_PORT:9001 \
        -e MINIO_ROOT_USER=minioadmin \
        -e MINIO_ROOT_PASSWORD=minioadmin \
        minio/minio server /data --console-address ":9001"
else
    echo "✅ MinIO is already running"
fi

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for PostgreSQL
echo "   Waiting for PostgreSQL..."
until docker exec meetbot-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done

# Wait for Redis
echo "   Waiting for Redis..."
until docker exec meetbot-redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
done

# Wait for MinIO
echo "   Waiting for MinIO..."
until curl -s http://localhost:$MINIO_API_PORT/minio/health/live > /dev/null 2>&1; do
    sleep 1
done

echo ""
echo "✅ All services are ready!"
echo ""

# Start Backend
echo "🔧 Starting Backend (Port $BACKEND_PORT)..."
cd backend
export PORT=$BACKEND_PORT
npm run dev &
BACKEND_PID=$!

# Start Frontend
echo "🎨 Starting Frontend (Port $FRONTEND_PORT)..."
cd ../frontend
export PORT=$FRONTEND_PORT
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Development environment started!"
echo ""
echo "📱 Frontend: http://localhost:$FRONTEND_PORT"
echo "🔧 Backend:  http://localhost:$BACKEND_PORT"
echo "📊 MinIO Console: http://localhost:$MINIO_CONSOLE_PORT"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ Services stopped'; exit 0" INT

wait
