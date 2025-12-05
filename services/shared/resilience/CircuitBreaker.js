/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascade failures by detecting when a service is down and failing fast
 * instead of waiting for timeouts.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures detected, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 *
 * @example
 * const breaker = new CircuitBreaker('user-service', {
 *   failureThreshold: 5,
 *   timeout: 60000,
 *   resetTimeout: 30000
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await callUserService();
 * });
 */

const EventEmitter = require('events');

const State = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();

    this.name = name;

    // Configuration
    this.failureThreshold = options.failureThreshold || 5; // Open after 5 failures
    this.successThreshold = options.successThreshold || 2; // Close after 2 successes in HALF_OPEN
    this.timeout = options.timeout || 60000; // Request timeout (1 minute)
    this.resetTimeout = options.resetTimeout || 30000; // Time before trying HALF_OPEN (30 seconds)
    this.monitoringPeriod = options.monitoringPeriod || 10000; // Rolling window (10 seconds)

    // State
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      timeouts: 0,
      lastFailureTime: null,
      lastSuccessTime: null
    };

    // Rolling window for failure rate
    this.requestLog = [];

    console.log(`[CircuitBreaker:${this.name}] Initialized in ${this.state} state`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn, fallback = null) {
    this.stats.totalRequests++;

    // Check if circuit is OPEN
    if (this.state === State.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        this.emit('rejected', { name: this.name, state: this.state });

        // Return fallback or throw error
        if (fallback) {
          console.log(`[CircuitBreaker:${this.name}] Circuit OPEN, using fallback`);
          return typeof fallback === 'function' ? await fallback() : fallback;
        }

        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }

      // Try HALF_OPEN
      this.transitionTo(State.HALF_OPEN);
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, this.timeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      // Return fallback or rethrow
      if (fallback) {
        console.log(`[CircuitBreaker:${this.name}] Request failed, using fallback`);
        return typeof fallback === 'function' ? await fallback() : fallback;
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.stats.successfulRequests++;
    this.stats.lastSuccessTime = Date.now();
    this.logRequest(true);

    if (this.state === State.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.transitionTo(State.CLOSED);
      }
    }

    this.failureCount = 0;
    this.emit('success', { name: this.name, stats: this.getStats() });
  }

  /**
   * Handle failed request
   */
  onFailure(error) {
    this.stats.failedRequests++;
    this.stats.lastFailureTime = Date.now();
    this.logRequest(false);

    if (error.message && error.message.includes('timeout')) {
      this.stats.timeouts++;
    }

    this.failureCount++;

    if (this.state === State.HALF_OPEN) {
      // Immediately open on failure in HALF_OPEN
      this.transitionTo(State.OPEN);
    } else if (this.state === State.CLOSED) {
      // Check if we should open
      const failureRate = this.getFailureRate();

      if (this.failureCount >= this.failureThreshold || failureRate > 0.5) {
        this.transitionTo(State.OPEN);
      }
    }

    this.emit('failure', {
      name: this.name,
      error: error.message,
      state: this.state,
      stats: this.getStats()
    });
  }

  /**
   * Transition to new state
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === State.OPEN) {
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CircuitBreaker:${this.name}]    OPENED - Will retry in ${this.resetTimeout}ms`);
    } else if (newState === State.HALF_OPEN) {
      this.successCount = 0;
      console.log(`[CircuitBreaker:${this.name}] = HALF_OPEN - Testing service recovery`);
    } else if (newState === State.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      console.log(`[CircuitBreaker:${this.name}]  CLOSED - Service recovered`);
    }

    this.emit('stateChange', {
      name: this.name,
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log request for rolling window analysis
   */
  logRequest(success) {
    const now = Date.now();
    this.requestLog.push({ timestamp: now, success });

    // Remove old entries outside monitoring period
    this.requestLog = this.requestLog.filter(
      entry => now - entry.timestamp < this.monitoringPeriod
    );
  }

  /**
   * Get failure rate in current monitoring window
   */
  getFailureRate() {
    if (this.requestLog.length === 0) return 0;

    const failures = this.requestLog.filter(entry => !entry.success).length;
    return failures / this.requestLog.length;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      ...this.stats,
      failureRate: this.getFailureRate(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === State.OPEN ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    console.log(`[CircuitBreaker:${this.name}] Manual reset`);
    this.transitionTo(State.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.requestLog = [];
  }

  /**
   * Check if circuit is allowing requests
   */
  isOpen() {
    return this.state === State.OPEN && Date.now() < this.nextAttempt;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
}

module.exports = { CircuitBreaker, State };
