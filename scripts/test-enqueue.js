const path = require('path');
const BullQueue = require('../lib/BullQueue');

(async () => {
  try {
    const q = new BullQueue();

    // Wait briefly for Redis connection and queue setup
    await new Promise(resolve => setTimeout(resolve, 500));

    const jobId = await q.enqueue({ type: 'resize', videoId: 'test123', width: 100, height: 100 });
    console.log('Enqueued job id:', jobId);

    const stats = await q.getQueueStats();
    console.log('Queue stats:', stats);

    // Keep process alive briefly to allow any processors or events to log
    setTimeout(async () => {
      console.log('Test complete, closing queue');
      try { await q.close(); } catch (e) {}
      process.exit(0);
    }, 1500);
  } catch (err) {
    console.error('Test enqueue error:', err);
    process.exit(1);
  }
})();
