# Multi-stage Dockerfile for API and Worker services

# Base stage - shared dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy shared code
COPY shared ./shared
COPY database ./database

# API Service stage
FROM base AS api
COPY api-service ./api-service
COPY worker-service/queue ./worker-service/queue

EXPOSE 3000
CMD ["node", "api-service/server.js"]

# Worker Service stage
FROM base AS worker

# Install FFmpeg for video/image processing
RUN apk add --no-cache ffmpeg

COPY worker-service ./worker-service

CMD ["node", "worker-service/worker.js"]
