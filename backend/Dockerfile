# Multi-stage build for production
FROM node:20-slim AS base

# Install system dependencies for Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxext6 \
    libxfixes3 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libgconf-2-4 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    pulseaudio \
    alsa-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

# Production stage
FROM base AS production

# Create non-root user
RUN groupadd -r meetingbot && useradd -r -g meetingbot meetingbot

# Copy built application
COPY --from=build --chown=meetingbot:meetingbot /app/dist ./dist
COPY --from=build --chown=meetingbot:meetingbot /app/node_modules ./node_modules
COPY --from=build --chown=meetingbot:meetingbot /app/prisma ./prisma
COPY --from=build --chown=meetingbot:meetingbot /app/package.json ./

# Create recordings directory
RUN mkdir -p /app/recordings && chown meetingbot:meetingbot /app/recordings

# Set up audio permissions
RUN usermod -a -G audio meetingbot

# Switch to non-root user
USER meetingbot

# Expose ports
EXPOSE 5000 9464

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/index.js"]
