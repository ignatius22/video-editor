const express = require('express');
require('dotenv').config();

const BullQueue = require('./queue/BullQueue');
const jobRoutes = require('./routes/jobRoutes');
const jobController = require('./controllers/jobController');

const app = express();
const PORT = process.env.JOB_SERVICE_PORT || 3003;

// Initialize Bull Queue
const bullQueue = new BullQueue();
jobController.initQueue(bullQueue);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[Job Service] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    service: 'job-service',
    status: 'healthy',
    queue: 'connected',
    timestamp: new Date().toISOString()
  });
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
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     JOB SERVICE                        ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
║     Queue: Bull + Redis                ║
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Job Service] SIGTERM signal received: closing HTTP server');
  await bullQueue.queue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Job Service] SIGINT signal received: closing HTTP server');
  await bullQueue.queue.close();
  process.exit(0);
});
