/**
 * Resilience Module
 *
 * Production-ready patterns for building resilient distributed systems:
 * - Circuit Breaker: Prevent cascade failures
 * - Health Checks: Deep dependency monitoring
 * - Timeouts & Retries: Graceful failure handling
 */

const { CircuitBreaker, State } = require('./CircuitBreaker');
const {
  HealthCheck,
  checkPostgres,
  checkRedis,
  checkRabbitMQ,
  checkBullQueue
} = require('./HealthCheck');

module.exports = {
  CircuitBreaker,
  State,
  HealthCheck,
  checkPostgres,
  checkRedis,
  checkRabbitMQ,
  checkBullQueue
};
