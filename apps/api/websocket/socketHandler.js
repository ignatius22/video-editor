/**
 * WebSocket Handler
 * Manages real-time job updates via Socket.IO
 */
const createLogger = require('@video-editor/shared/lib/logger');
const logger = createLogger('websocket');

module.exports = (io, queue) => {
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

  // Listen to Bull queue events and broadcast to clients
  if (queue) {
    queue.on('job:queued', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        logger.debug({ resourceId, jobId: data.jobId }, 'Broadcasting job:queued');
        io.to(resourceId).emit('job:queued', data);
      }
    });

    queue.on('job:started', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        logger.debug({ resourceId, jobId: data.jobId }, 'Broadcasting job:started');
        io.to(resourceId).emit('job:started', data);
      }
    });

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

    queue.on('job:completed', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        logger.info({ resourceId, jobId: data.jobId }, 'Broadcasting job:completed');
        io.to(resourceId).emit('job:completed', data);
      }
    });

    queue.on('job:failed', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        logger.error({ resourceId, jobId: data.jobId, error: data.error }, 'Broadcasting job:failed');
        io.to(resourceId).emit('job:failed', data);
      }
    });
  }

  logger.info('WebSocket socket handler initialized');
};
