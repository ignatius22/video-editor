# How to Start & Test Video Editor Express

## TL;DR - Quick Start (Monolith Mode)

```bash
# 1. Start the application (automatic checks included)
./quick-start.sh

# 2. Open browser
open http://localhost:8060

# 3. Login
Username: testuser
Password: test123

# 4. Test the API (in another terminal)
./test-api.sh
```

That's it! Your app is running.

---

## Detailed Instructions

### Option 1: Monolith Mode (Recommended for Testing)

#### Prerequisites Check
You already have:
- ✅ PostgreSQL running (port 5432)
- ✅ Redis running (port 6379)
- ✅ Database `video_editor` created with all tables
- ✅ Test user created (username: `testuser`, password: `test123`)

#### Start the Server

**Method A: Use the quick-start script (easiest)**
```bash
./quick-start.sh
```

**Method B: Manual start**
```bash
npm start
```

**Method C: Cluster mode (production)**
```bash
npm run cluster
```

#### Access Points
- **Frontend**: http://localhost:8060
- **Bull Board** (Queue Monitor): http://localhost:8060/admin/queues
- **API**: http://localhost:8060/api/*

#### Test the Application
```bash
# Run automated tests
./test-api.sh

# Or test manually in browser
open http://localhost:8060
```

---

### Option 2: Microservices Mode (Advanced)

For full microservices with observability, you'll need RabbitMQ first.

#### Install RabbitMQ

**Option A: Docker (Recommended)**
```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management-alpine

# Verify
curl -u admin:admin123 http://localhost:15672/api/healthchecks/node
```

**Option B: Homebrew (macOS)**
```bash
brew install rabbitmq
brew services start rabbitmq
```

#### Configure Services
```bash
# Create environment files for all services
cd services

# User Service
cat > user-service/.env << 'EOF'
USER_SERVICE_PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=mac
DB_PASSWORD=
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
NODE_ENV=development
EOF

# Video Service
cat > video-service/.env << 'EOF'
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

# Job Service
cat > job-service/.env << 'EOF'
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

# API Gateway
cat > api-gateway/.env << 'EOF'
GATEWAY_PORT=3000
USER_SERVICE_URL=http://localhost:3001
VIDEO_SERVICE_URL=http://localhost:3002
JOB_SERVICE_URL=http://localhost:3003
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
NODE_ENV=development
EOF

cd ..
```

#### Install Dependencies
```bash
cd services

# Install shared dependencies
cd shared && npm install && cd ..

# Install each service
for service in user-service video-service job-service api-gateway; do
  cd $service && npm install && cd ..
done

cd ..
```

#### Start All Services

**Method A: Use startup script**
```bash
cd services
./start-all.sh
```

**Method B: Manual (4 separate terminals)**

Terminal 1:
```bash
cd services/user-service && npm start
```

Terminal 2:
```bash
cd services/video-service && npm start
```

Terminal 3:
```bash
cd services/job-service && npm start
```

Terminal 4:
```bash
cd services/api-gateway && npm start
```

#### Verify Services
```bash
# Check all services
curl http://localhost:3000/api/services/status

# Check individual services
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Video Service
curl http://localhost:3003/health  # Job Service
curl http://localhost:3000/health  # API Gateway
```

#### Access Points (Microservices)
- **API Gateway**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (admin/admin123)
- **User Service**: http://localhost:3001
- **Video Service**: http://localhost:3002
- **Job Service**: http://localhost:3003

---

## Testing the Application

### 1. Browser Testing

#### Open the Application
```bash
open http://localhost:8060
```

#### Login
- Username: `testuser`
- Password: `test123`

#### Upload a Video
1. Click the upload area or drag-and-drop
2. Select an MP4 or MOV file
3. Wait for upload to complete
4. You'll see a thumbnail generated automatically

#### Perform Operations
- **Resize**: Click on video → Click "Resize" → Enter dimensions (e.g., 1280x720)
- **Convert**: Click on video → Click "Convert" → Select format (webm, avi, mkv, flv)
- **Extract Audio**: Click on video → Click "Extract Audio"

#### Monitor Progress
- Real-time updates appear in the UI
- Open http://localhost:8060/admin/queues to see Bull Board

### 2. API Testing

#### Run Automated Tests
```bash
./test-api.sh
```

This will test:
- Server health
- User login
- Get user info
- Get videos list
- Bull Board access
- Database connection
- Redis connection

#### Manual API Testing

**Login:**
```bash
curl -X POST http://localhost:8060/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "test123"}' \
  -c cookies.txt
```

**Get Videos:**
```bash
curl http://localhost:8060/api/videos -b cookies.txt
```

**Upload Video:**
```bash
curl -X POST http://localhost:8060/api/upload-video \
  -H "filename: test.mp4" \
  -b cookies.txt \
  --data-binary @/path/to/video.mp4
```

