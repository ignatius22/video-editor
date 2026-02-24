/**
 * WebSocket Handler
 * Manages real-time job updates via Socket.IO
 */
const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('websocket');

module.exports = async (io, queue, eventBus) => {
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'WebSocket client connected');

    // Subscribe to video/image updates
    socket.on('subscribe', (resourceId) => {
      socket.join(resourceId);
      logger.info({ socketId: socket.id, resourceId }, 'Client subscribed to resource updates');
    });

    socket.on('unsubscribe', (resourceId) => {
      socket.leave(resourceId);
      logger.info({ socketId: socket.id, resourceId }, 'Client unsubscribed from resource updates');
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'WebSocket client disconnected');
    });
  });

  // 1. Listen to Durable Events from EventBus and broadcast to clients
  if (eventBus) {
    await eventBus.subscribe('job.*', async (data, metadata) => {
      const { eventType } = metadata;
      const resourceId = data.videoId || data.imageId;
      
      if (!resourceId) return;

      // Map outbox event types to Socket.IO event names if necessary
      // For now they are the same: job.started, job.completed, job.failed, job.queued
      logger.info({ resourceId, eventType }, 'Broadcasting durable event via Socket.IO');
      io.to(resourceId).emit(eventType, data);
    });
  }

  // 2. Listen to Ephemeral events (progress) from Bull queue
  if (queue) {
    queue.on('job:progress', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        // Only log progress at intervals to avoid spamming logs
        if (data.progress % 25 === 0) {
          logger.debug({ resourceId, jobId: data.jobId, progress: data.progress }, 'Broadcasting job:progress');
        }
        io.to(resourceId).emit('job:progress', data);
      }
    });
  }

  logger.info('WebSocket socket handler initialized');
};
