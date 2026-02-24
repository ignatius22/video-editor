// CRITICAL: Initialize telemetry FIRST (before any other imports)
const telemetry = require('@video-editor/shared/telemetry');
const sdk = telemetry.initializeTelemetry('video-editor-api');

const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('api');

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const cors = require('cors');
const path = require('path');

const config = require('@video-editor/shared/config');
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const imageRoutes = require('./routes/imageRoutes');
const billingRoutes = require('./routes/billingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { authenticate, adminOnly } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { 
  helmetConfig, 
  globalLimiter, 
  authLimiter, 
  processingLimiter, 
  csrfProtection 
} = require('./middleware/security');
const videoController = require('./controllers/videoController');
const imageController = require('./controllers/imageController');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with Redis Adapter
const pubClient = new Redis({
  host: config.redis.host,
  port: config.redis.port
});
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => logger.error({ err }, 'Socket.IO Redis PubClient Error'));
subClient.on('error', (err) => logger.error({ err }, 'Socket.IO Redis SubClient Error'));

const io = socketIO(server, {
  adapter: createAdapter(pubClient, subClient),
  cors: {
    origin: config.api.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security & Global Middleware
app.use(helmetConfig);
app.use(globalLimiter);
app.use(cors({ 
  origin: config.api.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '500mb' }));
app.use(csrfProtection);

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }, 'HTTP Request');
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/videos', processingLimiter, authenticate, videoRoutes);
app.use('/api/images', processingLimiter, authenticate, imageRoutes);
app.use('/api/billing', authenticate, billingRoutes);
app.use('/api/admin', authenticate, adminOnly, adminRoutes);

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

    logger.info('Bull queue initialized');
  } catch (error) {
    logger.warn({ err: error.message }, 'Bull queue not initialized (worker service may be running separately)');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed');

    // Flush telemetry before closing queue
    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    if (queue) {
      queue.close().then(() => {
        logger.info('Queue closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed');

    // Flush telemetry before closing queue
    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    if (queue) {
      queue.close().then(() => {
        logger.info('Queue closed');
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
  logger.info({
    port: PORT,
    env: config.api.env,
    db: `${config.database.host}:${config.database.port}`,
    redis: `${config.redis.host}:${config.redis.port}`,
    websocket: !!queue
  }, 'VIDEO EDITOR API SERVICE STARTED');
});

module.exports = { app, server };
