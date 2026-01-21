# Video Editor Backend - 2-Service Architecture

A modern, scalable video and image processing platform built with Node.js. Features a clean 2-service architecture: API Service for HTTP endpoints and Worker Service for background processing.

## 🎯 Features

### Video Operations
- **Upload**: Stream-based upload for MP4 and MOV formats with automatic thumbnail generation
- **Format Conversion**: Convert between MP4, MOV, AVI, WebM, MKV, and FLV
- **Resizing**: Scale videos to custom dimensions
- **Audio Extraction**: Extract audio tracks in AAC format

### Image Operations
- **Upload**: Support for JPG, JPEG, PNG, GIF, and WebP formats
- **Cropping**: Crop images with precise x,y coordinates and dimensions
- **Resizing**: Scale images to custom dimensions
- **Format Conversion**: Convert between image formats

### Platform Features
- **Real-Time Updates**: WebSocket-based job progress notifications
- **Background Processing**: Redis-backed Bull queue with configurable concurrent workers
- **User Authentication**: Session-based auth with PostgreSQL storage
- **Asset Streaming**: Efficient streaming of processed assets with caching headers
- **Job Tracking**: Comprehensive operation history and status tracking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   API SERVICE (port 3000)                    │
│  - User authentication & sessions                            │
│  - Video/image uploads & metadata                            │
│  - Asset retrieval (streaming)                               │
│  - Job submission to Redis queue                             │
│  - Real-time WebSocket updates                               │
│  - Express + PostgreSQL + Socket.IO                          │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ Bull Queue (Redis)
               │
               ↓
┌─────────────────────────────────────────────────────────────┐
│              WORKER SERVICE (background)                     │
│  - Video processing (resize, convert)                        │
│  - Image processing (crop, resize, convert)                  │
│  - FFmpeg operations                                         │
│  - Configurable concurrent workers (default: 5)              │
│  - Progress tracking & database updates                      │
│  - No HTTP server (queue consumer only)                      │
└─────────────────────────────────────────────────────────────┘
               │
               ↓
        Shared Resources:
        - PostgreSQL (single database)
        - File Storage (./storage volume)
        - Redis (Bull queue)
```

### Why 2 Services?

- **✅ Separation of Concerns**: HTTP/API logic separate from heavy processing
- **✅ Independent Scaling**: Scale workers independently during peak processing
- **✅ Fault Isolation**: Processing failures don't affect API availability
- **✅ Simple Deployment**: Easier than 5+ microservices, more flexible than monolith
- **✅ Resource Optimization**: Workers can run on different hardware optimized for FFmpeg

---

## 📋 Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download))
- **FFmpeg** with FFprobe ([Download](https://ffmpeg.org/download.html))
- **Docker** & **Docker Compose** (optional, for containerized deployment)

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd video-editor

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access Points:**
- API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up database
createdb video_editor
psql video_editor < database/schema.sql

# 3. Start Redis
redis-server

# 4. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 5. Create storage directory
mkdir -p storage

# 6. Start services
npm run dev  # Starts both API and Worker with hot-reload
```

---

## 📡 API Documentation

### Authentication

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}

Response: Sets HttpOnly cookie with session token
```

**Get User Info**
```http
GET /api/auth/user
Cookie: token=<session-token>

Response: { id, username, email, tier, created_at }
```

**Logout**
```http
POST /api/auth/logout
Cookie: token=<session-token>

Response: Clears session cookie
```

### Video Operations

**Upload Video**
```http
POST /api/videos/upload
Cookie: token=<session-token>
filename: video.mp4
Content-Type: application/octet-stream
Body: <binary video data>

Response: {
  status: "success",
  videoId: "abc123",
  name: "video",
  dimensions: { width: 1920, height: 1080 }
}
```

**List Videos**
```http
GET /api/videos
Cookie: token=<session-token>

Response: Array of video objects with metadata
```

**Resize Video**
```http
POST /api/videos/resize
Cookie: token=<session-token>
Content-Type: application/json

{
  "videoId": "abc123",
  "width": 1280,
  "height": 720
}

