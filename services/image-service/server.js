const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const imageRoutes = require('./routes/imageRoutes');
const { metricsMiddleware, metricsHandler } = require('../shared/middleware/metrics');
const { EventBus, EventTypes } = require('../shared/eventBus');
const videoService = require('../shared/database/services/videoService');
const { HealthCheck, checkPostgres, checkRabbitMQ } = require('../shared/resilience');
const db = require('../shared/database/db');

const app = express();
const PORT = process.env.IMAGE_SERVICE_PORT || 3004;

// Initialize Event Bus
const eventBus = new EventBus(process.env.RABBITMQ_URL, 'image-service');

// Initialize Health Check
const healthCheck = new HealthCheck('image-service');

// Make event bus available to routes
app.locals.eventBus = eventBus;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Increase body size limit for image uploads
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Metrics middleware (track all requests)
app.use(metricsMiddleware('image-service'));

// Request logging
app.use((req, res, next) => {
  console.log(`[Image Service] ${req.method} ${req.path}`);
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
      service: 'image-service',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Mount routes
app.use('/', imageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Image Service] Error:', err);
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
    console.log('[Image Service] Event Bus connected');

    // Register health checks
    healthCheck.register('database', async () => {
      await checkPostgres(db.pool);
    });

    healthCheck.register('rabbitmq', async () => {
      await checkRabbitMQ(eventBus);
    });

    console.log('[Image Service] Health checks registered');

    // Subscribe to JOB_COMPLETED events
    await eventBus.subscribe(EventTypes.JOB_COMPLETED, async (data, metadata) => {
      // Only process image-related jobs
      if (!data.imageId) return;

      console.log(`[Image Service] Received JOB_COMPLETED event:`, {
        jobId: data.jobId,
        imageId: data.imageId,
        operation: data.type,
        correlationId: metadata.correlationId
      });

      try {
        // Update image operation status to completed
        await videoService.updateOperationStatus(data.imageId, data.type, 'completed', data.result);
        console.log(`[Image Service] Updated image ${data.imageId} operation ${data.type} to completed`);
      } catch (error) {
        console.error('[Image Service] Error updating image status:', error.message);
        throw error; // Will trigger retry
      }
    });

    // Subscribe to JOB_FAILED events
    await eventBus.subscribe(EventTypes.JOB_FAILED, async (data, metadata) => {
      // Only process image-related jobs
      if (!data.imageId) return;

      console.log(`[Image Service] Received JOB_FAILED event:`, {
        jobId: data.jobId,
        imageId: data.imageId,
        operation: data.type,
        error: data.error,
        correlationId: metadata.correlationId
      });

      try {
        // Update image operation status to failed
        await videoService.updateOperationStatus(data.imageId, data.type, 'failed', {
          error: data.error,
          stack: data.stack
        });
        console.log(`[Image Service] Updated image ${data.imageId} operation ${data.type} to failed`);
      } catch (error) {
        console.error('[Image Service] Error updating image status:', error.message);
        throw error; // Will trigger retry
      }
    });

    console.log('[Image Service] Subscribed to job completion events');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║     IMAGE SERVICE                      ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
║     Event Bus: Connected ✅             ║
╚════════════════════════════════════════╝

Endpoints:
  GET    /images          - Get user images
  POST   /upload          - Upload image
  POST   /crop            - Crop image (queue)
  POST   /resize          - Resize image (queue)
  GET    /asset           - Get image asset
  GET    /health          - Health check
  `);
    });
  } catch (error) {
    console.error('[Image Service] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Image Service] SIGTERM signal received: closing HTTP server');
  await eventBus.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Image Service] SIGINT signal received: closing HTTP server');
  await eventBus.close();
  process.exit(0);
});
