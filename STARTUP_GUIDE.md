# Video Editor Express - Startup & Testing Guide

This guide will help you start and test your application. You have two deployment options:

## Quick Start (Recommended for Testing)

### Option 1: Monolith Mode (Simplest)
Start the entire application as a single service with all features.

## Option 2: Microservices Mode (Full Stack)
Run all microservices separately with observability.

---

## Option 1: Monolith Mode (Single Server)

This is the **easiest way** to test your application. Everything runs in one process.

### Prerequisites Check
```bash
# Check PostgreSQL
pg_isready
# Expected: /tmp:5432 - accepting connections

# Check Redis
redis-cli ping
# Expected: PONG

# Check database exists
psql -l | grep video_editor
# Expected: video_editor | ...
```

### Step 1: Ensure Database Schema
```bash
# Verify tables exist
psql video_editor -c "\dt"

# If tables don't exist, run schema
psql video_editor -f database/schema.sql
```

### Step 2: Build Frontend
```bash
cd video-editor-client
npm install
npm run build
cd ..
```

### Step 3: Install Backend Dependencies
```bash
npm install
```

### Step 4: Start the Server
```bash
# Single server mode
npm start

# OR cluster mode (production, uses all CPU cores)
npm run cluster
```

### Step 5: Access the Application
- **Frontend**: http://localhost:8060
- **Bull Board** (Queue Dashboard): http://localhost:8060/admin/queues
- **API**: http://localhost:8060/api/*

### Step 6: Test Basic Features

**1. Create a test user (via psql):**
```bash
psql video_editor << 'EOF'
INSERT INTO users (username, email, password_hash, tier)
VALUES ('testuser', 'test@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'free')
ON CONFLICT DO NOTHING;
EOF
```

**2. Login via Browser:**
- Navigate to http://localhost:8060
- Login with: `testuser` / any password (hash is dummy, will need proper login)

**3. Upload a video:**
- Drag and drop an MP4 or MOV file
- Watch the upload progress
- View thumbnail generation

**4. Monitor queue:**
- Open http://localhost:8060/admin/queues
- See jobs processing in real-time

---

## Option 2: Microservices Mode (Local - No Docker)

Run all microservices separately for full observability stack testing.

### Architecture
```
API Gateway (Port 3000) → Frontend Entry Point
    ↓
User Service (Port 3001) → Authentication
Video Service (Port 3002) → Video Management
Job Service (Port 3003) → Background Processing
    ↓
PostgreSQL (5432), Redis (6379), RabbitMQ (5672)
```

### Prerequisites

#### 1. PostgreSQL & Redis (Already Running ✓)
```bash
pg_isready  # ✓ Running
redis-cli ping  # ✓ Running
```

#### 2. Install RabbitMQ
```bash
# Option A: Homebrew (macOS)
brew install rabbitmq
brew services start rabbitmq

# Option B: Docker
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management-alpine

# Verify RabbitMQ
curl -u admin:admin123 http://localhost:15672/api/healthchecks/node
# Expected: {"status":"ok"}
```

### Step 1: Configure Environment Variables

**User Service:**
```bash
cat > services/user-service/.env << 'EOF'
USER_SERVICE_PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=mac
DB_PASSWORD=
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
EOF
```

**Video Service:**
```bash
cat > services/video-service/.env << 'EOF'
VIDEO_SERVICE_PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=mac
DB_PASSWORD=
USER_SERVICE_URL=http://localhost:3001
JOB_SERVICE_URL=http://localhost:3003
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
EOF
```

**Job Service:**
```bash
cat > services/job-service/.env << 'EOF'
JOB_SERVICE_PORT=3003
REDIS_HOST=localhost
REDIS_PORT=6379
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=mac
DB_PASSWORD=
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
EOF
```

**API Gateway:**
```bash
cat > services/api-gateway/.env << 'EOF'
GATEWAY_PORT=3000
USER_SERVICE_URL=http://localhost:3001
VIDEO_SERVICE_URL=http://localhost:3002
JOB_SERVICE_URL=http://localhost:3003
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
NODE_ENV=development
EOF
```

### Step 2: Install Dependencies for Each Service
```bash
cd services

# Install shared dependencies
cd shared && npm install && cd ..

# Install service dependencies
for service in user-service video-service job-service api-gateway; do
  echo "Installing dependencies for $service..."
  cd $service && npm install && cd ..
done

cd ..
```

### Step 3: Start All Services

**Option A: Use start-all.sh script**
```bash
cd services
chmod +x start-all.sh
./start-all.sh
```

**Option B: Manual start (separate terminals)**

**Terminal 1 - User Service:**
```bash
cd services/user-service
npm start
# Expected: User Service listening on port 3001
```

