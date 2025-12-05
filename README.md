# Video Editor Express

A production-ready, dual-deployment video processing platform built with Node.js and Express. Features a modern event-driven architecture with support for both monolithic and microservices deployment modes, complete with real-time job tracking, distributed processing, and comprehensive observability.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Project Structure](#project-structure)
- [Advanced Features](#advanced-features)
- [License](#license)

---

## Features

### Core Video Operations
- **Video Upload**: Stream-based upload for MP4 and MOV formats
- **Format Conversion**: Convert between MP4, MOV, AVI, WebM, MKV, and FLV
- **Video Resizing**: Scale videos to custom dimensions
- **Audio Extraction**: Extract audio tracks in AAC format
- **Thumbnail Generation**: Automatic thumbnail creation on upload

### Advanced Capabilities
- **Real-Time Updates**: WebSocket-based job progress notifications
- **Background Processing**: Redis-backed Bull queue with 5 concurrent workers
- **Job Retry Logic**: Exponential backoff retry (3 attempts: 2s, 4s, 8s)
- **Event-Driven Architecture**: RabbitMQ message broker for microservices
- **User Authentication**: Session-based auth with PostgreSQL storage
- **Distributed Tracing**: Jaeger integration for request tracking
- **Metrics & Monitoring**: Prometheus + Grafana dashboards
- **Queue Dashboard**: Bull Board for queue visualization

### Deployment Modes
- **Monolith**: Single-server or cluster mode (multi-core parallelization)
- **Microservices**: Docker Compose with 4 services + full observability stack

---

## Architecture

### Deployment Mode 1: Monolith with Clustering

```
┌─────────────────────────────────────────────────────────────┐
│                     Primary Process                          │
│  - Bull Queue Management                                     │
│  - Retry Logic (exponential backoff)                         │
│  - IPC Event Broadcasting                                    │
└────────────┬────────────────────────────────────────────────┘
             │
     ┌───────┴───────┬───────────┬───────────┐
     │               │           │           │
┌────▼────┐    ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
│Worker 1 │    │Worker 2 │ │Worker 3│ │Worker N│
│Express  │    │Express  │ │Express │ │Express │
│Socket.IO│    │Socket.IO│ │Socket.IO│ │Socket.IO│
└────┬────┘    └────┬────┘ └───┬────┘ └───┬────┘
     │              │           │           │
     └──────────────┴───────────┴───────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
    ┌─────▼──────┐    ┌──────▼──────┐
    │ PostgreSQL │    │    Redis    │
    │  (Videos)  │    │(Bull Queue) │
    └────────────┘    └─────────────┘
```

**Ports**: 8060 (HTTP/WebSocket), Bull Board at `/admin/queues`

### Deployment Mode 2: Microservices

```
┌──────────────────────────────────────────────────────────────┐
│                      API Gateway :3000                        │
│  - Rate Limiting (100 req/15min)                             │
│  - Proxy Routing                                             │
│  - Prometheus Metrics                                        │
└──────────────┬───────────────────────────────────────────────┘
               │
     ┌─────────┼─────────┬─────────────────┐
     │         │         │                 │
┌────▼─────┐ ┌▼────────┐ ┌▼────────┐ ┌───▼──────┐
│User Svc  │ │Video Svc│ │Job Svc  │ │RabbitMQ  │
│:3001     │ │:3002    │ │:3003    │ │:5672     │
│- Auth    │ │- Upload │ │- Queue  │ │- Events  │
│- Sessions│ │- Assets │ │- Workers│ │- PubSub  │
└────┬─────┘ └┬────────┘ └┬────────┘ └────┬─────┘
     │        │           │               │
     └────────┴───────────┴───────────────┘
              │           │
     ┌────────┴──────┐    └──────────┐
┌────▼────┐    ┌─────▼─────┐    ┌────▼────┐
│PostgreSQL│    │   Redis   │    │Observability│
│:5432     │    │   :6379   │    │Stack     │
└──────────┘    └───────────┘    └──────────┘
                                  - Prometheus:9090
                                  - Grafana:3100
                                  - Jaeger:16686
                                  - Loki:3101
```

---

## Prerequisites

### Required
- **Node.js** v12+ ([Download](https://nodejs.org/))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download))
- **FFmpeg** with FFprobe ([Download](https://ffmpeg.org/download.html))

### Optional (for Microservices)
- **Docker** & **Docker Compose** ([Install](https://docs.docker.com/get-docker/))
- **RabbitMQ** 3+ (or use Docker Compose)

---

## Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd video-editor-express
```

### 2. Install Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd video-editor-client
npm install
cd ..
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb video_editor

# Run schema migration
psql video_editor < database/schema.sql

# Verify tables created
psql video_editor -c "\dt"
# Expected: users, sessions, videos, video_operations, job_history
```

### 4. Start Redis
```bash
# Option 1: Local installation
redis-server --daemonize yes

# Option 2: Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 5. Create Required Directories
```bash
mkdir -p public storage data
```

### 6. Build Frontend (Production)
```bash
cd video-editor-client
npm run build
cd ..
```

---

## Running the Application

### Monolith Mode (Recommended for Development)

#### Single Server Mode
```bash
npm start
# Server: http://localhost:8060
# Bull Board: http://localhost:8060/admin/queues
# Frontend: http://localhost:8060/
```

#### Cluster Mode (Production)
```bash
npm run cluster
# Spawns N workers (N = CPU cores)
# Primary: Bull queue + retry logic
# Workers: HTTP + WebSocket handlers
```

### Microservices Mode (Production with Observability)

#### Using Docker Compose (Recommended)
```bash
cd services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api-gateway
docker-compose logs -f video-service

# Stop all
docker-compose down
```

**Access Points**:
- API Gateway: http://localhost:3000
- Grafana: http://localhost:3100 (admin/admin)
- Prometheus: http://localhost:9090
- Jaeger UI: http://localhost:16686
- RabbitMQ Management: http://localhost:15672 (admin/admin123)

#### Manual Startup (Local Development)
```bash
cd services

# 1. Start infrastructure
docker run -d -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management-alpine

# 2. Configure environment
cp user-service/.env.example user-service/.env
cp video-service/.env.example video-service/.env
cp job-service/.env.example job-service/.env
cp api-gateway/.env.example api-gateway/.env

# 3. Install dependencies
for service in user-service video-service job-service api-gateway; do
  cd $service && npm install && cd ..
done

# 4. Start services (separate terminals)
./start-all.sh

# Or manually:
# Terminal 1: cd user-service && npm start
# Terminal 2: cd video-service && npm start
# Terminal 3: cd job-service && npm start
# Terminal 4: cd api-gateway && npm start
```

---

## API Documentation

### Monolith Mode Endpoints (Port 8060)

#### User Routes
```http
POST   /api/login
Body: { "username": "string", "password": "string" }
Response: { "message": "success", "token": "string" }

DELETE /api/logout
Headers: Cookie with token
Response: { "message": "Logged out successfully" }

GET    /api/user
Headers: Cookie with token
Response: { "id": 1, "username": "string", "tier": "string" }

PUT    /api/user
Headers: Cookie with token
Body: { "username": "string", "password": "string" }
Response: { "message": "User updated successfully" }
```

#### Video Routes
```http
GET    /api/videos
Headers: Cookie with token
Response: [{ "videoId": "abc123", "name": "video.mp4", ... }]

POST   /api/upload-video
Headers:
  - Cookie with token
  - filename: "video.mp4"
Body: Binary video stream
Response: { "status": "success", "videoId": "abc123" }

PUT    /api/video/resize
Headers: Cookie with token
Body: { "videoId": "abc123", "width": 1920, "height": 1080 }
Response: { "status": "success", "message": "Video is being processed" }

PUT    /api/video/convert?videoId=abc123
Headers: Cookie with token
Body: { "format": "webm" }
Supported: mp4, mov, avi, webm, mkv, flv
Response: { "status": "success", "message": "Conversion started" }

PATCH  /api/video/extract-audio?videoId=abc123
Headers: Cookie with token
Response: { "status": "success", "message": "Audio extracted" }

GET    /get-video-asset?videoId=abc123&type=thumbnail
Types: thumbnail, audio, resize, original, converted
Query Params:
  - videoId (required)
  - type (required)
  - format (for type=converted)
  - dimensions (for type=resize, e.g., "1920x1080")
Response: Binary stream with appropriate MIME type
```

#### Admin Routes
```http
GET    /admin/queues
Description: Bull Board dashboard for queue monitoring
Features: Job inspection, retry, removal, queue pause/resume
```

### Microservices Mode Endpoints (Port 3000)

#### Gateway Routes
```http
GET    /health
Response: { "status": "ok", "timestamp": "ISO8601" }

GET    /api/services/status
Response: {
  "user-service": { "status": "up", "latency": 12 },
  "video-service": { "status": "up", "latency": 8 },
  "job-service": { "status": "up", "latency": 5 }
}

GET    /metrics
Response: Prometheus metrics (text format)
```

#### Proxied Service Routes
All routes prefixed with `/api/auth/`, `/api/videos/`, `/api/jobs/` are proxied to respective services.

### WebSocket Events (Port 8060)

#### Client → Server
```javascript
socket.emit('subscribe-video', videoId);
socket.emit('unsubscribe-video', videoId);
```

#### Server → Client
```javascript
socket.on('job:queued', (data) => {
  // { jobId, type, videoId, queuePosition, queuedAt }
});

socket.on('job:started', (data) => {
  // { jobId, type, videoId, startedAt, queuedAt }
});

socket.on('job:progress', (data) => {
  // { jobId, type, videoId, progress: 0-100 }
});

socket.on('job:completed', (data) => {
  // { jobId, videoId, result, duration, completedAt }
});

socket.on('job:failed', (data) => {
  // { jobId, videoId, error, currentAttempt, maxRetries }
});

socket.on('job:permanent-failure', (data) => {
  // { jobId, videoId, totalAttempts, error }
});
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Database**: PostgreSQL 12+ with pg 8.16.3 (connection pooling)
- **Queue**: Bull 4.16.5 (Redis-backed, 5 concurrent workers)
- **WebSocket**: Socket.IO 4.8.1
- **Authentication**: bcrypt 6.0.0 (10 salt rounds)
- **Video Processing**: FFmpeg (cpeak wrapper)

### Microservices
- **Message Broker**: RabbitMQ 3 (AMQP, topic exchange)
- **Event Bus**: amqplib with correlation IDs
- **API Gateway**: http-proxy-middleware
- **Rate Limiting**: express-rate-limit (100 req/15min)

### Frontend
- **Framework**: React 18.2.0
- **Router**: react-router-dom 6.3.0
- **HTTP Client**: axios 0.27.2
- **Build**: Webpack 5.73.0 + Babel 7.18.9

### Observability (Microservices)
- **Metrics**: Prometheus 2.x
- **Dashboards**: Grafana 9.x
- **Tracing**: Jaeger 1.x
- **Logs**: Loki 2.x
- **Queue Monitoring**: Bull Board 6.14.2

---

## Database Schema

### Tables

#### users
```sql
id              SERIAL PRIMARY KEY
username        VARCHAR(100) UNIQUE NOT NULL
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
tier            VARCHAR(20) DEFAULT 'free'
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### sessions
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
token       VARCHAR(255) UNIQUE NOT NULL
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
expires_at  TIMESTAMP NOT NULL
```

#### videos
```sql
id          SERIAL PRIMARY KEY
video_id    VARCHAR(50) UNIQUE NOT NULL
user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
name        VARCHAR(255) NOT NULL
extension   VARCHAR(10) CHECK (extension IN ('mp4','mov','avi','webm','mkv','flv'))
dimensions  JSONB                -- { "width": 1920, "height": 1080 }
metadata    JSONB DEFAULT '{}'   -- { "extractedAudio": false }
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### video_operations
```sql
id              SERIAL PRIMARY KEY
video_id        VARCHAR(50) REFERENCES videos(video_id) ON DELETE CASCADE
operation_type  VARCHAR(20) NOT NULL  -- 'resize', 'convert', 'extract_audio'
status          VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'processing', 'completed', 'failed'
parameters      JSONB NOT NULL        -- { "width": 1920, "height": 1080 } or { "targetFormat": "webm" }
result_path     TEXT
error_message   TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### job_history
```sql
id              SERIAL PRIMARY KEY
job_id          VARCHAR(100) UNIQUE
video_id        VARCHAR(50)
user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL
type            VARCHAR(50)    -- 'resize', 'convert'
status          VARCHAR(20)    -- 'completed', 'failed'
priority        VARCHAR(20)    -- 'high', 'normal', 'low'
progress        INTEGER        -- 0-100
queued_at       TIMESTAMP
started_at      TIMESTAMP
completed_at    TIMESTAMP
duration_ms     INTEGER
error_message   TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Indexes
```sql
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_video_id ON videos(video_id);
CREATE INDEX idx_operations_video_id ON video_operations(video_id);
CREATE INDEX idx_operations_status ON video_operations(status);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

---

## Deployment

### Monolith Production Deployment

#### Using PM2 (Cluster Mode)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/cluster.js --name video-editor -i max

# Monitor
pm2 monit

# Logs
pm2 logs video-editor

# Restart
pm2 restart video-editor

# Auto-restart on server reboot
pm2 startup
pm2 save
```

#### Environment Variables
Create `.env` file:
```bash
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=your_secure_password
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Microservices Docker Deployment

#### Production Docker Compose
```bash
cd services

# Build images
docker-compose build

# Start all services
docker-compose up -d

# Scale services
docker-compose up -d --scale video-service=3 --scale job-service=2

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart video-service

# Stop all
docker-compose down
```

#### Health Checks
```bash
# Gateway health
curl http://localhost:3000/health

# All services status
curl http://localhost:3000/api/services/status

# RabbitMQ
curl -u admin:admin123 http://localhost:15672/api/healthchecks/node

# Prometheus targets
curl http://localhost:9090/api/v1/targets
```

---

## Monitoring & Observability

### Bull Board (Monolith)
**URL**: http://localhost:8060/admin/queues

**Features**:
- Real-time queue statistics (waiting, active, completed, failed)
- Job inspection (data, progress, logs, error stack traces)
- Manual job retry/removal
- Queue pause/resume
- Clean old jobs (bulk operations)

### Grafana Dashboards (Microservices)
**URL**: http://localhost:3100
**Credentials**: admin/admin

**Pre-configured Dashboards**:
1. **Microservices Overview**
   - Service health indicators (up/down status)
   - Request rate (requests/sec per service)
   - p95 response times
   - Error rate percentages (4xx, 5xx)

2. **Queue Monitoring**
   - Bull queue depth (waiting, active jobs)
   - Job completion rate (jobs/min)
   - Failed job count (last 24h)
   - Average job duration

3. **Database Metrics**
   - Active connections / Pool utilization
   - Query duration (p50, p95, p99)
   - Connection errors

4. **Error Tracking**
   - 5xx errors by service
   - Log correlation with traces

### Prometheus Metrics
**URL**: http://localhost:9090

**Key Metrics**:
```promql
# HTTP Requests
http_requests_total{service="video-service", method="POST", path="/upload"}

# Request Duration
http_request_duration_seconds{service="api-gateway", quantile="0.95"}

# Queue Depth
bull_queue_waiting{queue_name="video-processing"}

# Database Connections
db_connections_active
```

### Jaeger Distributed Tracing
**URL**: http://localhost:16686

**Features**:
- End-to-end request tracing across services
- Service dependency graph
- Latency analysis (identify bottlenecks)
- Error correlation

### Alerts
**Configuration**: `services/observability/prometheus/alerts.yml`

**Alert Rules**:
- **Critical**: ServiceDown (>1min), HighErrorRate (>5% for 5min)
- **Warning**: HighResponseTime (>1s), HighCPUUsage (>80%), QueueBacklog (>100 jobs)

---

## Project Structure

```
video-editor-express/
├── src/                          # Monolith application
│   ├── controllers/
│   │   ├── user.js              # Authentication, profile management
│   │   └── video.js             # Upload, resize, convert, extract audio
│   ├── middleware/
│   │   └── index.js             # Auth middleware, error handling
│   ├── index.js                 # Main server (Port 8060)
│   ├── cluster.js               # Cluster mode with retry logic
│   ├── router.js                # API route definitions
│   └── bullBoard.js             # Queue dashboard setup
│
├── services/                     # Microservices architecture
│   ├── api-gateway/             # Entry point (Port 3000)
│   │   ├── gateway.js           # Proxy routing, rate limiting
│   │   └── healthChecks.js      # Service status checks
│   ├── user-service/            # Authentication (Port 3001)
│   │   └── server.js            # User CRUD, session management
│   ├── video-service/           # Video management (Port 3002)
│   │   └── server.js            # Upload, metadata, operations
│   ├── job-service/             # Background processing (Port 3003)
│   │   ├── server.js            # Job API
│   │   └── queue/BullQueue.js   # Bull queue wrapper
│   ├── shared/                  # Shared libraries
│   │   ├── database/            # PostgreSQL connection pool
│   │   ├── eventBus/            # RabbitMQ event bus (272 lines)
│   │   └── middleware/          # Prometheus metrics middleware
│   ├── observability/           # Monitoring stack configs
│   │   ├── prometheus/          # Metrics collection
│   │   ├── grafana/             # Dashboards
│   │   ├── jaeger/              # Distributed tracing
│   │   └── loki/                # Log aggregation
│   ├── docker-compose.yml       # Full stack deployment
│   ├── start-all.sh             # Local startup script
│   └── stop-all.sh              # Shutdown script
│
├── lib/                          # Core libraries
│   ├── BullQueue.js             # Redis job queue (5 workers, progress tracking)
│   ├── FF.js                    # FFmpeg wrapper (resize, convert, extract)
│   └── util.js                  # File utilities, MIME detection
│
├── database/                     # PostgreSQL setup
│   ├── schema.sql               # Schema (5 tables, indexes, triggers)
│   ├── db.js                    # Connection pool (max 20)
│   ├── services/                # Data access layer
│   │   ├── userService.js       # User CRUD, authentication
│   │   ├── sessionService.js    # Session lifecycle
│   │   ├── videoService.js      # Video CRUD, operations
│   │   └── jobHistoryService.js # Job analytics
│   └── migrate-from-files.js    # Legacy data migration
│
├── video-editor-client/          # React frontend
│   ├── src/
│   │   ├── components/          # Login, Videos, Uploader, Modals
│   │   ├── hooks/               # useVideo (API calls, state)
│   │   ├── reusable/            # Button, Modal, Loading
│   │   └── index.js             # App entry, routing
│   ├── webpack.config.js        # Build configuration
│   └── package.json
│
├── public/                       # Static files (served by Express)
│   ├── index.html               # SPA entry point
│   ├── scripts.js               # Bundled React app
│   ├── styles.css               # Global styles
│   └── websocket-demo.html      # WebSocket demo page
│
├── storage/                      # Video file storage (git-ignored)
│   └── {videoId}/
│       ├── original.{ext}       # Uploaded video
│       ├── thumbnail.jpg        # Auto-generated thumbnail
│       ├── audio.aac            # Extracted audio
│       ├── {width}x{height}.{ext}  # Resized videos
│       └── converted.{format}   # Format conversions
│
├── data/                         # Legacy file storage (deprecated)
├── package.json                  # Backend dependencies
└── README.md
```

---

## Advanced Features

### Event-Driven Architecture (Microservices)

**Event Bus**: `services/shared/eventBus/EventBus.js` (272 lines)

**Event Types**:
```javascript
// User Events
'user.registered', 'user.logged_in', 'user.logged_out', 'user.updated', 'user.deleted'

// Video Events
'video.uploaded', 'video.updated', 'video.deleted',
'video.processing.requested', 'video.processed', 'video.processing.failed'

// Job Events
'job.created', 'job.started', 'job.progress', 'job.completed', 'job.failed'
```

**Features**:
- Correlation IDs for distributed tracing
- Dead letter queues for failed messages
- Automatic retries (max 3 attempts with exponential backoff)
- Message persistence (RabbitMQ durability)

**Event Flow Example** (Video Resize):
```
1. Client → Video Service: POST /api/videos/resize
2. Video Service → DB: Create operation (status: pending)
3. Video Service → RabbitMQ: Publish VIDEO_PROCESSING_REQUESTED
4. RabbitMQ → Job Service: Route to job-service queue
5. Job Service → Bull Queue: Enqueue resize job
6. Bull Worker: Process FFmpeg resize
7. Job Service → RabbitMQ: Publish JOB_COMPLETED
8. Video Service ← RabbitMQ: Receive event
9. Video Service → DB: Update operation (status: completed)
10. Video Service → WebSocket: Broadcast to client
```

### Bull Queue Configuration

**File**: `lib/BullQueue.js`

**Settings**:
- **Concurrency**: 5 jobs in parallel
- **Redis**: localhost:6379 (configurable)
- **Job Retention**: 100 completed, 200 failed
- **Priority Levels**: High (1), Normal (5), Low (10)
- **Progress Milestones**: 10%, 25%, 75%, 100%

**Lifecycle**:
```
Enqueue → Waiting → Active → Processing → Completed/Failed
   ↓         ↓         ↓          ↓            ↓
  Redis   Bull     Worker    Progress      Event
          Queue    Pool      Updates      Emission
```

**Recovery on Restart**:
```javascript
// Restores incomplete jobs from database
await videoService.getPendingOperations(100);
// Re-enqueues pending resize/convert operations
```

### Retry Logic

**File**: `src/cluster.js` (lines 85-142)

**Configuration**:
- **Max Retries**: 3
- **Backoff Strategy**: Exponential (2s, 4s, 8s)
- **Tracking**: In-memory Map (jobId → attempt count)
- **Cleanup**: Auto-remove on success or permanent failure

**Flow**:
```
Job Fails
   ↓
Check Attempt Count
   ↓
< 3 Attempts?
   ├─ Yes → Wait (2^attempt * 2s) → Re-enqueue
   └─ No  → Emit 'job:permanent-failure' → Cleanup
```

### WebSocket Real-Time Updates

**File**: `src/index.js` (lines 16-94)

**Architecture**:
```
Primary Process (Bull Queue)
    ↓ IPC Messages
Worker Processes (cluster.workers)
    ↓ Socket.IO Broadcast
Clients (Browser WebSocket)
```

**Event Data**:
```javascript
// job:queued
{ jobId, type, videoId, queuePosition, queuedAt }

// job:progress
{ jobId, type, videoId, progress: 0-100 }

// job:completed
{ jobId, videoId, result, duration, queuedAt, startedAt, completedAt }

// job:failed
{ jobId, videoId, error, stack, currentAttempt, maxRetries }
```

### FFmpeg Operations

**File**: `lib/FF.js`

**Functions**:
1. **resize(input, output, width, height)**
   - Filter: `scale=${width}:${height}`
   - Codec: Copy (no re-encoding)

2. **convertFormat(input, output, format)**
   - MP4/MOV: libx264 + aac
   - AVI: mpeg4 + libmp3lame
   - WebM: libvpx-vp9 + libopus
   - MKV: libx264 + aac

3. **extractAudio(input, output)**
   - Method: `-vn -c:a copy` (stream copy)
   - Format: AAC

4. **makeThumbnail(input, output)**
   - Frame: 5 seconds
   - Size: 320x180
   - Format: JPEG

5. **getDimensions(input)**
   - Uses: ffprobe
   - Returns: `{ width, height }`

---

## Environment Configuration

### Monolith (.env)
```bash
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Microservices

**API Gateway** (`services/api-gateway/.env`):
```bash
GATEWAY_PORT=3000
USER_SERVICE_URL=http://localhost:3001
VIDEO_SERVICE_URL=http://localhost:3002
JOB_SERVICE_URL=http://localhost:3003
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
NODE_ENV=development
```

**User Service** (`services/user-service/.env`):
```bash
USER_SERVICE_PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=postgres
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
```

**Video Service** (`services/video-service/.env`):
```bash
VIDEO_SERVICE_PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=postgres
USER_SERVICE_URL=http://localhost:3001
JOB_SERVICE_URL=http://localhost:3003
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
```

**Job Service** (`services/job-service/.env`):
```bash
JOB_SERVICE_PORT=3003
REDIS_HOST=localhost
REDIS_PORT=6379
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=postgres
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
```

---

## Troubleshooting

### Common Issues

**Issue**: Database connection error
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify database exists
psql -l | grep video_editor

# Test connection
psql video_editor -c "SELECT NOW();"
```

**Issue**: Redis connection error
```bash
# Check Redis is running
redis-cli ping
# Expected: PONG

# Start Redis
redis-server --daemonize yes
```

**Issue**: FFmpeg not found
```bash
# Check installation
ffmpeg -version
ffprobe -version

# Install on Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Install on macOS
brew install ffmpeg
```

**Issue**: Bull queue jobs stuck
```bash
# Access Bull Board
# Navigate to http://localhost:8060/admin/queues
# Check "Active" tab for hung jobs
# Manually retry or remove stuck jobs
```

**Issue**: Port already in use
```bash
# Find process using port 8060
lsof -i :8060

# Kill process
kill -9 <PID>

# Or change port in src/index.js
```

---

## Performance Tuning

### Database Optimization
```sql
-- Add indexes for frequent queries
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_operations_status_created ON video_operations(status, created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM videos WHERE user_id = 1;

-- Vacuum and analyze
VACUUM ANALYZE videos;
```

### Redis Optimization
```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Persistence
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

### Bull Queue Tuning
Edit `lib/BullQueue.js`:
```javascript
// Increase concurrency
this.CONCURRENCY = 10; // Default: 5

// Adjust job retention
removeOnComplete: 50,  // Default: 100
removeOnFail: 100      // Default: 200
```

### Cluster Mode Workers
Edit `src/cluster.js`:
```javascript
// Manual worker count (default: CPU cores)
const workerCount = 4;
for (let i = 0; i < workerCount; i++) {
  cluster.fork();
}
```

---

## Contributing

### Development Workflow
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style
- ESLint configuration (future)
- Prettier formatting (future)
- Follow existing patterns in codebase

---

## Documentation

### Additional Guides
- [Bull Redis Queue Guide](BULL_REDIS_GUIDE.md) - Detailed queue setup
- [Advanced Features](ADVANCED_FEATURES.md) - Format conversion, retry logic
- [Event-Driven Architecture](EVENT_DRIVEN_GUIDE.md) - Microservices event bus

### API Testing
Postman collection available: `postman_collection.json` (if exists)

---

## License

ISC

---

## Author

**Ignatius Sani**

---

## Acknowledgments

- **FFmpeg** - Video processing engine
- **Bull** - Robust queue system
- **PostgreSQL** - Reliable database
- **Socket.IO** - Real-time communication
- **RabbitMQ** - Event-driven messaging
- **Prometheus/Grafana** - Observability stack
