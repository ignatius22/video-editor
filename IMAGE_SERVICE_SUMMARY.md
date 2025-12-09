# Image Service Implementation Summary

## Overview
A dedicated **Image Service** has been created to handle all image-related operations, separate from the Video Service. This ensures proper separation of concerns and microservice architecture.

## ✅ What Was Created

### 1. Image Service Structure
```
services/image-service/
├── server.js                 # Main service entry point
├── package.json              # Dependencies
├── Dockerfile                # Container configuration
├── controllers/
│   └── imageController.js    # Image operations logic
├── routes/
│   └── imageRoutes.js        # API routes
└── middleware/
    └── auth.js               # Authentication middleware
```

### 2. Image Service Features

#### **Endpoints** (Port: 3004)

1. **GET /images**
   - Get all images for authenticated user
   - Returns list of uploaded images with metadata

2. **POST /upload**
   - Upload new image
   - Supported formats: jpg, jpeg, png, gif, webp
   - Max size: 50MB
   - Creates thumbnail and extracts dimensions
   - Publishes `IMAGE_UPLOADED` event

3. **POST /crop**
   - Crop image to specified dimensions and position
   - Parameters: `imageId`, `width`, `height`, `x` (optional), `y` (optional)
   - Validates crop area doesn't exceed image bounds
   - Creates async job via Bull Queue
   - Publishes `IMAGE_PROCESSING_REQUESTED` event

4. **POST /resize**
   - Resize image to new dimensions
   - Parameters: `imageId`, `width`, `height`
   - Creates async job via Bull Queue
   - Publishes `IMAGE_PROCESSING_REQUESTED` event

5. **GET /asset**
   - Retrieve image assets
   - Types: `original`, `cropped`, `resized`
   - Validates operation completion before serving
   - Implements caching headers for performance

### 3. FF.js Image Functions Restored

Added back to [lib/FF.js](lib/FF.js):

- **cropImage(originalImagePath, targetImagePath, width, height, x, y)**
  - Uses FFmpeg: `ffmpeg -i input.jpg -vf "crop=W:H:X:Y" output.jpg`

- **resizeImage(originalImagePath, targetImagePath, width, height)**
  - Uses FFmpeg: `ffmpeg -i image.jpg -vf scale=W:H image-resized.jpg`

### 4. Bull Queue Image Processors

Added to [services/job-service/queue/BullQueue.js](services/job-service/queue/BullQueue.js):

#### **processCropImage()**
- Processes image cropping jobs
- Output: `./storage/{imageId}/cropped_{W}x{H}x{X}x{Y}.{ext}`
- Updates operation status in database
- Publishes `JOB_COMPLETED` or `JOB_FAILED` events

#### **processResizeImage()**
- Processes image resizing jobs
- Output: `./storage/{imageId}/resized_{W}x{H}.{ext}`
- Updates operation status in database
- Publishes `JOB_COMPLETED` or `JOB_FAILED` events

### 5. Job Service Updates

**Re-enabled IMAGE_PROCESSING_REQUESTED subscription:**
- Job Service now listens for both `VIDEO_PROCESSING_REQUESTED` and `IMAGE_PROCESSING_REQUESTED` events
- `handleProcessingRequest()` updated to handle both videos and images
- Properly routes jobs to correct processors based on videoId vs imageId

**Job Restoration:**
- Added restoration for `crop` and `resize-image` operations on service restart
- Incomplete image jobs are automatically re-queued

### 6. Event Bus Integration

**Published Events:**
- `IMAGE_UPLOADED` - When image is successfully uploaded
- `IMAGE_PROCESSING_REQUESTED` - When crop/resize operation is requested
- `JOB_COMPLETED` - When image processing completes
- `JOB_FAILED` - When image processing fails

**Subscribed Events:**
- Image Service subscribes to `JOB_COMPLETED` and `JOB_FAILED` for status updates

## Architecture Flow

```
User Request (Image Upload/Processing)
    ↓
Image Service (Port 3004)
    ↓
Validate & Create Operation in DB (status: pending)
    ↓
Publish IMAGE_PROCESSING_REQUESTED Event
    ↓
Job Service Receives Event
    ↓
Enqueue Job in Bull Queue (Redis)
    ↓
Bull Worker Picks Up Job
    ↓
Process Image (FFmpeg)
    ↓
Update Operation Status (status: completed/failed)
    ↓
Publish JOB_COMPLETED/JOB_FAILED Event
    ↓
Image Service Updates Operation
    ↓
User Retrieves Asset via GET /asset
```

