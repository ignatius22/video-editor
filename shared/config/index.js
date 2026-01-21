/**
 * Shared Configuration
 * Environment-based configuration for both API and Worker services
 */

module.exports = {
  api: {
    port: process.env.API_PORT || 3000,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    env: process.env.NODE_ENV || 'development'
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'video_editor',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },

  storage: {
    path: process.env.STORAGE_PATH || './storage'
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    removeOnComplete: 100,
    removeOnFail: 200
  }
};