**Terminal 2 - Video Service:**
```bash
cd services/video-service
npm start
# Expected: Video Service listening on port 3002
```

**Terminal 3 - Job Service:**
```bash
cd services/job-service
npm start
# Expected: Job Service listening on port 3003
```

**Terminal 4 - API Gateway:**
```bash
cd services/api-gateway
npm start
# Expected: API Gateway listening on port 3000
```

### Step 4: Verify All Services Are Running

```bash
# Check User Service
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Check Video Service
curl http://localhost:3002/health
# Expected: {"status":"ok"}

# Check Job Service
curl http://localhost:3003/health
# Expected: {"status":"ok"}

# Check API Gateway
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# Check all services via gateway
curl http://localhost:3000/api/services/status
# Expected: {"user-service":{"status":"up"},"video-service":{"status":"up"},"job-service":{"status":"up"}}
```

### Step 5: Access Points

- **API Gateway**: http://localhost:3000
- **User Service**: http://localhost:3001
- **Video Service**: http://localhost:3002
- **Job Service**: http://localhost:3003
- **RabbitMQ Management**: http://localhost:15672 (admin/admin123)
- **Prometheus** (if running): http://localhost:9090
- **Grafana** (if running): http://localhost:3100

---

## Testing the Application

### 1. Test User Authentication

**Create a test user:**
```bash
curl -X POST http://localhost:8060/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpassword"
  }'

# First create user in database:
psql video_editor << 'EOF'
INSERT INTO users (username, email, password_hash, tier)
VALUES (
  'testuser',
  'test@example.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- password: "test123"
  'free'
) ON CONFLICT (username) DO NOTHING;
EOF
```

**Login via curl:**
```bash
curl -X POST http://localhost:8060/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "test123"}' \
  -c cookies.txt

# Expected: {"message":"Login successful"}
```

**Get user info:**
```bash
curl http://localhost:8060/api/user \
  -b cookies.txt

# Expected: {"id":1,"username":"testuser","tier":"free"}
```

### 2. Test Video Upload

**Upload a video (using a sample video file):**
```bash
# Download a test video first
curl -o test-video.mp4 "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"

# Upload via API
curl -X POST http://localhost:8060/api/upload-video \
  -H "filename: test-video.mp4" \
  -b cookies.txt \
  --data-binary @test-video.mp4

# Expected: {"status":"success","message":"File uploaded successfully","videoId":"abc123"}
```

**Get all videos:**
```bash
curl http://localhost:8060/api/videos \
  -b cookies.txt

# Expected: [{"videoId":"abc123","name":"test-video","extension":"mp4",...}]
```

### 3. Test Video Operations

**Resize a video:**
```bash
curl -X PUT http://localhost:8060/api/video/resize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "videoId": "abc123",
    "width": 1280,
    "height": 720
  }'

# Expected: {"status":"success","message":"Video is being processed"}
```

**Convert video format:**
```bash
curl -X PUT "http://localhost:8060/api/video/convert?videoId=abc123" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"format": "webm"}'

# Expected: {"status":"success","message":"Video conversion started"}
```

**Extract audio:**
```bash
curl -X PATCH "http://localhost:8060/api/video/extract-audio?videoId=abc123" \
  -b cookies.txt

# Expected: {"status":"success","message":"Audio extracted successfully"}
```

### 4. Monitor Job Progress

**Check Bull Board:**
- Open http://localhost:8060/admin/queues
- You'll see:
  - Waiting jobs
  - Active jobs (currently processing)
  - Completed jobs
  - Failed jobs

**Check job status via WebSocket:**
```javascript
// In browser console (at http://localhost:8060)
const socket = io();

socket.on('job:queued', (data) => {
  console.log('Job queued:', data);
});

socket.on('job:started', (data) => {
  console.log('Job started:', data);
});

socket.on('job:progress', (data) => {
  console.log('Progress:', data.progress + '%');
});

socket.on('job:completed', (data) => {
  console.log('Job completed:', data);
});

socket.on('job:failed', (data) => {
  console.log('Job failed:', data.error);
});
```

### 5. Download Processed Assets

**Get thumbnail:**
```bash
curl "http://localhost:8060/get-video-asset?videoId=abc123&type=thumbnail" \
  -b cookies.txt \
  -o thumbnail.jpg
```

**Get resized video:**
```bash
curl "http://localhost:8060/get-video-asset?videoId=abc123&type=resize&dimensions=1280x720" \
  -b cookies.txt \
  -o resized.mp4
```

**Get converted video:**
```bash
curl "http://localhost:8060/get-video-asset?videoId=abc123&type=converted&format=webm" \
  -b cookies.txt \
  -o converted.webm
```

