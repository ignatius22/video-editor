# Multi-stage Dockerfile for API, Worker, and Web services

# ── Base stage (shared Node dependencies for API & Worker) ──
FROM node:18-alpine AS base
RUN apk add --no-cache python3 make g++
# Set npm timeouts and retries for unstable networks
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

RUN npm ci --only=production --workspace=@convertix/shared --workspace=@convertix/database --workspace=@convertix/api --workspace=@convertix/worker && npm cache clean --force

COPY packages/shared ./packages/shared
COPY packages/database ./packages/database

# ── API Service ──
FROM base AS api
RUN apk add --no-cache ffmpeg
COPY apps/api ./apps/api
COPY apps/worker/queue ./apps/worker/queue
EXPOSE 3000
CMD ["node", "apps/api/server.js"]

# ── Worker Service ──
FROM base AS worker
RUN apk add --no-cache ffmpeg
COPY apps/worker ./apps/worker
CMD ["node", "apps/worker/worker.js"]

# ── Web Frontend (build stage — needs Node 22 for Vite 7 + Tailwind v4) ──
FROM node:22-alpine AS web-build
# Set npm timeouts and retries for unstable networks
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000
WORKDIR /app
COPY apps/web/package.json ./
RUN npm install && npm cache clean --force
COPY apps/web/ ./
RUN npm run build

# ── Web Frontend (serve stage) ──
FROM nginx:alpine AS web
COPY --from=web-build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
