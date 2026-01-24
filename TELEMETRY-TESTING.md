# OpenTelemetry + SigNoz Testing Guide

## Prerequisites

✅ SigNoz running (accessible at `http://localhost:8080`)
✅ Docker and Docker Compose installed
✅ Port 3000 available (API service)

## Step 1: Build and Start Services

```bash
# Build the Docker images with new OpenTelemetry dependencies
docker-compose build

# Start all services (API, Worker, PostgreSQL, Redis)
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                   STATUS    PORTS
video-editor-api       running   0.0.0.0:3000->3000/tcp
video-editor-db        running   0.0.0.0:5432->5432/tcp
video-editor-redis     running   0.0.0.0:6379->6379/tcp
video-editor-worker-1  running
video-editor-worker-2  running
```

## Step 2: Verify Telemetry Initialization

Check the logs to confirm OpenTelemetry is initialized:

```bash
# Check API service logs
docker-compose logs api | grep Telemetry

# Check Worker service logs
docker-compose logs worker | grep Telemetry
```

You should see:
```
[Telemetry] OpenTelemetry initialized for video-editor-api
[Telemetry] Exporting to: host.docker.internal:4317
[Telemetry] Sampling probability: 1
```

## Step 3: Run Automated Test Script

```bash
# Make script executable
chmod +x test-telemetry.sh

# Run test
./test-telemetry.sh
```

The script will:
1. ✅ Verify API and SigNoz are running
2. 🔐 Create test user and login
3. 📹 Create and upload a test video
4. 🎬 Trigger FFmpeg operations (thumbnail, resize, convert)
5. 📊 Generate distributed traces

## Step 4: View Traces in SigNoz

1. **Open SigNoz UI**: http://localhost:8080

2. **Navigate to Traces**:
   - Click on "Traces" in the left sidebar

3. **Filter by Service**:
   - Service Name: `video-editor-api` or `video-editor-worker`
   - Time Range: Last 15 minutes

4. **Explore a Trace**:
   - Click on any trace to see the full span tree
   - Look for distributed traces spanning both services

## Expected Trace Structure

### Upload Video (Synchronous FFmpeg)
```
HTTP POST /api/videos/upload (video-editor-api, ~800ms)
├─ pg.query INSERT INTO videos (3ms)
├─ ffmpeg.makeThumbnail (450ms)
│  ├─ ffmpeg.input.path: {storage}/abc123/original.mp4
│  ├─ ffmpeg.thumbnail.timestamp: 5
│  └─ ffmpeg.exit_code: 0
└─ ffmpeg.getDimensions (220ms)
   ├─ ffmpeg.command: ffprobe
   └─ ffmpeg.exit_code: 0
```

### Resize Video (Distributed Trace: API → Queue → Worker)
```
HTTP POST /api/videos/resize (video-editor-api, 45ms)
├─ pg.query SELECT FROM videos (3ms)
├─ queue.enqueue.resize (12ms)
│  └─ ioredis.lpush video-processing (2ms)
│      [trace context propagated via Redis]
│
└─ queue.process.resize (video-editor-worker, 3250ms)
   ├─ pg.query UPDATE operations SET status='processing' (4ms)
   ├─ ffmpeg.resize (3245ms)
   │  ├─ ffmpeg.operation: resize
   │  ├─ ffmpeg.video.width: 640
   │  ├─ ffmpeg.video.height: 360
   │  ├─ ffmpeg.input.path: {storage}/abc123/original.mp4
   │  ├─ ffmpeg.output.path: {storage}/abc123/640x360.mp4
   │  ├─ ffmpeg.duration_ms: 3245
   │  └─ ffmpeg.exit_code: 0
   └─ pg.query UPDATE operations SET status='completed' (5ms)
```

## Step 5: Verify Key Features

### ✅ Distributed Tracing
- Single trace ID spans both API and Worker services
- Parent-child relationships preserved across services
- Trace context propagated through Bull Queue (Redis)

### ✅ FFmpeg Instrumentation (12 operations)
Look for these span names in SigNoz:
- `ffmpeg.makeThumbnail`
- `ffmpeg.getDimensions`
- `ffmpeg.resize`
- `ffmpeg.convertFormat`
- `ffmpeg.extractAudio`
- `ffmpeg.watermarkVideo`
- `ffmpeg.addImageWatermark`
- `ffmpeg.trimVideo`
- `ffmpeg.createGif`
- `ffmpeg.cropImage`
- `ffmpeg.resizeImage`
- `ffmpeg.convertImageFormat`

### ✅ Rich Span Attributes
Each FFmpeg span should have:
```json
{
  "ffmpeg.operation": "resize",
  "ffmpeg.command": "ffmpeg",
  "ffmpeg.video.width": 640,
  "ffmpeg.video.height": 360,
  "ffmpeg.input.path": "{storage}/abc123/original.mp4",
  "ffmpeg.output.path": "{storage}/abc123/640x360.mp4",
  "ffmpeg.exit_code": 0,
  "ffmpeg.duration_ms": 3245
}
```

### ✅ Auto-Instrumentation
Look for automatically instrumented spans:
- **Express**: `GET /api/videos`, `POST /api/videos/resize`
- **PostgreSQL**: `pg.query`, `pg.connect`
- **Redis**: `ioredis.lpush`, `ioredis.rpop`

