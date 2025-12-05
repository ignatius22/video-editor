/**
 * Health Check Utility
 *
 * Provides deep health checks for all infrastructure dependencies:
 * - PostgreSQL database
 * - Redis cache/queue
 * - RabbitMQ message broker
 *
 * Returns detailed health status for liveness and readiness probes
 */

class HealthCheck {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.checks = new Map();
    this.startTime = Date.now();
  }

  /**
   * Register a health check
   */
  register(name, checkFn, options = {}) {
    this.checks.set(name, {
      name,
      checkFn,
      critical: options.critical !== false, // Default to critical
      timeout: options.timeout || 5000
    });
  }

  /**
   * Execute all health checks
   */
  async check() {
    const results = {
      service: this.serviceName,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {}
    };

    const checkPromises = [];

    for (const [name, check] of this.checks) {
      checkPromises.push(
        this.executeCheck(check).then(result => {
          results.checks[name] = result;

          // Mark service as unhealthy if critical check fails
          if (check.critical && result.status !== 'healthy') {
            results.status = 'unhealthy';
          }
        })
      );
    }

    await Promise.all(checkPromises);

    return results;
  }

  /**
   * Execute a single health check with timeout
   */
  async executeCheck(check) {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      await Promise.race([check.checkFn(), timeoutPromise]);

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'OK'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error.message,
        error: error.code || 'UNKNOWN'
      };
    }
  }

  /**
   * Liveness probe - is service alive?
   * Returns minimal check, used by orchestrators to restart service
   */
  async liveness() {
    return {
      service: this.serviceName,
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Readiness probe - is service ready to accept traffic?
   * Returns full health check
   */
  async readiness() {
    return await this.check();
  }
}

/**
 * PostgreSQL Health Check
 */
async function checkPostgres(pool) {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/**
 * Redis Health Check
 */
async function checkRedis(redisClient) {
  if (!redisClient || !redisClient.ping) {
    throw new Error('Redis client not initialized');
  }
  await redisClient.ping();
}

/**
 * RabbitMQ Health Check
 */
async function checkRabbitMQ(eventBus) {
  if (!eventBus || !eventBus.connected) {
    throw new Error('RabbitMQ not connected');
  }
  // EventBus is connected
  return true;
}

/**
 * Bull Queue Health Check
 */
async function checkBullQueue(queue) {
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  const counts = await queue.getJobCounts();

  // Check if queue is backed up
  if (counts.waiting > 1000) {
    throw new Error(`Queue backlog: ${counts.waiting} waiting jobs`);
  }

  return counts;
}

module.exports = {
  HealthCheck,
  checkPostgres,
  checkRedis,
  checkRabbitMQ,
  checkBullQueue
};
