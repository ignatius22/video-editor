const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Bull = require('bull');

// Create Bull Board
function setupBullBoard(app) {
  // Connect to the same queue that BullQueue uses
  const videoQueue = new Bull('video-processing', {
    redis: {
      host: 'localhost',
      port: 6379
    }
  });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullAdapter(videoQueue)],
    serverAdapter: serverAdapter
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  console.log('[Bull Board] Dashboard available at http://localhost:8060/admin/queues');

  return { videoQueue, serverAdapter };
}

module.exports = setupBullBoard;
