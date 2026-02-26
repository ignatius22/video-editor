# Convertix — Media Processing Studio

A modern, scalable **media conversion platform** for processing videos and images at scale. Upload, convert, resize, crop, and manage your media assets through a premium dark-themed UI — powered by FFmpeg, Redis job queues, and a hardened credit-based billing system.

Built as a **Turborepo monorepo** with three apps and two shared packages.

---

## 🎯 Features

### Video Processing
- **Upload** — stream-based upload with automatic thumbnail generation
- **Format Conversion** — MP4, MOV, AVI, WebM, MKV, FLV
- **Resizing** — scale to custom dimensions
- **Audio Extraction** — extract audio tracks (AAC)

### Image Processing
- **Upload** — JPG, PNG, GIF, WebP, BMP, TIFF
- **Cropping** — precise x/y coordinates and dimensions
- **Resizing** — scale to custom dimensions
- **Format Conversion** — convert between all supported image formats

### Platform
- **Premium UI** — Convertix-branded React frontend with custom SVG logo, animated loaders, dark theme, and glassmorphism effects
- **Real-Time Updates** — WebSocket-based job progress via Socket.IO + RabbitMQ event bus
- **Background Processing** — Redis-backed Bull queue with horizontally scalable workers
- **User Authentication** — session-based auth with HttpOnly cookies and bcrypt
- **Admin Dashboard** — user management, platform analytics, and system monitoring
- **Credit-Based Billing** — tiered plans (Free / Pro) with a reservation-based ledger system
- **Distributed Tracing** — OpenTelemetry integration for full observability

---

## 💰 Billing & Credits

The platform uses a **hardened ledger-first billing system** designed for production reliability.

### Core Invariants
- **Atomic Transactions** — all credit mutations involve both a ledger entry and a cached balance update in a single database transaction
- **Idempotency** — all operations require a `request_id` (UUID) to prevent double-charging on retries
- **State Machine Enforcement** — database triggers prevent illegal transitions (e.g., refunding a captured charge)
- **Immutability** — ledger entries are protected by triggers that prevent `UPDATE` or `DELETE`

### Reservation Lifecycle
1. **Reserve** — credits are earmarked and deducted from the user balance when a job is submitted
2. **Capture** — marker is added to the ledger on job success (no balance change)
3. **Release** — credits are refunded if a job fails or is cancelled

### Operational Tools

| Tool | Location | Purpose |
|------|----------|---------|
| Reservation Janitor | `apps/worker` | Auto-releases stuck reservations (every 30m) |
| Reconciliation CLI | `apps/api/scripts/reconciliation.js` | Audit & repair balance/ledger drift |

```bash
# Check for drift across all users
node scripts/reconciliation.js --mode check

# Explain transaction history for a specific user
node scripts/reconciliation.js --mode explain --userId 123

# Repair drift with compensating ledger entries
node scripts/reconciliation.js --mode repair --userId 123
```

---

## 📮 Durable Outbox Pattern

All external side effects (Event Bus, Socket.IO) use the **Transactional Outbox Pattern** for 100% durability.

