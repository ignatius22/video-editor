const express = require('express');
require('dotenv').config();

const BullQueue = require('./queue/BullQueue');
const jobRoutes = require('./routes/jobRoutes');
const jobController = require('./controllers/jobController');
const { metricsMiddleware, metricsHandler, updateQueueMetrics } = require('../shared/middleware/metrics');
const { EventBus, EventTypes } = require('../shared/eventBus');
const { HealthCheck, checkPostgres, checkRedis, checkRabbitMQ, checkBullQueue } = require('../shared/resilience');
const db = require('../shared/database/db');

const app = express();
const PORT = process.env.JOB_SERVICE_PORT || 3003;

// Initialize Bull Queue
const bullQueue = new BullQueue();
jobController.initQueue(bullQueue);

// Initialize Event Bus
const eventBus = new EventBus(process.env.RABBITMQ_URL, 'job-service');

// Initialize Health Check
const healthCheck = new HealthCheck('job-service');

// Make event bus available to routes and controllers
app.locals.eventBus = eventBus;
jobController.initEventBus(eventBus);

// Update queue metrics every 15 seconds
setInterval(() => {
  updateQueueMetrics(bullQueue.queue, 'video-processing');
}, 15000);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics middleware (track all requests)
app.use(metricsMiddleware('job-service'));

// Request logging
app.use((req, res, next) => {
  console.log(`[Job Service] ${req.method} ${req.path}`);
  next();
});

// Metrics endpoint (for Prometheus scraping)
app.get('/metrics', metricsHandler);

// Liveness probe
app.get('/health', async (req, res) => {
  const liveness = await healthCheck.liveness();
  res.json(liveness);
});

// Readiness probe
app.get('/health/ready', async (req, res) => {
  try {
    const readiness = await healthCheck.readiness();
    const statusCode = readiness.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      service: 'job-service',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Mount routes
app.use('/', jobRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Job Service] Error:', err);
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
    console.log('[Job Service] Event Bus connected');

    // Pass event bus to Bull Queue for job event publishing
    bullQueue.setEventBus(eventBus);

    // Register health checks
    healthCheck.register('database', async () => {
      await checkPostgres(db.pool);
    });

    healthCheck.register('redis', async () => {
      // Bull Queue uses Redis internally
      const redis = bullQueue.queue.client;
      await checkRedis(redis);
    });

    healthCheck.register('rabbitmq', async () => {
      await checkRabbitMQ(eventBus);
    });

    healthCheck.register('queue', async () => {
      await checkBullQueue(bullQueue.queue);
    }, { critical: false }); // Non-critical: service can start with queue backlog

    console.log('[Job Service] Health checks registered');

    // Subscribe to VIDEO_PROCESSING_REQUESTED events
    await eventBus.subscribe(EventTypes.VIDEO_PROCESSING_REQUESTED, async (data, metadata) => {
      console.log(`[Job Service] Received VIDEO_PROCESSING_REQUESTED event:`, {
        videoId: data.videoId,
        operation: data.operation,
        correlationId: metadata.correlationId
      });

      try {
        // Enqueue the job
        await jobController.handleProcessingRequest(data, metadata);
      } catch (error) {
        console.error('[Job Service] Error handling processing request:', error.message);
        throw error; // Will trigger retry mechanism
      }
    });

    console.log('[Job Service] Subscribed to VIDEO_PROCESSING_REQUESTED events');

    // Subscribe to IMAGE_PROCESSING_REQUESTED events
    await eventBus.subscribe(EventTypes.IMAGE_PROCESSING_REQUESTED, async (data, metadata) => {
      console.log(`[Job Service] Received IMAGE_PROCESSING_REQUESTED event:`, {
        imageId: data.imageId,
        operation: data.operation,
        correlationId: metadata.correlationId
      });

      try {
        // Enqueue the job
        await jobController.handleProcessingRequest(data, metadata);
      } catch (error) {
        console.error('[Job Service] Error handling image processing request:', error.message);
        throw error; // Will trigger retry mechanism
      }
    });

    console.log('[Job Service] Subscribed to IMAGE_PROCESSING_REQUESTED events');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║     JOB SERVICE                        ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
║     Queue: Bull + Redis                ║
║     Event Bus: Connected ✅             ║
║     Workers: ${bullQueue.CONCURRENCY}                          ║
╚════════════════════════════════════════╝

Endpoints:
  POST   /enqueue         - Enqueue new job
  GET    /status/:jobId   - Get job status
  GET    /queue/stats     - Queue statistics
  GET    /history         - Job history
  GET    /health          - Health check
  `);
    });
  } catch (error) {
    console.error('[Job Service] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Job Service] SIGTERM signal received: closing HTTP server');
  await eventBus.close();
  await bullQueue.queue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Job Service] SIGINT signal received: closing HTTP server');
  await eventBus.close();
  await bullQueue.queue.close();
  process.exit(0);
});
