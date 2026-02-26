const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: process.env.SERVICE_NAME || 'convertix'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status', 'service'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Application-level metrics
const appVideoUploads = new client.Counter({
  name: 'app_video_uploads_total',
  help: 'Total number of video uploads',
  labelNames: ['service'],
  registers: [register]
});

const appImageUploads = new client.Counter({
  name: 'app_image_uploads_total',
  help: 'Total number of image uploads',
  labelNames: ['service'],
  registers: [register]
});

const appJobsCreated = new client.Counter({
  name: 'app_jobs_created_total',
  help: 'Total number of processing jobs created',
  labelNames: ['service', 'operation', 'resource_type'],
  registers: [register]
});

const appJobsCompleted = new client.Counter({
  name: 'app_jobs_completed_total',
  help: 'Total number of processing jobs completed',
  labelNames: ['service', 'operation', 'status'],
  registers: [register]
});

const appJobsFailed = new client.Counter({
  name: 'app_jobs_failed_total',
  help: 'Total number of processing jobs failed',
  labelNames: ['service', 'operation'],
  registers: [register]
});

const appJobProcessingSeconds = new client.Histogram({
  name: 'app_job_processing_seconds',
  help: 'Duration of processing jobs in seconds',
  labelNames: ['service', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// Bull Queue Metrics
const bullQueueWaiting = new client.Gauge({
  name: 'bull_queue_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [register]
});

const bullQueueActive = new client.Gauge({
  name: 'bull_queue_active',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue'],
  registers: [register]
});

const bullQueueCompleted = new client.Counter({
  name: 'bull_queue_completed',
  help: 'Number of completed jobs',
  labelNames: ['queue'],
  registers: [register]
});

const bullQueueFailed = new client.Counter({
  name: 'bull_queue_failed',
  help: 'Number of failed jobs',
  labelNames: ['queue'],
  registers: [register]
});

const bullJobDuration = new client.Histogram({
  name: 'bull_job_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// Database Metrics
const dbConnectionsActive = new client.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

const dbConnectionsMax = new client.Gauge({
  name: 'db_connections_max',
  help: 'Maximum number of database connections',
  registers: [register]
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

/**
 * Middleware to track HTTP requests
 */
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    const start = Date.now();

    // Track response
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      const path = req.route ? req.route.path : req.path;

      // Increment request counter
      httpRequestsTotal.labels(
        req.method,
        path,
        res.statusCode.toString(),
        serviceName
      ).inc();

      // Record request duration
      httpRequestDuration.labels(
        req.method,
        path,
        res.statusCode.toString(),
        serviceName
      ).observe(duration);
    });

    next();
  };
}

/**
 * Metrics endpoint handler
 */
async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

/**
 * Update Bull queue metrics
 */
async function updateQueueMetrics(queue, queueName) {
  try {
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();

    bullQueueWaiting.labels(queueName).set(waiting);
    bullQueueActive.labels(queueName).set(active);
    // Note: completed and failed are counters, so they should only be incremented
    // We'll handle that in the queue event listeners instead
  } catch (error) {
    console.error('[Metrics] Error updating queue metrics:', error);
  }
}

/**
 * Update database connection pool metrics
 */
function updateDBMetrics(pool) {
  try {
    dbConnectionsActive.set(pool.totalCount - pool.idleCount);
    dbConnectionsMax.set(pool.options.max || 20);
  } catch (error) {
    console.error('[Metrics] Error updating DB metrics:', error);
  }
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  updateQueueMetrics,
  updateDBMetrics,
  // Export individual metrics for direct access
  metrics: {
    httpRequestsTotal,
    httpRequestDuration,
    // app-level metrics
    appVideoUploads,
    appImageUploads,
    appJobsCreated,
    appJobsCompleted,
    appJobsFailed,
    appJobProcessingSeconds,
    // bull metrics
    bullQueueWaiting,
    bullQueueActive,
    bullQueueCompleted,
    bullQueueFailed,
    bullJobDuration,
    // db metrics
    dbConnectionsActive,
    dbConnectionsMax,
    dbQueryDuration
  }
};
