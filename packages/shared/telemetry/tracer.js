/**
 * OpenTelemetry Tracer Provider
 * Sets up auto-instrumentation and OTLP exporter for SigNoz
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { ParentBasedSampler, TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base');
const config = require('./config');

let sdk = null;

/**
 * Initialize OpenTelemetry SDK
 * @param {string} serviceName - Service name (video-editor-api or video-editor-worker)
 */
function initializeTelemetry(serviceName) {
  if (!config.enabled) {
    console.log('[Telemetry] OpenTelemetry disabled via OTEL_ENABLED=false');
    return null;
  }

  try {
    // Create resource attributes
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
        'service.namespace': 'video-processing',
      })
    );

    // Create OTLP exporter for SigNoz
    const traceExporter = new OTLPTraceExporter({
      url: `http://${config.exporter.endpoint}`,
      headers: parseHeaders(config.exporter.headers),
    });

    // Create sampler (parent-based with ratio)
    const sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.sampling.probability)
    });

    // Initialize SDK with auto-instrumentations
    sdk = new NodeSDK({
      resource,
      traceExporter,
      spanProcessor: new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
      }),
      sampler,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Fine-tune auto-instrumentations
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
        }),
      ],
    });

    sdk.start();

    console.log(`[Telemetry] OpenTelemetry initialized for ${serviceName}`);
    console.log(`[Telemetry] Exporting to: ${config.exporter.endpoint}`);
    console.log(`[Telemetry] Sampling probability: ${config.sampling.probability}`);

    return sdk;
  } catch (error) {
    console.error('[Telemetry] Failed to initialize OpenTelemetry:', error);
    return null;
  }
}

/**
 * Gracefully shutdown telemetry (flush pending spans)
 */
async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[Telemetry] OpenTelemetry shutdown complete');
    } catch (error) {
      console.error('[Telemetry] Error during shutdown:', error);
    }
  }
}

/**
 * Parse OTLP headers from environment variable
 * Format: "key1=value1,key2=value2"
 */
function parseHeaders(headersString) {
  if (!headersString) return {};

  return headersString.split(',').reduce((headers, pair) => {
    const [key, value] = pair.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
    return headers;
  }, {});
}

module.exports = {
  initializeTelemetry,
  shutdownTelemetry,
};
