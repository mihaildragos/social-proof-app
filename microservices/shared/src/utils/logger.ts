import winston from "winston";
import "winston-daily-rotate-file";
import { Request } from "express";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

interface LoggerOptions {
  service: string;
  level?: string;
  consoleOutput?: boolean;
  fileOutput?: boolean;
}

// Create Logger Factory
export const createLogger = (options: LoggerOptions) => {
  const { service, level = "info", consoleOutput = true, fileOutput = true } = options;

  const transports: winston.transport[] = [];

  // Add console transport if enabled
  if (consoleOutput) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level}: [${service}] ${info.message}`
          )
        ),
      })
    );
  }

  // Add file transport if enabled
  if (fileOutput) {
    transports.push(
      new winston.transports.DailyRotateFile({
        filename: `logs/${service}-%DATE%.log`,
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
          winston.format.json()
        ),
      })
    );
  }

  // Create the logger instance
  const logger = winston.createLogger({
    level: level,
    levels,
    transports,
    defaultMeta: { service },
  });

  // Add trace ID to log context if available
  const logWithTraceId = (level: string, message: string, meta?: Record<string, any>) => {
    const currentSpan = trace.getSpan(context.active());
    const traceId = currentSpan?.spanContext().traceId;
    const spanId = currentSpan?.spanContext().spanId;

    logger.log(level, message, {
      ...meta,
      ...(traceId && { traceId }),
      ...(spanId && { spanId }),
    });
  };

  // Add request information to log context
  const logRequest = (level: string, message: string, req: Request, meta?: Record<string, any>) => {
    logWithTraceId(level, message, {
      ...meta,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  };

  // Log and record error in active span if available
  const logError = (message: string, error: Error, meta?: Record<string, any>) => {
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
      currentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      currentSpan.recordException(error);
    }

    logWithTraceId("error", message, {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  };

  // Return enhanced logger
  return {
    ...logger,
    // Override standard logging methods to include trace ID
    error: (message: string, meta?: Record<string, any>) => logWithTraceId("error", message, meta),
    warn: (message: string, meta?: Record<string, any>) => logWithTraceId("warn", message, meta),
    info: (message: string, meta?: Record<string, any>) => logWithTraceId("info", message, meta),
    http: (message: string, meta?: Record<string, any>) => logWithTraceId("http", message, meta),
    debug: (message: string, meta?: Record<string, any>) => logWithTraceId("debug", message, meta),
    // Add enhanced methods
    logRequest,
    logError,
  };
};

// Create a default logger
export const logger = createLogger({
  service: process.env.SERVICE_NAME || "default",
  level: process.env.LOG_LEVEL || "info",
  consoleOutput: process.env.NODE_ENV !== "production",
  fileOutput: process.env.NODE_ENV === "production",
});