### ✅ Error Tracking
To test error handling:

```bash
# Trigger an error (invalid dimensions)
curl -X POST http://localhost:3000/api/videos/resize \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "invalid-id", "width": 640, "height": 360}'
```

Error spans should have:
- `error: true`
- `error.type: "Error"`
- `error.message: "Video invalid-id not found"`
- `error.stack: "..."`

## Step 6: Performance Analysis

### Check Telemetry Overhead

```bash
# Without telemetry
docker-compose down
# Edit docker-compose.yml: OTEL_ENABLED=false
docker-compose up -d
# Run tests and measure time

# With telemetry
docker-compose down
# Edit docker-compose.yml: OTEL_ENABLED=true
docker-compose up -d
# Run tests and measure time
```

Expected overhead: < 5% latency increase

### Monitor Service Resources

```bash
# Check container stats
docker stats video-editor-api video-editor-worker-1
```

## Step 7: SigNoz Dashboards

### Service Map
Navigate to **Services** → **Service Map** to see:
```
video-editor-api → PostgreSQL
                 → Redis (Bull Queue)
                 ↓
video-editor-worker → PostgreSQL
                    → FFmpeg
```

### Key Metrics to Track

Create custom dashboards in SigNoz:

**FFmpeg Operation Duration (P50, P95, P99)**
```
Query: ffmpeg.*.duration_ms
Group by: ffmpeg.operation
```

**FFmpeg Error Rate**
```
Query: count(error == true)
Group by: ffmpeg.operation
Where: span.name LIKE "ffmpeg.%"
```

**Queue Processing Latency**
```
Query: duration
Where: span.name LIKE "queue.process.%"
Group by: queue.job.type
```

**End-to-End Latency**
```
Query: duration
Where: span.name LIKE "POST /api/videos/%"
Group by: http.route
```

## Troubleshooting

### No traces appearing in SigNoz

1. **Check SigNoz collector is running**:
   ```bash
   docker ps | grep signoz
   ```

2. **Verify OTLP endpoint is accessible from Docker**:
   ```bash
   docker exec video-editor-api ping -c 2 host.docker.internal
   ```

3. **Check telemetry logs**:
   ```bash
   docker-compose logs api | grep -i "telemetry\|otel"
   docker-compose logs worker | grep -i "telemetry\|otel"
   ```

4. **Verify environment variables**:
   ```bash
   docker exec video-editor-api env | grep OTEL
   ```

### Traces are incomplete

1. **Check if all services initialized telemetry**:
   ```bash
   docker-compose logs | grep "OpenTelemetry initialized"
   ```

2. **Verify trace context propagation**:
   Look for `_traceContext` in job data (check Redis):
   ```bash
   docker exec video-editor-redis redis-cli LRANGE bull:video-processing:wait 0 -1
   ```

### FFmpeg spans missing attributes

1. **Check FFmpeg operations are using instrumented wrapper**:
   ```bash
   docker-compose logs worker | grep "ffmpeg\."
   ```

2. **Verify config.enabled is true**:
   ```bash
   docker exec video-editor-worker node -e "console.log(require('./shared/telemetry/config').enabled)"
   ```

## Manual Testing (Alternative to Script)

### 1. Create User and Login

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User"
  }'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }' | jq -r '.token')

echo $TOKEN
```

### 2. Upload Video

```bash
# Create test video
echo "mock video content" > test.mp4

# Upload
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  -H "filename: test.mp4" \
  --data-binary @test.mp4
```

### 3. Trigger FFmpeg Operations

```bash
# Resize (distributed trace)
curl -X POST http://localhost:3000/api/videos/resize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "YOUR_VIDEO_ID", "width": 640, "height": 360}'

# Convert format
curl -X POST http://localhost:3000/api/videos/convert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "YOUR_VIDEO_ID", "targetFormat": "webm"}'
```

## Clean Up

```bash
# Stop services
docker-compose down

# Remove volumes (database and storage)
docker-compose down -v

# Remove test files
rm -f test-video-*.mp4
```

## Production Deployment Notes

For production deployment with SigNoz:

1. **Update OTLP endpoint** to point to your SigNoz instance:
   ```yaml
   OTEL_EXPORTER_OTLP_ENDPOINT=signoz-collector.example.com:4317
   ```

2. **Adjust sampling rate** to reduce overhead:
   ```yaml
   OTEL_TRACE_SAMPLING_PROBABILITY=0.1  # 10% sampling
   ```

3. **Add authentication headers** if required:
   ```yaml
   OTEL_EXPORTER_OTLP_HEADERS=x-signoz-token=your-token-here
   ```

4. **Set production environment**:
   ```yaml
   NODE_ENV=production
   ```

## Success Criteria

✅ Services start without errors
✅ Telemetry initialization logs appear
✅ Traces appear in SigNoz within 10 seconds
✅ Distributed traces span both API and Worker services
✅ FFmpeg spans contain all expected attributes
✅ Auto-instrumented spans (Express, pg, ioredis) visible
✅ Error traces captured with full context
✅ Performance overhead < 5%

---

**For your technical article**, this implementation demonstrates:
- Production-grade distributed tracing setup
- Custom instrumentation for domain-specific operations (FFmpeg)
- Trace context propagation through message queues
- Auto-instrumentation best practices
- Real-world observability patterns for microservices
