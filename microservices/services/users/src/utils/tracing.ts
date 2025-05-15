import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { logger } from './logger';

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry SDK for distributed tracing
 * @param serviceName The name of the service to use in traces
 */
export function setupTelemetry(serviceName: string): void {
  try {
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
      headers: {},
    });

    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      })
    );

    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Customize instrumentation options as needed
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
        }),
      ],
    });

    // Start SDK and handle shutdown
    sdk.start();
    logger.info('OpenTelemetry tracing initialized', { serviceName });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      shutdownTelemetry()
        .then(() => logger.info('OpenTelemetry SDK shut down successfully'))
        .catch((error) => logger.error('Error shutting down OpenTelemetry SDK', { error }))
        .finally(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      shutdownTelemetry()
        .then(() => logger.info('OpenTelemetry SDK shut down successfully'))
        .catch((error) => logger.error('Error shutting down OpenTelemetry SDK', { error }))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry', { error: (error as Error).message });
  }
}

/**
 * Shut down telemetry gracefully
 */
async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}

export default {
  setupTelemetry,
}; 