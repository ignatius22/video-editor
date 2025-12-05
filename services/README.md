# Microservices Architecture

This directory contains the microservices implementation of the video editor application.

## 📁 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (Port 3000)               │
│              Routes requests to services                 │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
   ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
   │User Service  │ │Video Svc │ │ Job Service │
   │ Port 3001    │ │Port 3002 │ │ Port 3003   │
   └──────┬───────┘ └────┬─────┘ └──────┬──────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
              ┌──────────▼──────────┐
              │  Shared Resources   │
              │  - PostgreSQL       │
              │  - Redis + Bull     │
              └─────────────────────┘
```

## 🔧 Services

### 1. **User Service** (Port 3001)
**Responsibility:** User authentication and management

**Endpoints:**
- `POST /login` - Authenticate user
- `DELETE /logout` - End user session
- `GET /user` - Get user info
- `PUT /user` - Update user info

**Dependencies:**
- PostgreSQL (users, sessions tables)
- Shared database services

---

### 2. **Video Service** (Port 3002)
**Responsibility:** Video upload, metadata, asset serving

**Endpoints:**
- `POST /upload` - Upload video
- `GET /videos` - List user videos
- `GET /asset` - Serve video assets (original, thumbnail, etc.)
- `POST /extract-audio` - Extract audio from video
- `POST /resize` - Queue resize job
- `POST /convert` - Queue conversion job

**Dependencies:**
- PostgreSQL (videos, video_operations tables)
- Job Service (for processing)
- File storage (./storage)

---

### 3. **Job Service** (Port 3003)
**Responsibility:** Background video processing

**Endpoints:**
- `POST /enqueue` - Add job to queue
- `GET /status/:jobId` - Get job status
- `GET /queue/stats` - Queue statistics

**Features:**
- Bull queue with Redis
- 5 concurrent workers
- Job persistence & recovery
- Progress tracking

**Dependencies:**
- Redis (job queue)
- PostgreSQL (job_history table)
- FFmpeg (video processing)

---

### 4. **API Gateway** (Port 3000)
**Responsibility:** Single entry point, routing, rate limiting

**Routes:**
- `/api/auth/*` → User Service
- `/api/videos/*` → Video Service
- `/api/jobs/*` → Job Service

**Features:**
- Request routing
- Rate limiting
- Authentication middleware
- Load balancing (future)
- Request logging

---

## 📦 Shared Libraries

Located in `services/shared/`:

### **database/**
- `db.js` - PostgreSQL connection pool
- `services/userService.js` - User CRUD operations
- `services/sessionService.js` - Session management
- `services/videoService.js` - Video CRUD operations
- `services/jobHistoryService.js` - Job tracking

### **middleware/**
- Authentication middleware
- Error handling
- Request logging

### **utils/**
- Common utilities
- Helper functions

---

## 🚀 Running the Services

### Development (Individual Services)
```bash
# Terminal 1: User Service
cd services/user-service
npm install
npm run dev

# Terminal 2: Video Service
cd services/video-service
npm install
npm run dev

# Terminal 3: Job Service
cd services/job-service
npm install
npm run dev

# Terminal 4: API Gateway
cd services/api-gateway
npm install
npm run dev
```

### Production (Docker Compose)
```bash
# From root directory
docker-compose up -d
```

---

## 🔄 Inter-Service Communication

### **Synchronous (REST APIs)**
Services communicate via HTTP:
- Video Service → Job Service: Enqueue processing jobs
- API Gateway → All Services: Route requests

### **Asynchronous (Events)**
Services emit events via Bull queue:
- Job Service emits: `job:started`, `job:completed`, `job:failed`
- Video Service listens to update operation status

---

## 🎯 Service Boundaries

| Concern | Service | Reason |
|---------|---------|--------|
| Authentication | User Service | Single responsibility, security isolation |
| Video metadata | Video Service | Business logic domain |
| Processing | Job Service | Resource-intensive, can scale independently |
| Routing | API Gateway | Centralized entry point |

---

## 📊 Database Access

### **Shared Database Strategy**
All services access the same PostgreSQL instance but different tables:

- **User Service:** `users`, `sessions` tables
- **Video Service:** `videos`, `video_operations` tables
- **Job Service:** `job_history` table

**Alternative (Future):** Database per service with event sourcing for consistency.

---

## 🔐 Security

### **Authentication Flow**
1. Client → API Gateway (`/api/auth/login`)
2. Gateway → User Service
3. User Service validates credentials
4. Returns JWT token
5. Client includes token in subsequent requests
6. Gateway validates token before routing

### **Service-to-Service Auth**
- Internal API keys
- Service mesh (future: Istio)

---

## 📈 Scaling Strategy

### **Horizontal Scaling**
Each service can scale independently:
```yaml
# docker-compose.yml
services:
  user-service:
    deploy:
      replicas: 2  # 2 instances

  video-service:
    deploy:
      replicas: 3  # 3 instances (high traffic)

  job-service:
    deploy:
      replicas: 5  # 5 instances (CPU-intensive)
```

### **Load Balancing**
API Gateway distributes traffic:
- Round-robin
- Least connections
- Weighted distribution

---

## 🧪 Testing

### **Unit Tests**
Each service has isolated tests:
```bash
cd services/user-service
npm test
```

### **Integration Tests**
Test service interactions:
```bash
npm run test:integration
```

### **End-to-End Tests**
Full workflow testing:
```bash
npm run test:e2e
```

---

## 📝 Migration from Monolith

### **Phase 1: Coexistence**
- ✅ Monolith still running
- ✅ Services running in parallel
- Both can handle requests

### **Phase 2: Gradual Cutover**
- Route 10% traffic to microservices
- Monitor performance
- Increase gradually

### **Phase 3: Full Migration**
- 100% traffic to microservices
- Decommission monolith

---

## 🎓 Learning Outcomes

By building this architecture, you'll learn:

✅ **Service Decomposition** - Breaking monoliths apart
✅ **API Design** - RESTful service interfaces
✅ **Inter-Service Communication** - Sync & async patterns
✅ **Service Discovery** - Finding services dynamically
✅ **Distributed Tracing** - Request flow across services
✅ **Fault Tolerance** - Handling service failures
✅ **Containerization** - Docker for each service
✅ **Orchestration** - Docker Compose / Kubernetes

---

## 🔗 Resources

- [Martin Fowler - Microservices](https://martinfowler.com/articles/microservices.html)
- [12-Factor App](https://12factor.net/)
- [API Gateway Pattern](https://microservices.io/patterns/apigateway.html)
- [Service Mesh](https://istio.io/latest/docs/concepts/)

---

**Status:** 🚧 In Development
**Next:** Build User Service