- **Atomic Side-Effects** — events recorded in `outbox_events` within the same transaction as business state updates
- **At-Least-Once Delivery** — `OutboxDispatcher` polls and publishes to RabbitMQ; survives API crashes
- **Concurrent Polling** — `SELECT FOR UPDATE SKIP LOCKED` for safe multi-instance processing
- **Self-Healing** — automatically reclaims events stuck in processing

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  WEB (port 5173)                              │
│  React + Vite + Shadcn/ui                                     │
│  Login · Dashboard · Upload/Process modals · Admin panel      │
│  Nginx reverse proxy → API (/api/*, /socket.io/*)             │
└──────────────┬───────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────┐
│                  API SERVICE (port 3000)                       │
│  Express + PostgreSQL + Socket.IO                             │
│  · Outbox Dispatcher (Atomic Side Effects)                    │
│  · Authentication · Job Submission · Live Updates             │
└──────────────┬───────────────┬───────────────────────────────┘
               │               │
      Bull Queue (Redis)    Event Bus (RabbitMQ)
               │               │
┌──────────────┴───────────────┴──────────────────────────────┐
│              WORKER SERVICE (background × N)                  │
│  FFmpeg video/image processing                                │
│  Transactional job updates via Outbox                         │
└──────────────────────────────────────────────────────────────┘
               │
         Shared Resources: PostgreSQL · Redis · RabbitMQ · Storage
```

---

## 📁 Project Structure

```
convertix/
├── apps/
│   ├── api/                    # Express API service
│   │   ├── controllers/        # Auth, video, image controllers
│   │   ├── routes/             # Route definitions
│   │   ├── middleware/         # Auth, CSRF, error handling
│   │   ├── websocket/         # Socket.IO handler
│   │   ├── scripts/           # Admin seed, reconciliation CLI
│   │   └── server.js          # Entry point
│   │
│   ├── worker/                 # Background job processor
│   │   ├── queue/BullQueue.js  # Job processors (5 types)
│   │   ├── lib/               # Storage cleanup, reservation janitor
│   │   └── worker.js          # Entry point
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── api/client.js   # API client
│       │   ├── context/        # Auth context
│       │   ├── hooks/          # Socket.IO hook
│       │   ├── pages/          # Login, Dashboard, Profile, Billing, Admin
│       │   ├── components/     # ConvertixLogo, Navbar, MediaGrid, Modals
│       │   └── components/ui/  # Shadcn/ui components
│       ├── public/             # Convertix favicon SVG
│       ├── nginx.conf          # Production reverse proxy
│       └── Dockerfile          # Frontend Docker build
│
├── packages/
│   ├── shared/                 # Shared modules (@convertix/shared)
│   │   ├── config/             # Environment configuration
│   │   ├── database/           # PostgreSQL pool + services
│   │   ├── outbox/             # Outbox dispatcher + repository
│   │   ├── lib/                # FFmpeg wrapper, utilities, logger
│   │   └── telemetry/          # OpenTelemetry setup
│   │
│   └── database/               # Schema (@convertix/database)
│       └── schema.sql
│
├── turbo.json                  # Turborepo pipeline config
├── docker-compose.yml          # Full stack orchestration
├── Dockerfile                  # API + Worker multi-stage build
└── package.json                # Workspace root
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
git clone <repository-url>
cd convertix

# Build and start all services
npm run docker:build
npm run docker:up

# Check status
docker-compose ps

# View logs
npm run docker:logs
```

**Access Points:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

**Default Admin Account:** `admin / password123`

### Option 2: Local Development

```bash
# 1. Install dependencies (workspaces resolved automatically)
npm install

# 2. Set up database
createdb video_editor
psql video_editor < packages/database/schema.sql

# 3. Start Redis & RabbitMQ
redis-server
# RabbitMQ must be running on amqp://localhost:5672

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
POST /api/auth/register       # Register new account
POST /api/auth/login          # Login (returns session cookie)
POST /api/auth/logout         # Logout (clears session)
GET  /api/auth/user           # Get current user info
PUT  /api/auth/user           # Update user profile
```

### Videos

```http
GET  /api/videos                  # List user's videos
POST /api/videos/upload           # Upload video (octet-stream)
POST /api/videos/resize           # Resize video (queued)
POST /api/videos/convert          # Convert format (queued)
POST /api/videos/extract-audio    # Extract audio (synchronous)
GET  /api/videos/asset            # Stream/preview video asset
```

### Images

```http
GET  /api/images                  # List user's images
POST /api/images/upload           # Upload image (octet-stream)
POST /api/images/crop             # Crop image (queued)
POST /api/images/resize           # Resize image (queued)
POST /api/images/convert          # Convert format (queued)
GET  /api/images/asset            # Stream/preview image asset
```

### Admin

```http
GET  /api/admin/users             # List all users (admin only)
GET  /api/admin/stats             # Platform analytics (admin only)
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
npm run docker:build               # Build all images
npm run docker:up                  # Start all containers
npm run docker:down                # Stop all containers
npm run docker:logs                # Tail all logs
npm run docker:clean               # Stop + delete volumes
docker-compose up -d --scale worker=5  # Scale workers
```

### Docker Services

| Service | Container | Port | Image |
|---------|-----------|------|-------|
| web | convertix-web | 5173 → 80 | nginx:alpine |
| api | convertix-api | 3000 | node:18-alpine + ffmpeg |
| worker (×2) | convertix-worker-N | — | node:18-alpine + ffmpeg |
| db | convertix-db | 5432 | postgres:15-alpine |
| redis | convertix-redis | 6379 | redis:7-alpine |
| rabbitmq | convertix-rabbitmq | 5672 | rabbitmq:3-alpine |

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

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

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
| Event Bus | RabbitMQ 3 |
| Processing | FFmpeg |
| Auth | bcrypt, HttpOnly cookies |
| Monorepo | Turborepo, npm workspaces |
| Observability | OpenTelemetry |
| Deployment | Docker, Docker Compose, nginx |

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, email, password_hash, tier, credits) |
| `sessions` | Session tokens (token, user_id, expires_at) |
| `videos` | Video metadata (dimensions, format, file size) |
| `images` | Image metadata (dimensions, format, file size) |
| `video_operations` | Processing operations with state machine (pending → completed/failed) |
| `credit_transactions` | Immutable credit ledger (reservation, debit_capture, refund) |
| `outbox_events` | Durable outbox for transactional side effects |
| `job_history` | Job execution history (duration, timestamps) |

---

## 🔍 Troubleshooting

```bash
# Database connection
pg_isready -h localhost -p 5432

# Redis connection
redis-cli ping

# RabbitMQ connection
curl -s http://localhost:15672/api/healthchecks/node

# FFmpeg check
ffmpeg -version

# Port conflicts (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

---

## 📄 License

ISC

## 👤 Author

**Ignatius Sani**

---

**Built with ❤️ using Node.js, React, FFmpeg, and Turborepo**
