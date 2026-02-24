# Video Editor — Turborepo Monorepo

A modern, scalable video and image processing platform with a React frontend and Node.js backend. Built as a **Turborepo monorepo** with three apps and two shared packages.

## 🎯 Features

### Video Operations
- **Upload** — stream-based upload with automatic thumbnail generation
- **Format Conversion** — MP4, MOV, AVI, WebM, MKV, FLV
- **Resizing** — scale to custom dimensions
- **Audio Extraction** — extract audio tracks (MP3, WAV, AAC, OGG)

### Image Operations
- **Upload** — JPG, PNG, GIF, WebP, BMP, TIFF
- **Cropping** — precise x/y coordinates and dimensions
- **Resizing** — scale to custom dimensions
- **Format Conversion** — convert between image formats

### Platform
- **React Frontend** — Shadcn/ui dark theme, drag-and-drop uploads, real-time progress
- **Real-Time Updates** — WebSocket-based job progress via Socket.IO
- **Background Processing** — Redis-backed Bull queue with scalable workers
- **User Authentication** — session-based auth with HttpOnly cookies
- **Distributed Tracing** — OpenTelemetry integration

## 💰 Billing & Credits
The platform utilizes a **hardened ledger-first billing system** designed for production reliability.

### Core Invariants
- **Atomic Transactions**: All credit mutations involve both a ledger entry and a cached balance update in a single atomic database transaction.
- **Idempotency**: All operations require a `request_id` (UUID) to prevent double-charging on network retries.
- **State Machine Enforcement**: Database triggers prevent illegal transitions (e.g., refunding a captured charge or double-capturing a reservation).
- **Immutability**: Ledger entries are protected by database triggers that prevent any `UPDATE` or `DELETE` operations.

### Reservation Lifecycle
1. **Reserve**: Credits are earmarked and deducted from the user balance when a job is submitted.
2. **Capture**: Marker is added to the ledger on job success. No balance change occurs.
3. **Release**: Credits are added back to the balance if a job fails terminally or is cancelled.

## 🛠️ Operational Tools

### Reservation Janitor
Automated background worker in `apps/worker` that periodically (default 30m) audits the ledger for "stuck" reservations (orphaned jobs or crashed workers) and releases them.

### Reconciliation CLI
Manual audit and repair tool located in `apps/api/scripts/reconciliation.js`.

```bash
# Check for balance/ledger drift across all users
node scripts/reconciliation.js --mode check

# Explain detailed transaction history for a specific user
node scripts/reconciliation.js --mode explain --userId 123

# Repair drift using non-destructive compensating ledger entries
node scripts/reconciliation.js --mode repair --userId 123
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  WEB (port 5173)                              │
│  React + Vite + Shadcn/ui                                     │
│  Login page · Dashboard · Upload/Process modals               │
│  Nginx reverse proxy → API (/api/*, /socket.io/*)             │
└──────────────┬───────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────┐
│                  API SERVICE (port 3000)                       │
│  Express + PostgreSQL + Socket.IO                             │
│  Authentication · Uploads · Metadata · Job submission         │
└──────────────┬───────────────────────────────────────────────┘
               │ Bull Queue (Redis)
               ↓
┌──────────────────────────────────────────────────────────────┐
│              WORKER SERVICE (background × N)                  │
│  FFmpeg video/image processing                                │
│  Configurable concurrency (default: 5)                        │
└──────────────────────────────────────────────────────────────┘
               │
         Shared Resources: PostgreSQL · Redis · File Storage
```

---

## 📁 Project Structure

```
video-editor/
├── apps/
│   ├── api/                    # Express API service
│   │   ├── controllers/        # Auth, video, image controllers
│   │   ├── routes/             # Route definitions
│   │   ├── middleware/         # Auth, error handling
│   │   ├── websocket/         # Socket.IO handler
│   │   └── server.js          # Entry point
│   │
│   ├── worker/                 # Background job processor
│   │   ├── queue/BullQueue.js  # Job processors (5 types)
│   │   └── worker.js          # Entry point
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── api/client.js   # API client
│       │   ├── context/        # Auth context
│       │   ├── hooks/          # Socket.IO hook
│       │   ├── pages/          # Login, Dashboard
│       │   ├── components/     # Navbar, MediaGrid, Modals
│       │   └── components/ui/  # Shadcn/ui components
│       ├── nginx.conf          # Production reverse proxy
│       └── Dockerfile          # Frontend Docker build
│
├── packages/
│   ├── shared/                 # Shared modules (@video-editor/shared)
│   │   ├── config/             # Environment configuration
│   │   ├── database/           # PostgreSQL pool + services
│   │   ├── lib/                # FFmpeg wrapper, utilities
│   │   └── telemetry/          # OpenTelemetry setup
│   │
│   └── database/               # Schema (@video-editor/database)
│       └── schema.sql
│
├── turbo.json                  # Turborepo pipeline config
├── docker-compose.yml          # Full stack orchestration
├── Dockerfile                  # API + Worker multi-stage build
└── package.json                # Workspace root
```

### Workspace Packages

