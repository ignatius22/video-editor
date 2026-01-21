/**
 * WebSocket Handler
 * Manages real-time job updates via Socket.IO
 */

module.exports = (io, queue) => {
  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Subscribe to video/image updates
    socket.on('subscribe', (resourceId) => {
      socket.join(resourceId);
      console.log(`[WebSocket] Client ${socket.id} subscribed to ${resourceId}`);
    });

    socket.on('unsubscribe', (resourceId) => {
      socket.leave(resourceId);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${resourceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  // Listen to Bull queue events and broadcast to clients
  if (queue) {
    queue.on('job:queued', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        io.to(resourceId).emit('job:queued', data);
      }
    });

    queue.on('job:started', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        io.to(resourceId).emit('job:started', data);
      }
    });

    queue.on('job:progress', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        io.to(resourceId).emit('job:progress', data);
      }
    });

    queue.on('job:completed', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        io.to(resourceId).emit('job:completed', data);
      }
    });

    queue.on('job:failed', (data) => {
      const resourceId = data.videoId || data.imageId;
      if (resourceId) {
        io.to(resourceId).emit('job:failed', data);
      }
    });
  }

  console.log('[WebSocket] Socket handler initialized');
};
