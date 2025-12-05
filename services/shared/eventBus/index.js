const EventBus = require('./EventBus');

/**
 * Event Types - Centralized event type constants
 *
 * Naming Convention: <entity>.<action>
 * Examples: user.registered, video.uploaded, job.completed
 */
const EventTypes = {
  // User Events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // Video Events
  VIDEO_UPLOADED: 'video.uploaded',
  VIDEO_UPDATED: 'video.updated',
  VIDEO_DELETED: 'video.deleted',
  VIDEO_PROCESSING_REQUESTED: 'video.processing.requested',
  VIDEO_PROCESSED: 'video.processed',
  VIDEO_PROCESSING_FAILED: 'video.processing.failed',

  // Job Events
  JOB_CREATED: 'job.created',
  JOB_STARTED: 'job.started',
  JOB_PROGRESS: 'job.progress',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  JOB_RETRY: 'job.retry',

  // System Events
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning'
};

/**
 * Event Patterns - For subscribing to multiple events
 */
const EventPatterns = {
  ALL_USER_EVENTS: 'user.*',
  ALL_VIDEO_EVENTS: 'video.*',
  ALL_JOB_EVENTS: 'job.*',
  ALL_VIDEO_PROCESSING: 'video.processing.*',
  ALL_SYSTEM_EVENTS: 'system.*',
  ALL_EVENTS: '#' // RabbitMQ wildcard for all events
};

module.exports = {
  EventBus,
  EventTypes,
  EventPatterns
};
