const amqp = require('amqplib');

/**
 * EventBus - A RabbitMQ-based event bus for microservices communication
 *
 * Features:
 * - Topic-based routing with exchange
 * - Automatic reconnection
 * - Dead letter queues for failed messages
 * - Configurable retry mechanisms
 * - Event acknowledgment
 */
class EventBus {
  constructor(rabbitMQUrl, serviceName) {
    this.rabbitMQUrl = rabbitMQUrl || process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    this.serviceName = serviceName;
    this.connection = null;
    this.channel = null;
    this.exchange = 'video_editor_events'; // Topic exchange
    this.deadLetterExchange = 'video_editor_dlx';
    this.subscribers = new Map();
    this.isConnected = false;
    this.reconnectDelay = 5000; // 5 seconds
  }

  /**
   * Connect to RabbitMQ and setup exchanges
   * @param {boolean} rethrow - Whether to rethrow the error if connection fails
   */
  async connect(rethrow = false) {
    try {
      console.log(`[EventBus] Connecting to RabbitMQ: ${this.rabbitMQUrl}`);
      this.connection = await amqp.connect(this.rabbitMQUrl);
      this.channel = await this.connection.createChannel();

      // Setup main topic exchange
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
        autoDelete: false
      });

      // Setup dead letter exchange
      await this.channel.assertExchange(this.deadLetterExchange, 'topic', {
        durable: true,
        autoDelete: false
      });

      this.isConnected = true;
      console.log(`[EventBus] Connected to RabbitMQ successfully`);

      // Handle connection close
      this.connection.on('close', () => {
        console.log('[EventBus] Connection closed, attempting to reconnect...');
        this.isConnected = false;
        setTimeout(() => this.connect(), this.reconnectDelay);
      });

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('[EventBus] Connection error:', err.message);
        this.isConnected = false;
      });

      // Re-subscribe to all existing subscriptions after reconnect
      if (this.subscribers.size > 0) {
        console.log('[EventBus] Resubscribing to events after reconnection...');
        for (const [eventPattern, handler] of this.subscribers.entries()) {
          await this._subscribeToEvent(eventPattern, handler);
        }
      }

    } catch (error) {
      console.error('[EventBus] Failed to connect to RabbitMQ:', error.message);
      this.isConnected = false;
      if (rethrow) throw error;
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  /**
   * Publish an event to the event bus
   * @param {string} eventType - Event type (e.g., 'user.registered', 'video.uploaded')
   * @param {object} data - Event payload
   * @param {object} options - Additional options (priority, expiration, etc.)
   */
  async publish(eventType, data, options = {}) {
    if (!this.isConnected || !this.channel) {
      throw new Error('[EventBus] Not connected to RabbitMQ. Cannot publish event.');
    }

    try {
      const message = {
        eventType,
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          correlationId: options.correlationId || this._generateId(),
          ...options.metadata
        }
      };

      const publishOptions = {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        ...options
      };

      const published = this.channel.publish(
        this.exchange,
        eventType, // routing key
        Buffer.from(JSON.stringify(message)),
        publishOptions
      );

      if (published) {
        console.log(`[EventBus] Published event: ${eventType}`, {
          correlationId: message.metadata.correlationId,
          service: this.serviceName
        });
      } else {
        console.warn(`[EventBus] Failed to publish event: ${eventType} (buffer full)`);
      }

      return message.metadata.correlationId;
    } catch (error) {
      console.error(`[EventBus] Error publishing event ${eventType}:`, error.message);
      throw error;
    }
  }

  /**
   * Subscribe to events matching a pattern
   * @param {string} eventPattern - Event pattern (e.g., 'user.*', 'video.uploaded')
   * @param {function} handler - Event handler function
   * @param {object} options - Subscription options
   */
  async subscribe(eventPattern, handler, options = {}) {
    if (!this.isConnected || !this.channel) {
      console.warn('[EventBus] Not connected yet. Storing subscription for later...');
      this.subscribers.set(eventPattern, { handler, options });
      return;
    }

    this.subscribers.set(eventPattern, { handler, options });
    await this._subscribeToEvent(eventPattern, { handler, options });
  }

  /**
   * Internal method to subscribe to an event
   */
  async _subscribeToEvent(eventPattern, { handler, options }) {
    try {
      const queueName = `${this.serviceName}.${eventPattern}`;
      const deadLetterQueue = `${queueName}.dlq`;

      // Assert dead letter queue
      await this.channel.assertQueue(deadLetterQueue, {
        durable: true,
        autoDelete: false
      });

      // Bind DLQ to dead letter exchange
      await this.channel.bindQueue(deadLetterQueue, this.deadLetterExchange, eventPattern);

      // Assert main queue with DLX configuration
      await this.channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
        deadLetterExchange: this.deadLetterExchange,
        deadLetterRoutingKey: eventPattern,
        messageTtl: options.messageTtl || 3600000, // 1 hour default
        maxLength: options.maxLength || 10000
      });

      // Bind queue to exchange with routing key pattern
      await this.channel.bindQueue(queueName, this.exchange, eventPattern);

      // Set prefetch count for fair distribution
      await this.channel.prefetch(options.prefetch || 1);

      // Start consuming messages
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          const { eventType, data, metadata } = content;

          console.log(`[EventBus] Received event: ${eventType}`, {
            correlationId: metadata.correlationId,
            service: this.serviceName
          });

          // Call the handler
          await handler(data, metadata);

          // Acknowledge the message
          this.channel.ack(msg);

          console.log(`[EventBus] Successfully processed event: ${eventType}`, {
            correlationId: metadata.correlationId
          });

        } catch (error) {
          console.error(`[EventBus] Error processing event:`, error.message);

          // Check retry count
          const retryCount = (msg.properties.headers['x-retry-count'] || 0);
          const maxRetries = options.maxRetries || 3;

          if (retryCount < maxRetries) {
            // Retry: reject and requeue
            console.log(`[EventBus] Retrying event (${retryCount + 1}/${maxRetries})`);

            // Update retry count
            msg.properties.headers = msg.properties.headers || {};
            msg.properties.headers['x-retry-count'] = retryCount + 1;

            // Reject and requeue with delay
            this.channel.nack(msg, false, true);
          } else {
            // Max retries exceeded: send to DLQ
            console.error(`[EventBus] Max retries exceeded, sending to DLQ`);
            this.channel.nack(msg, false, false); // Don't requeue, goes to DLQ
          }
        }
      }, {
        noAck: false // Manual acknowledgment
      });

      console.log(`[EventBus] Subscribed to: ${eventPattern} on queue: ${queueName}`);

    } catch (error) {
      console.error(`[EventBus] Error subscribing to ${eventPattern}:`, error.message);
      throw error;
    }
  }

  /**
   * Close the connection
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      console.log('[EventBus] Connection closed gracefully');
    } catch (error) {
      console.error('[EventBus] Error closing connection:', error.message);
    }
  }

  /**
   * Generate a unique ID for correlation
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if connected
   */
  get connected() {
    return this.isConnected;
  }
}

module.exports = EventBus;
