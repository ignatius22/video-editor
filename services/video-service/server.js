const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const videoRoutes = require('./routes/videoRoutes');
const { metricsMiddleware, metricsHandler } = require('../shared/middleware/metrics');
const { EventBus, EventTypes } = require('../shared/eventBus');
const videoService = require('../shared/database/services/videoService');
const { HealthCheck, checkPostgres, checkRabbitMQ } = require('../shared/resilience');
const db = require('../shared/database/db');

const app = express();
const PORT = process.env.VIDEO_SERVICE_PORT || 3002;

// Initialize Event Bus
const eventBus = new EventBus(process.env.RABBITMQ_URL, 'video-service');

// Initialize Health Check
const healthCheck = new HealthCheck('video-service');

// Make event bus available to routes
app.locals.eventBus = eventBus;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Increase body size limit for video uploads
app.use(express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// Metrics middleware (track all requests)
app.use(metricsMiddleware('video-service'));

// Request logging
app.use((req, res, next) => {
  console.log(`[Video Service] ${req.method} ${req.path}`);
  next();
});

// Metrics endpoint (for Prometheus scraping)
app.get('/metrics', metricsHandler);

// Liveness probe - basic check that service is running
app.get('/health', async (req, res) => {
  const liveness = await healthCheck.liveness();
  res.json(liveness);
});

// Readiness probe - deep check including dependencies
app.get('/health/ready', async (req, res) => {
  try {
    const readiness = await healthCheck.readiness();
    const statusCode = readiness.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      service: 'video-service',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Mount routes
app.use('/', videoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Video Service] Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
async function startServer() {
  try {
    // Connect to Event Bus
    await eventBus.connect();
    console.log('[Video Service] Event Bus connected');

    // Register health checks
    healthCheck.register('database', async () => {
      await checkPostgres(db.pool);
    });

    healthCheck.register('rabbitmq', async () => {
      await checkRabbitMQ(eventBus);
    });

    console.log('[Video Service] Health checks registered');

    // Subscribe to JOB_COMPLETED events
    await eventBus.subscribe(EventTypes.JOB_COMPLETED, async (data, metadata) => {
      console.log(`[Video Service] Received JOB_COMPLETED event:`, {
        jobId: data.jobId,
        videoId: data.videoId,
        operation: data.type,
        correlationId: metadata.correlationId
      });

      try {
        // Update video operation status to completed
        await videoService.updateOperationStatus(data.videoId, data.type, 'completed', data.result);
        console.log(`[Video Service] Updated video ${data.videoId} operation ${data.type} to completed`);
      } catch (error) {
        console.error('[Video Service] Error updating video status:', error.message);
        throw error; // Will trigger retry
      }
    });

    // Subscribe to JOB_FAILED events
    await eventBus.subscribe(EventTypes.JOB_FAILED, async (data, metadata) => {
      console.log(`[Video Service] Received JOB_FAILED event:`, {
        jobId: data.jobId,
        videoId: data.videoId,
        operation: data.type,
        error: data.error,
        correlationId: metadata.correlationId
      });

      try {
        // Update video operation status to failed
        await videoService.updateOperationStatus(data.videoId, data.type, 'failed', {
          error: data.error,
          stack: data.stack
        });
        console.log(`[Video Service] Updated video ${data.videoId} operation ${data.type} to failed`);
      } catch (error) {
        console.error('[Video Service] Error updating video status:', error.message);
        throw error; // Will trigger retry
      }
    });

    console.log('[Video Service] Subscribed to job completion events');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║     VIDEO SERVICE                      ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
║     Event Bus: Connected ✅             ║
╚════════════════════════════════════════╝

Endpoints:
  GET    /videos          - Get user videos
  POST   /upload          - Upload video
  POST   /extract-audio   - Extract audio
  POST   /resize          - Resize video (queue)
  POST   /convert         - Convert format (queue)
  GET    /asset           - Get video asset
  GET    /health          - Health check
  `);
    });
  } catch (error) {
    console.error('[Video Service] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Video Service] SIGTERM signal received: closing HTTP server');
  await eventBus.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Video Service] SIGINT signal received: closing HTTP server');
  await eventBus.close();
  process.exit(0);
});