**Get extracted audio:**
```bash
curl "http://localhost:8060/get-video-asset?videoId=abc123&type=audio" \
  -b cookies.txt \
  -o audio.aac
```

---

## Testing via Browser

### 1. Open the Application
```bash
# Make sure server is running
npm start

# Open browser
open http://localhost:8060
```

### 2. Login
- Username: `testuser`
- Password: `test123`

### 3. Upload a Video
- Click the upload area or drag-and-drop a video file
- Supported formats: MP4, MOV
- Wait for upload to complete

### 4. View Videos
- You'll see your uploaded videos with thumbnails
- Click on a video to see details

### 5. Perform Operations
- **Resize**: Click "Resize" button, enter dimensions
- **Convert**: Click "Convert" button, select format
- **Extract Audio**: Click "Extract Audio" button
- **Download**: Click download buttons for original, resized, or converted

### 6. Monitor Progress
- Real-time progress updates appear in the UI
- Check Bull Board: http://localhost:8060/admin/queues

---

## Troubleshooting

### Issue: Port already in use
```bash
# Find process using port 8060
lsof -i :8060

# Kill the process
kill -9 <PID>
```

### Issue: Database connection error
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep video_editor

# If missing, create it
createdb video_editor
psql video_editor -f database/schema.sql
```

### Issue: Redis connection error
```bash
# Check Redis is running
redis-cli ping

# If not running, start it
redis-server --daemonize yes
```

### Issue: RabbitMQ connection error (Microservices only)
```bash
# Check RabbitMQ is running
curl -u admin:admin123 http://localhost:15672/api/healthchecks/node

# If not running, start it
brew services start rabbitmq
# OR
docker start rabbitmq
```

### Issue: Jobs stuck in queue
```bash
# Access Bull Board
open http://localhost:8060/admin/queues

# Check "Active" tab for hung jobs
# Manually retry or remove stuck jobs
```

### Issue: Can't upload videos
```bash
# Check storage directory exists
mkdir -p storage

# Check permissions
ls -la storage/
```

---

## Monitoring & Debugging

### View Logs

**Monolith mode:**
```bash
npm start
# Logs appear in console
```

**Microservices mode:**
```bash
# Each terminal shows logs for its service

# Or use PM2 for better log management
pm2 start services/user-service/server.js --name user-service
pm2 start services/video-service/server.js --name video-service
pm2 start services/job-service/server.js --name job-service
pm2 start services/api-gateway/gateway.js --name api-gateway

pm2 logs
```

### Database Queries

**Check videos:**
```bash
psql video_editor -c "SELECT video_id, name, extension, created_at FROM videos;"
```

**Check operations:**
```bash
psql video_editor -c "SELECT video_id, operation_type, status, created_at FROM video_operations ORDER BY created_at DESC LIMIT 10;"
```

**Check sessions:**
```bash
psql video_editor -c "SELECT user_id, token, created_at FROM sessions;"
```

### Redis Queue Inspection

```bash
# List all queues
redis-cli KEYS "bull:*"

# Check queue length
redis-cli LLEN "bull:video-processing:wait"

# View queue contents
redis-cli LRANGE "bull:video-processing:wait" 0 -1
```

---

## Performance Tips

### 1. Adjust Bull Concurrency
Edit `lib/BullQueue.js`:
```javascript
this.CONCURRENCY = 10; // Default: 5 (increase for more parallel processing)
```

### 2. Use Cluster Mode
```bash
npm run cluster
# Spawns workers = CPU cores for better performance
```

### 3. Monitor Resource Usage
```bash
# CPU and Memory
top

# PostgreSQL connections
psql video_editor -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory
redis-cli INFO memory
```

---

## Next Steps

Once you've tested the basic functionality:

1. **Set up proper authentication**: Update password hashing in user controller
2. **Add more test videos**: Try different formats (MOV, MP4) and sizes
3. **Test error handling**: Try invalid operations, missing files
4. **Load testing**: Upload multiple videos simultaneously
5. **Set up observability** (if using microservices):
   - Install Prometheus, Grafana, Jaeger
   - Configure dashboards
   - View distributed traces

---

## Quick Reference

### Start Commands
```bash
# Monolith
npm start

# Cluster
npm run cluster

# Microservices (all at once)
cd services && ./start-all.sh

# Stop Microservices
cd services && ./stop-all.sh
```

### Access Points
- Frontend: http://localhost:8060
- Bull Board: http://localhost:8060/admin/queues
- API Gateway (microservices): http://localhost:3000
- RabbitMQ: http://localhost:15672

### Test User
- Username: `testuser`
- Password: `test123`
- Created via: `psql video_editor` (see commands above)

---

Happy Testing! 🎬
