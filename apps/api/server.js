// CRITICAL: Initialize telemetry FIRST (before any other imports)
const telemetry = require('@video-editor/shared/telemetry');
const sdk = telemetry.initializeTelemetry('video-editor-api');

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const config = require('@video-editor/shared/config');
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const imageRoutes = require('./routes/imageRoutes');
const billingRoutes = require('./routes/billingRoutes');
const { authenticate } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const videoController = require('./controllers/videoController');
const imageController = require('./controllers/imageController');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: config.api.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({ 
  origin: config.api.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', authenticate, videoRoutes);
app.use('/api/images', authenticate, imageRoutes);
app.use('/api/billing', authenticate, billingRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Initialize Bull Queue (if not running in test mode)
let queue = null;
if (process.env.NODE_ENV !== 'test') {
  try {
    const BullQueue = require('@video-editor/worker/queue/BullQueue');
    queue = new BullQueue();

    // Inject queue into controllers
    videoController.setQueue(queue);
    imageController.setQueue(queue);

    // Initialize WebSocket handler
    require('./websocket/socketHandler')(io, queue);

    console.log('[API] Bull queue initialized');
  } catch (error) {
    console.warn('[API] Bull queue not initialized (worker service may be running separately):', error.message);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[API] SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    console.log('[API] HTTP server closed');

    // Flush telemetry before closing queue
    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    if (queue) {
      queue.close().then(() => {
        console.log('[API] Queue closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('[API] SIGINT received, shutting down gracefully...');
  server.close(async () => {
    console.log('[API] HTTP server closed');

    // Flush telemetry before closing queue
    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    if (queue) {
      queue.close().then(() => {
        console.log('[API] Queue closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// Start server
const PORT = config.api.port;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         VIDEO EDITOR API SERVICE                          ║
║                                                           ║
║  Environment: ${config.api.env.padEnd(44)}║
║  Port:        ${PORT.toString().padEnd(44)}║
║  Database:    ${config.database.host}:${config.database.port} (${config.database.database})${' '.repeat(44 - (config.database.host + ':' + config.database.port + ' (' + config.database.database + ')').length)}║
║  Redis:       ${config.redis.host}:${config.redis.port}${' '.repeat(44 - (config.redis.host + ':' + config.redis.port).length)}║
║  WebSocket:   ${queue ? 'Enabled' : 'Disabled'}${' '.repeat(44 - (queue ? 'Enabled' : 'Disabled').length)}║
║                                                           ║
║  Endpoints:                                               ║
║    POST   /api/auth/login                                 ║
║    GET    /api/videos                                     ║
║    POST   /api/videos/upload                              ║
║    POST   /api/videos/resize                              ║
║    POST   /api/videos/convert                             ║
║    GET    /api/videos/asset                               ║
║    GET    /api/images                                     ║
║    POST   /api/images/upload                              ║
║    POST   /api/images/crop                                ║
║    GET    /api/images/asset                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
