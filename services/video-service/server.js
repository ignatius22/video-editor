const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const videoRoutes = require('./routes/videoRoutes');

const app = express();
const PORT = process.env.VIDEO_SERVICE_PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Increase body size limit for video uploads
app.use(express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[Video Service] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    service: 'video-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
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
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     VIDEO SERVICE                      ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Video Service] SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Video Service] SIGINT signal received: closing HTTP server');
  process.exit(0);
});
