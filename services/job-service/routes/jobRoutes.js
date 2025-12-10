const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

// Enqueue a new job
router.post('/enqueue', jobController.enqueueJob);

// Get job status
router.get('/status/:jobId', jobController.getJobStatus);

// Get queue statistics
router.get('/queue/stats', jobController.getQueueStats);

// Get job history
router.get('/history', jobController.getJobHistory);

// Get comprehensive analytics
router.get('/analytics', jobController.getAnalytics);

module.exports = router;
