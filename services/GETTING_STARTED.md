# Getting Started with Microservices

This guide will help you run the video editor microservices architecture.

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ installed and running
- Redis installed and running
- FFmpeg installed (for video processing)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

The easiest way to run all services:

```bash
cd services
docker-compose up -d
```

Check service status:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
```

Stop all services:
```bash
docker-compose down
```

---

### Option 2: Local Development

**Step 1: Setup Database**
```bash
# Create database
createdb video_editor

# Run schema
psql video_editor < database/schema.sql

# Run migration (if you have existing data)
node database/migrate-from-files.js
```

**Step 2: Start Redis**
```bash
redis-server --daemonize yes
```

**Step 3: Install Dependencies**
```bash
cd services

# Install for each service
cd user-service && npm install && cd ..
cd video-service && npm install && cd ..
cd job-service && npm install && cd ..
cd api-gateway && npm install && cd ..
```

**Step 4: Configure Environment**
```bash
# Copy .env.example to .env for each service
cp user-service/.env.example user-service/.env
cp video-service/.env.example video-service/.env
cp job-service/.env.example job-service/.env
cp api-gateway/.env.example api-gateway/.env
```

**Step 5: Start All Services**
```bash
./start-all.sh
```

Or start individually:
```bash
# Terminal 1: User Service
cd user-service && npm start

# Terminal 2: Video Service
cd video-service && npm start

# Terminal 3: Job Service
cd job-service && npm start

# Terminal 4: API Gateway
cd api-gateway && npm start
```

**Step 6: Verify Services**
```bash
# Check gateway health
curl http://localhost:3000/health

# Check all services status
curl http://localhost:3000/api/services/status
```

---

## 🔌 Service Endpoints

### API Gateway (Port 3000)
The main entry point for all requests:

- `GET /health` - Gateway health check
- `GET /api/services/status` - All services status

### User Service (via Gateway)
Authentication and user management:

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get user info
- `PUT /api/auth/user` - Update user

**Direct:** http://localhost:3001

### Video Service (via Gateway)
Video upload and operations:

- `GET /api/videos/videos` - Get user videos
- `POST /api/videos/upload` - Upload video
- `POST /api/videos/extract-audio` - Extract audio
- `POST /api/videos/resize` - Resize video
- `POST /api/videos/convert` - Convert format
- `GET /api/videos/asset` - Get video asset

**Direct:** http://localhost:3002

### Job Service (via Gateway)
Background processing:

- `POST /api/jobs/enqueue` - Enqueue job
- `GET /api/jobs/status/:jobId` - Get job status
- `GET /api/jobs/queue/stats` - Queue statistics
- `GET /api/jobs/history` - Job history

**Direct:** http://localhost:3003

---

## 🧪 Testing the Services

### 1. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "liam23",
    "password": "string"
  }' \
  -c cookies.txt
```

### 2. Get User Info
```bash
curl http://localhost:3000/api/auth/user \
  -b cookies.txt
```

### 3. Upload Video
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "filename: test.mp4" \
  -b cookies.txt \
  --data-binary @test.mp4
```

### 4. Get Videos
```bash
curl http://localhost:3000/api/videos/videos \
  -b cookies.txt
```

### 5. Resize Video
```bash
curl -X POST http://localhost:3000/api/videos/resize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "videoId": "9c1069b5",
    "width": 1280,
    "height": 720
  }'
```

### 6. Check Queue Stats
```bash
curl http://localhost:3000/api/jobs/queue/stats
```

---

## 🔧 Development

### Watch Logs
```bash
# All services
tail -f services/logs/*.log

# Specific service
tail -f services/logs/user-service.log
```

### Stop All Services
```bash
cd services
./stop-all.sh
```

### Rebuild Docker Images
```bash
docker-compose build
docker-compose up -d
```

---

## 📊 Monitoring

### Service Health Checks
Each service has a `/health` endpoint:

```bash
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Video Service
curl http://localhost:3003/health  # Job Service
curl http://localhost:3000/health  # API Gateway
```

### Check All Services
```bash
curl http://localhost:3000/api/services/status | jq
```

### Bull Board (Job Queue Dashboard)
If you've set it up, access at:
```
http://localhost:3003/admin/queues
```

---

## 🐛 Troubleshooting

### Service Won't Start

**Check if port is already in use:**
```bash
lsof -i :3000  # API Gateway
lsof -i :3001  # User Service
lsof -i :3002  # Video Service
lsof -i :3003  # Job Service
```

**Check PostgreSQL:**
```bash
psql -U postgres -d video_editor -c "SELECT 1"
```

**Check Redis:**
```bash
redis-cli ping
```

### Service Communication Issues

**Verify service URLs in .env files:**
- User Service: Check `USER_SERVICE_URL` in video-service/.env
- Job Service: Check `JOB_SERVICE_URL` in video-service/.env

**Check network connectivity:**
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

### Database Connection Issues

**Check database exists:**
```bash
psql -U postgres -l | grep video_editor
```

**Check connection string in .env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_editor
DB_USER=postgres
DB_PASSWORD=postgres
```

### Docker Issues

**View service logs:**
```bash
docker-compose logs user-service
docker-compose logs video-service
docker-compose logs job-service
```

**Restart specific service:**
```bash
docker-compose restart user-service
```

**Clean restart:**
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📈 Scaling

### Horizontal Scaling with Docker Compose

Scale specific services:
```bash
docker-compose up -d --scale job-service=3
docker-compose up -d --scale video-service=2
```

### Load Balancing

Add Nginx load balancer in front of API Gateway:
```nginx
upstream api_gateway {
    server localhost:3000;
    server localhost:3010;
    server localhost:3020;
}
```

---

## 🎓 Learning Resources

- [Microservices Architecture](https://microservices.io/)
- [API Gateway Pattern](https://microservices.io/patterns/apigateway.html)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Docker Compose](https://docs.docker.com/compose/)

---

## 📝 Next Steps

1. ✅ All services running
2. ⏭️ Add monitoring (Prometheus + Grafana)
3. ⏭️ Add distributed tracing (Jaeger)
4. ⏭️ Add service mesh (Istio)
5. ⏭️ Deploy to Kubernetes

---

**Need help?** Check the main README.md or service-specific documentation.
