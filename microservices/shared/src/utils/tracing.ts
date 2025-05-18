import * as opentelemetry from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { trace, context, SpanStatusCode, Span } from "@opentelemetry/api";
import { Request, Response } from "express";

// Initialize OpenTelemetry SDK
export const initializeTracing = (serviceName: string): opentelemetry.NodeSDK => {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

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

  sdk
    .start()
    .then(() => {
      console.log("OpenTelemetry instrumentation initialized");
    })
    .catch((error) => {
      console.error("Error initializing OpenTelemetry instrumentation:", error);
    });

  return sdk;
};

// Function to create a new span
export const createSpan = (
  name: string,
  options?: {
    attributes?: Record<string, string | number | boolean | string[]>;
    kind?: opentelemetry.api.SpanKind;
  }
): Span => {
  const { attributes = {}, kind = opentelemetry.api.SpanKind.INTERNAL } = options || {};
  const tracer = trace.getTracer("default");

  return tracer.startSpan(name, { attributes, kind });
};

// Function to execute code within a new span
export const withSpan = async <T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    attributes?: Record<string, string | number | boolean | string[]>;
    kind?: opentelemetry.api.SpanKind;
  }
): Promise<T> => {
  const span = createSpan(name, options);

  try {
    // Run the function with the span in the context
    return await context.with(trace.setSpan(context.active(), span), () => fn(span));
  } catch (error) {
    // Record error in span
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    span.recordException(error as Error);

    // Re-throw the error
    throw error;
  } finally {
    // End the span
    span.end();
  }
};

// Middleware to start a new span for each request
export const traceMiddleware = (spanNamePrefix: string = "http") => {
  return (req: Request, res: Response, next: Function) => {
    const spanName = `${spanNamePrefix}:${req.method}:${req.path}`;

    const span = createSpan(spanName, {
      kind: opentelemetry.api.SpanKind.SERVER,
      attributes: {
        "http.method": req.method,
        "http.url": req.originalUrl || req.url,
        "http.route": req.path,
        "http.user_agent": (req.headers["user-agent"] as string) || "",
        "http.request_content_length": parseInt(
          (req.headers["content-length"] as string) || "0",
          10
        ),
      },
    });

    // Add span to request object for later use
    (req as any).span = span;

    // Process request in the context of the span
    context.with(trace.setSpan(context.active(), span), () => {
      // Capture response data once it's sent
      const originalEnd = res.end;

      // @ts-ignore
      res.end = function (...args) {
        // Capture status code
        span.setAttribute("http.status_code", res.statusCode);

        // End the span
        span.end();

        // Call the original end method
        // @ts-ignore
        return originalEnd.apply(this, args);
      };

      next();
    });
  };
};
