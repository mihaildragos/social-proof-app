// OpenTelemetry instrumentation for Node.js applications
const process = require("process");
const opentelemetry = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-proto");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-proto");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { ConsoleSpanExporter } = require("@opentelemetry/sdk-trace-base");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");

// Get service name from environment or use a default
const serviceName = process.env.SERVICE_NAME || "unknown-service";

// OTLP endpoint from environment or use default
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

// Debug mode for local development
const isDebugMode = process.env.NODE_ENV !== "production";

// Configure the OpenTelemetry SDK
const sdk = new opentelemetry.NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Add specific instrumentation configuration here
      "@opentelemetry/instrumentation-http": {
        enabled: true,
        ignoreOutgoingUrls: [/\/health$/],
      },
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-pg": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-redis": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-kafkajs": {
        enabled: true,
      },
    }),
  ],
});

// For local development, also log to console
if (isDebugMode) {
  sdk.addSpanProcessor(new opentelemetry.tracing.SimpleSpanProcessor(new ConsoleSpanExporter()));
}

// Start the SDK and handle shutdown
sdk
  .start()
  .then(() => {
    console.log("OpenTelemetry instrumentation initialized");

    // Graceful shutdown
    const shutdownOpenTelemetry = () => {
      sdk
        .shutdown()
        .then(() => console.log("OpenTelemetry terminated"))
        .catch((error) => console.error("Error terminating OpenTelemetry", error))
        .finally(() => process.exit(0));
    };

    // Register shutdown handlers
    process.on("SIGTERM", shutdownOpenTelemetry);
    process.on("SIGINT", shutdownOpenTelemetry);
  })
  .catch((error) => {
    console.error("Error initializing OpenTelemetry instrumentation:", error);
  });

module.exports = sdk;