Response: { status: "success", message: "Video resize job queued!" }
```

**Convert Video Format**
```http
POST /api/videos/convert
Cookie: token=<session-token>
Content-Type: application/json

{
  "videoId": "abc123",
  "targetFormat": "webm"
}

Supported formats: mp4, mov, avi, webm, mkv, flv
```

**Extract Audio**
```http
POST /api/videos/extract-audio
Cookie: token=<session-token>
Content-Type: application/json

{
  "videoId": "abc123"
}
```

**Get Video Asset**
```http
GET /api/videos/asset?videoId=abc123&type=thumbnail
GET /api/videos/asset?videoId=abc123&type=audio
GET /api/videos/asset?videoId=abc123&type=original
GET /api/videos/asset?videoId=abc123&type=resize&dimensions=1280x720
GET /api/videos/asset?videoId=abc123&type=converted&format=webm

Cookie: token=<session-token>

Response: Binary stream with appropriate Content-Type
```

### Image Operations

**Upload Image**
```http
POST /api/images/upload
Cookie: token=<session-token>
filename: image.jpg
Content-Type: application/octet-stream
Body: <binary image data>

Supported: jpg, jpeg, png, gif, webp
```

**Crop Image**
```http
POST /api/images/crop
Cookie: token=<session-token>
Content-Type: application/json

{
  "imageId": "def456",
  "width": 800,
  "height": 600,
  "x": 100,
  "y": 50
}
```

**Resize Image**
```http
POST /api/images/resize
Cookie: token=<session-token>
Content-Type: application/json

{
  "imageId": "def456",
  "width": 1024,
  "height": 768
}
```

**Convert Image Format**
```http
POST /api/images/convert
Cookie: token=<session-token>
Content-Type: application/json

{
  "imageId": "def456",
  "targetFormat": "webp"
}

Supported: jpg, jpeg, png, gif, webp
```

**Get Image Asset**
```http
GET /api/images/asset?imageId=def456&type=original
GET /api/images/asset?imageId=def456&type=cropped&dimensions=800x600x100x50
GET /api/images/asset?imageId=def456&type=resized&dimensions=1024x768
GET /api/images/asset?imageId=def456&type=converted&format=webp

Cookie: token=<session-token>
```

---

## 🔌 WebSocket Events

### Client → Server
```javascript
const socket = io('http://localhost:3000');

// Subscribe to video/image updates
socket.emit('subscribe', 'abc123');

// Unsubscribe
socket.emit('unsubscribe', 'abc123');
```

### Server → Client
```javascript
socket.on('job:queued', (data) => {
  // { jobId, type, videoId/imageId, timestamp }
});

socket.on('job:started', (data) => {
  // { jobId, type, videoId/imageId, timestamp }
});

socket.on('job:progress', (data) => {
  // { jobId, progress: 0-100 }
});

socket.on('job:completed', (data) => {
  // { jobId, videoId/imageId, result, duration }
});

socket.on('job:failed', (data) => {
  // { jobId, videoId/imageId, error, stack }
});
```

---

## 🐳 Docker Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=5

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f api
docker-compose logs -f worker

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Check service health
curl http://localhost:3000/health
```

---

## 📦 NPM Scripts

```bash
# Production
npm start        # Start API service
npm run worker   # Start Worker service

# Development (hot-reload)
npm run dev:api     # Start API with nodemon
npm run dev:worker  # Start Worker with nodemon
npm run dev         # Start both API and Worker

# Docker
npm run docker:build    # Build Docker images
npm run docker:up       # Start Docker services
npm run docker:down     # Stop Docker services
npm run docker:logs     # View all logs
npm run docker:logs:api # View API logs only
npm run docker:logs:worker # View Worker logs only
npm run docker:restart  # Restart all services
npm run docker:clean    # Stop and remove volumes
```

---

## ⚙️ Configuration

Configuration is managed through environment variables. Copy `.env.example` to `.env` and customize:

```bash
# Environment
NODE_ENV=development

# API Service
API_PORT=3000
CORS_ORIGIN=*

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

# Storage
STORAGE_PATH=./storage
```

---

## 🗄️ Database Schema

### Tables