## Database Schema

Images use the same `videos` table with a metadata flag:
```sql
{
  "video_id": "abc123",
  "user_id": 1,
  "name": "photo",
  "extension": "jpg",
  "dimensions": {"width": 1920, "height": 1080},
  "metadata": {"type": "image"},  -- Distinguishes images from videos
  "created_at": "2025-01-09T..."
}
```

Operations are stored in `video_operations` table:
```sql
{
  "id": 1,
  "video_id": "abc123",  -- Also used for images
  "operation_type": "crop" | "resize-image",
  "status": "pending" | "processing" | "completed" | "failed",
  "parameters": {"width": 500, "height": 500, "x": 0, "y": 0},
  "result_path": "./storage/abc123/cropped_500x500x0x0.jpg",
  "created_at": "2025-01-09T..."
}
```

## Testing Examples

### 1. Upload Image
```bash
curl -X POST http://localhost:3004/upload \
  -H "Filename: photo.jpg" \
  -H "Cookie: token=YOUR_TOKEN" \
  --data-binary "@photo.jpg"
```

### 2. Crop Image
```bash
curl -X POST http://localhost:3004/crop \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{
    "imageId": "abc123",
    "width": 500,
    "height": 500,
    "x": 100,
    "y": 50
  }'
```

### 3. Resize Image
```bash
curl -X POST http://localhost:3004/resize \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{
    "imageId": "abc123",
    "width": 800,
    "height": 600
  }'
```

### 4. Get Cropped Image
```bash
curl "http://localhost:3004/asset?imageId=abc123&type=cropped&dimensions=500x500x100x50" \
  -H "Cookie: token=YOUR_TOKEN" \
  --output cropped.jpg
```

### 5. Get Resized Image
```bash
curl "http://localhost:3004/asset?imageId=abc123&type=resized&dimensions=800x600" \
  -H "Cookie: token=YOUR_TOKEN" \
  --output resized.jpg
```

## Docker Deployment

The image service is containerized and ready for deployment:

```yaml
image-service:
  build:
    context: ./image-service
    dockerfile: Dockerfile
  container_name: image-service
  environment:
    IMAGE_SERVICE_PORT: 3004
    DB_HOST: postgres
    DB_PORT: 5432
    DB_NAME: video_editor
    DB_USER: postgres
    DB_PASSWORD: postgres
    USER_SERVICE_URL: http://user-service:3001
    JOB_SERVICE_URL: http://job-service:3003
    RABBITMQ_URL: amqp://admin:admin123@rabbitmq:5672
    NODE_ENV: production
  ports:
    - "3004:3004"
  volumes:
    - ../storage:/app/storage
  depends_on:
    postgres:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
    user-service:
      condition: service_started
  networks:
    - microservices
  restart: unless-stopped
```

## Health Checks

- **Liveness:** `GET /health` - Basic service health
- **Readiness:** `GET /health/ready` - Deep check including database and RabbitMQ

## Metrics

Prometheus metrics exposed at `/metrics`:
- `app_image_uploads_total` - Total image uploads
- `app_jobs_created_total{operation="crop|resize-image", resource="image"}` - Jobs created
- Image service request latency and counts

## File Storage Structure

```
storage/
├── {imageId}/
│   ├── original.{ext}                      # Original uploaded image
│   ├── cropped_{W}x{H}x{X}x{Y}.{ext}      # Cropped version
│   └── resized_{W}x{H}.{ext}              # Resized version
```

## Security

- All endpoints require authentication via User Service
- Token validation on every request
- File upload size limits (50MB)
- Input validation for all parameters
- Supported formats whitelist

## Summary

✅ **Image Service Created** - Dedicated microservice on port 3004
✅ **FF.js Functions Restored** - cropImage() and resizeImage()
✅ **Bull Queue Processors** - processCropImage() and processResizeImage()
✅ **Job Service Integration** - IMAGE_PROCESSING_REQUESTED handling
✅ **Event Bus Integration** - Full event-driven architecture
✅ **Docker Ready** - Dockerfile and configuration prepared
✅ **Complete API** - Upload, crop, resize, and asset retrieval

The image service is now fully functional and properly separated from the video service, following microservice best practices!
