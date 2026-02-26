// CRITICAL: Initialize telemetry FIRST (before any other imports)
const telemetry = require('@convertix/shared/telemetry');
const sdk = telemetry.initializeTelemetry('convertix-api');

const createLogger = require('@convertix/shared/lib/logger');
const logger = createLogger('api');

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const cors = require('cors');
const path = require('path');

const config = require('@convertix/shared/config');
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const imageRoutes = require('./routes/imageRoutes');
const billingRoutes = require('./routes/billingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { authenticate, adminOnly } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { EventBus } = require('@convertix/shared/eventBus');
const OutboxDispatcher = require('./lib/outboxDispatcher');
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

// Initialize Components (if not running in test mode)
let queue = null;
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const BullQueue = require('@convertix/worker/queue/BullQueue');
      queue = new BullQueue();

      // Initialize EventBus
      const eventBus = new EventBus(config.rabbitmq.url, 'api');
      await eventBus.connect(true);

      // Inject queue into controllers
      videoController.setQueue(queue);
      imageController.setQueue(queue);

      // Initialize WebSocket handler
      const setupWebSockets = require('./websocket/socketHandler');
      await setupWebSockets(io, queue, eventBus);

      // Initialize OutboxDispatcher (start AFTER subscribers are ready)
      const outboxDispatcher = new OutboxDispatcher(eventBus, {
        pollingInterval: 1000,
        batchSize: 10
      });
      outboxDispatcher.start();

      logger.info('Bull queue and Outbox Dispatcher initialized');

      // Attach to app for shutdown
      app.set('eventBus', eventBus);
      app.set('outboxDispatcher', outboxDispatcher);
    } catch (error) {
      logger.error({ err: error.message, stack: error.stack }, 'Queue/Dispatcher initialization failed');
    }
  })();
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');

    if (queue) {
      await queue.close();
      logger.info('Queue closed');
    }

    const eventBus = app.get('eventBus');
    const outboxDispatcher = app.get('outboxDispatcher');

    if (outboxDispatcher) outboxDispatcher.stop();
    if (eventBus) {
      await eventBus.close();
      logger.info('EventBus closed');
    }

    if (sdk) {
      await telemetry.shutdownTelemetry();
    }

    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const PORT = config.api.port;
server.listen(PORT, () => {
  logger.info({
    port: PORT,
    env: config.api.env,
    db: `${config.database.host}:${config.database.port}`,
    redis: `${config.redis.host}:${config.redis.port}`,
    websocket: true
  }, 'VIDEO EDITOR API SERVICE STARTED');
});

module.exports = { app, server };
