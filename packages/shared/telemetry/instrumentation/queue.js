/**
 * Bull Queue Instrumentation
 * Propagates trace context through Redis-backed queue
 */

const api = require('@opentelemetry/api');
const { buildQueueAttributes } = require('../utils/attributes');
const config = require('../config');

const tracer = api.trace.getTracer('queue-instrumentation', '1.0.0');

/**
 * Inject trace context into Bull job data
 * Called when enqueueing a job (API service)
 */
function injectTraceContext(jobData) {
  if (!config.enabled) {
    return jobData;
  }

  const activeContext = api.context.active();
  const span = api.trace.getSpan(activeContext);

  if (!span) {
    return jobData;
  }

  // Create carrier object for context propagation
  const carrier = {};

  // Inject current span context into carrier
  api.propagation.inject(activeContext, carrier);

  // Add carrier to job data
  return {
    ...jobData,
    _traceContext: carrier,
  };
}

/**
 * Extract trace context from Bull job data and create child span
 * Called when processing a job (Worker service)
 */
function extractTraceContextAndStartSpan(bullJob, spanName, callback) {
  if (!config.enabled) {
    return callback(api.context.active(), null);
  }

  const jobData = bullJob.data;
  let parentContext = api.context.active();

  // Extract trace context if present
  if (jobData._traceContext) {
    parentContext = api.propagation.extract(
      api.ROOT_CONTEXT,
      jobData._traceContext
    );
  }

  // Start a new span in the extracted context
  return api.context.with(parentContext, () => {
    return tracer.startActiveSpan(spanName, (span) => {
      // Set queue-related attributes
      const attributes = buildQueueAttributes({
        type: bullJob.name,
        jobId: bullJob.id,
        priority: jobData.priority,
        videoId: jobData.videoId,
        imageId: jobData.imageId,
      });

      span.setAttributes(attributes);

      try {
        // Execute callback in the span context
        const result = callback(api.context.active(), span);

        // Handle async results
        if (result instanceof Promise) {
          return result
            .then((res) => {
              span.setStatus({ code: api.SpanStatusCode.OK });
              span.end();
              return res;
            })
            .catch((error) => {
              span.recordException(error);
              span.setStatus({
                code: api.SpanStatusCode.ERROR,
                message: error.message,
              });
              span.end();
              throw error;
            });
        } else {
          span.setStatus({ code: api.SpanStatusCode.OK });
          span.end();
          return result;
        }
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.end();
        throw error;
      }
    });
  });
}

/**
 * Create span for job enqueue operation
 */
function createEnqueueSpan(jobType, jobData) {
  if (!config.enabled) {
    return { run: (fn) => fn() };
  }

  return tracer.startActiveSpan(`queue.enqueue.${jobType}`, (span) => {
    span.setAttributes({
      'queue.operation': 'enqueue',
      'queue.job.type': jobType,
      'video.id': jobData.videoId || jobData.imageId,
    });

    return {
      run: async (fn) => {
        try {
          const result = await fn();
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error);
          span.setStatus({ code: api.SpanStatusCode.ERROR, message: error.message });
          throw error;
        } finally {
          span.end();
        }
      }
    };
  });
}

module.exports = {
  injectTraceContext,
  extractTraceContextAndStartSpan,
  createEnqueueSpan,
};