**Resize Video:**
```bash
curl -X PUT http://localhost:8060/api/video/resize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"videoId": "abc123", "width": 1280, "height": 720}'
```

**Convert Video:**
```bash
curl -X PUT "http://localhost:8060/api/video/convert?videoId=abc123" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"format": "webm"}'
```

### 3. Monitor Jobs

#### Bull Board Dashboard
```bash
open http://localhost:8060/admin/queues
```

You'll see:
- **Waiting**: Jobs in queue
- **Active**: Currently processing
- **Completed**: Successfully finished
- **Failed**: Jobs with errors

#### WebSocket Real-Time Updates

Open browser console at http://localhost:8060:

```javascript
const socket = io();

socket.on('job:queued', (data) => {
  console.log('Job queued:', data);
});

socket.on('job:progress', (data) => {
  console.log('Progress:', data.progress + '%');
});

socket.on('job:completed', (data) => {
  console.log('Completed:', data);
});
```

### 4. Database Inspection

```bash
# View all users
psql video_editor -c "SELECT username, email, tier, created_at FROM users;"

# View all videos
psql video_editor -c "SELECT video_id, name, extension, created_at FROM videos;"

# View operations
psql video_editor -c "SELECT video_id, operation_type, status, created_at FROM video_operations ORDER BY created_at DESC LIMIT 10;"

# View job history
psql video_editor -c "SELECT job_id, type, status, progress, created_at FROM job_history ORDER BY created_at DESC LIMIT 10;"
```

---

## Troubleshooting

### Server won't start

**Check if port is in use:**
```bash
lsof -i :8060
# If a process is using it:
kill -9 <PID>
```

**Check logs:**
```bash
npm start
# Look for error messages in console
```

### Can't login

**Verify test user exists:**
```bash
psql video_editor -c "SELECT * FROM users WHERE username='testuser';"
```

**Recreate test user:**
```bash
psql video_editor << 'EOF'
DELETE FROM users WHERE username='testuser';
INSERT INTO users (username, email, password_hash, tier)
VALUES (
  'testuser',
  'test@example.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'free'
);
EOF
```

### Jobs stuck in queue

**Check Bull Board:**
```bash
open http://localhost:8060/admin/queues
```

**Check Redis:**
```bash
redis-cli LLEN "bull:video-processing:wait"
redis-cli LRANGE "bull:video-processing:wait" 0 -1
```

**Restart the server:**
```bash
# Press Ctrl+C to stop
npm start
```

### Database errors

**Verify connection:**
```bash
pg_isready
psql -l | grep video_editor
```

**Reset database (⚠️ deletes all data):**
```bash
dropdb video_editor
createdb video_editor
psql video_editor -f database/schema.sql
```

### Redis errors

**Check Redis:**
```bash
redis-cli ping
```

**Start Redis:**
```bash
redis-server --daemonize yes
```

---

## Performance Testing

### Load Testing with Multiple Uploads

```bash
# Upload 5 videos simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:8060/api/upload-video \
    -H "filename: test-$i.mp4" \
    -b cookies.txt \
    --data-binary @test-video.mp4&
done
wait

# Check queue
open http://localhost:8060/admin/queues
```

### Monitor Resource Usage

```bash
# CPU and Memory
top

# PostgreSQL connections
psql video_editor -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory
redis-cli INFO memory

# Disk usage (storage folder)
du -sh storage/
```

---

## Next Steps

Once you've verified everything works:

1. **Try different video formats**: MP4, MOV (upload limits)
2. **Test all operations**: Resize, convert, extract audio
3. **Monitor performance**: Watch Bull Board during processing
4. **Check file storage**: Look in `storage/{videoId}/` folders
5. **Explore microservices**: Set up RabbitMQ and try microservices mode

---

## Quick Reference

### Start Commands
```bash
./quick-start.sh          # Monolith with checks
npm start                 # Monolith simple
npm run cluster           # Monolith production
cd services && ./start-all.sh  # Microservices
```

### URLs
- Frontend: http://localhost:8060
- Bull Board: http://localhost:8060/admin/queues
- API Gateway: http://localhost:3000 (microservices)
- RabbitMQ: http://localhost:15672 (microservices)

### Test User
- Username: `testuser`
- Password: `test123`

### Useful Commands
```bash
./test-api.sh                    # Test all APIs
psql video_editor                # Database console
redis-cli                        # Redis console
lsof -i :8060                    # Check port usage
```

---

## Documentation

For more detailed information:
- [STARTUP_GUIDE.md](STARTUP_GUIDE.md) - Complete startup guide
- [README.md](README.md) - Full application documentation
- [BULL_REDIS_GUIDE.md](BULL_REDIS_GUIDE.md) - Queue system details
- [EVENT_DRIVEN_GUIDE.md](EVENT_DRIVEN_GUIDE.md) - Microservices architecture

---

Happy Testing! 🚀