| Package | Name | Purpose |
|---------|------|---------|
| `apps/api` | `@video-editor/api` | Express HTTP API + WebSocket |
| `apps/worker` | `@video-editor/worker` | Bull queue job processor |
| `apps/web` | `@video-editor/web` | React + Vite frontend |
| `packages/shared` | `@video-editor/shared` | Config, DB, FFmpeg, telemetry |
| `packages/database` | `@video-editor/database` | SQL schema |

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
git clone <repository-url>
cd video-editor

# Build and start all services
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Access Points:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Local Development

```bash
# 1. Install dependencies (workspaces resolved automatically)
npm install

# 2. Set up database
createdb video_editor
psql video_editor < packages/database/schema.sql

# 3. Start Redis
redis-server

# 4. Configure environment
cp .env.example .env

# 5. Start all services with Turborepo
npm run dev
```

Individual services:
```bash
npm run dev:api      # API only (port 3000)
npm run dev:worker   # Worker only
npm run dev:web      # Frontend only (port 5173)
```

---

## 📡 API Reference

### Authentication

```http
POST /api/auth/login        # Login (returns session cookie)
POST /api/auth/logout       # Logout (clears session)
GET  /api/auth/user         # Get current user info
PUT  /api/auth/user         # Update user profile
```

### Videos

```http
GET  /api/videos                  # List all videos
POST /api/videos/upload           # Upload video (octet-stream)
POST /api/videos/resize           # Resize video (queued)
POST /api/videos/convert          # Convert format (queued)
POST /api/videos/extract-audio    # Extract audio (queued)
GET  /api/videos/asset            # Stream video asset
```

### Images

```http
GET  /api/images                  # List all images
POST /api/images/upload           # Upload image (octet-stream)
POST /api/images/crop             # Crop image (queued)
POST /api/images/resize           # Resize image (queued)
POST /api/images/convert          # Convert format (queued)
GET  /api/images/asset            # Stream image asset
```

### WebSocket Events

```javascript
const socket = io('http://localhost:5173');   // through nginx proxy
socket.emit('subscribe', '<resourceId>');

socket.on('job:queued',    (data) => { /* { jobId, type, videoId } */ });
socket.on('job:started',   (data) => { /* { jobId, type, videoId } */ });
socket.on('job:progress',  (data) => { /* { jobId, progress: 0-100 } */ });
socket.on('job:completed', (data) => { /* { jobId, videoId, result } */ });
socket.on('job:failed',    (data) => { /* { jobId, videoId, error } */ });
```

---

## 🐳 Docker Commands

```bash
docker-compose up --build -d        # Build and start
docker-compose up -d --scale worker=5  # Scale workers
docker-compose logs -f              # All logs
docker-compose logs -f api          # API logs
docker-compose logs -f web          # Frontend logs
docker-compose down                 # Stop
docker-compose down -v              # Stop + delete volumes
```

### Docker Services

| Service | Container | Port | Image |
|---------|-----------|------|-------|
| web | video-editor-web | 5173 → 80 | nginx:alpine |
| api | video-editor-api | 3000 | node:18-alpine + ffmpeg |
| worker (×2) | video-editor-worker-N | — | node:18-alpine + ffmpeg |
| db | video-editor-db | 5432 | postgres:15-alpine |
| redis | video-editor-redis | 6379 | redis:7-alpine |

---

## 📦 NPM Scripts

```bash
npm run dev              # Start all services (Turborepo)
npm run dev:api          # API with hot-reload
npm run dev:worker       # Worker with hot-reload
npm run dev:web          # Frontend dev server
npm run build            # Build all packages
npm run docker:build     # Build Docker images
npm run docker:up        # Start Docker stack
npm run docker:down      # Stop Docker stack
npm run docker:logs      # View all logs
npm run docker:clean     # Stop + remove volumes
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env`:

```bash
NODE_ENV=development
API_PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_SIZE=20

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue
QUEUE_CONCURRENCY=5

# OpenTelemetry (optional)
OTEL_ENABLED=false
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Shadcn/ui, Tailwind CSS 4 |
| API | Express 4.18, Socket.IO 4.8 |
| Database | PostgreSQL 15 |
| Queue | Bull 4.16, Redis 7 |
| Processing | FFmpeg |
| Auth | bcrypt, HttpOnly cookies |
| Monorepo | Turborepo, npm workspaces |
| Observability | OpenTelemetry |
| Deployment | Docker, Docker Compose, nginx |

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, email, password_hash, tier) |
| `sessions` | Session tokens (token, user_id, expires_at) |
| `videos` | Video/image metadata (dimensions, format, paths) |
| `video_operations` | Processing operations (status, parameters, result) |
| `job_history` | Job execution history (duration, timestamps) |

---

## 🔍 Troubleshooting

```bash
# Database connection
pg_isready -h localhost -p 5432

# Redis connection
redis-cli ping

# FFmpeg check
ffmpeg -version

# Port conflicts
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

---

## 📄 License

ISC

## 👤 Author

**Ignatius Sani**

---

**Built with ❤️ using Node.js, React, and Turborepo**