- **users**: User accounts (id, username, email, password_hash, tier, created_at)
- **sessions**: Session tokens (id, user_id, token, created_at, expires_at)
- **videos**: Video/image metadata (id, video_id, user_id, name, extension, dimensions, metadata)
- **video_operations**: Processing operations (id, video_id, operation_type, status, parameters, result_path, error_message)
- **job_history**: Job execution history (id, job_id, video_id, user_id, type, status, queued_at, completed_at, duration_ms)

### Indexes

- `idx_videos_user_id` on videos(user_id)
- `idx_videos_video_id` on videos(video_id)
- `idx_operations_video_id` on video_operations(video_id)
- `idx_operations_status` on video_operations(status)
- `idx_sessions_token` on sessions(token)
- `idx_sessions_user_id` on sessions(user_id)

---

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 15 with pg driver (connection pooling)
- **Queue**: Bull 4.16 (Redis-backed, configurable concurrency)
- **WebSocket**: Socket.IO 4.8
- **Authentication**: bcrypt 6.0 (10 salt rounds)
- **Video Processing**: FFmpeg via cpeak wrapper
- **Containerization**: Docker + Docker Compose

---

## 📁 Project Structure

```
video-editor-backend/
├── api-service/               # API Service (HTTP)
│   ├── controllers/
│   │   ├── authController.js    # Login, logout, user management
│   │   ├── videoController.js   # Video operations
│   │   └── imageController.js   # Image operations
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── videoRoutes.js
│   │   └── imageRoutes.js
│   ├── middleware/
│   │   ├── auth.js             # Token validation
│   │   └── errorHandler.js     # Centralized error handling
│   ├── websocket/
│   │   └── socketHandler.js    # Socket.IO real-time updates
│   └── server.js               # Entry point
│
├── worker-service/            # Worker Service (Background)
│   ├── queue/
│   │   └── BullQueue.js       # Job processors (5 types)
│   └── worker.js              # Entry point
│
├── shared/                    # Shared modules
│   ├── database/
│   │   ├── db.js              # PostgreSQL pool
│   │   └── services/          # Data access layer
│   ├── lib/
│   │   ├── FF.js              # FFmpeg wrapper
│   │   └── util.js            # Utilities
│   └── config/
│       └── index.js           # Configuration
│
├── database/
│   ├── schema.sql             # Database schema
│   └── services/              # Database services
│
├── storage/                   # File storage (gitignored)
│
├── docker-compose.yml         # Docker orchestration
├── Dockerfile                 # Multi-stage build
├── package.json               # Dependencies & scripts
└── .env.example               # Environment template
```

---

## 🔍 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify database exists
psql -l | grep video_editor

# Test connection
psql video_editor -c "SELECT NOW();"
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Expected: PONG

# Start Redis
redis-server
```

### FFmpeg Not Found
```bash
# Check installation
ffmpeg -version
ffprobe -version

# Install on Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Install on macOS
brew install ffmpeg
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Worker Not Processing Jobs
```bash
# Check worker logs
docker-compose logs worker

# Check Redis queue
redis-cli
> KEYS *

# Restart worker
docker-compose restart worker
```

---

## 📊 Performance Tuning

### Database
- Connection pool size: Default 20 (adjust via `DB_POOL_SIZE`)
- Slow query logging: >1000ms queries logged automatically

### Redis
- Job retention: 100 completed, 200 failed (configurable in `shared/config`)

### Worker Concurrency
- Default: 5 concurrent jobs
- Adjust via `QUEUE_CONCURRENCY` environment variable
- Scale workers: `docker-compose up -d --scale worker=10`

### File Streaming
- Chunk size: 64KB (optimized for network transfer)
- Caching: Thumbnails cached with ETag + 24h TTL

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

ISC

---

## 👤 Author

**Ignatius Sani**

---

## 🙏 Acknowledgments

- **FFmpeg** - Video/image processing engine
- **Bull** - Robust job queue system
- **PostgreSQL** - Reliable database
- **Socket.IO** - Real-time communication
- **Redis** - In-memory data store

---

**Built with ❤️ using Node.js**
