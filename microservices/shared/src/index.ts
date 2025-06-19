// Export utilities
export * from "./utils/logger";
export * from "./utils/errors";
export * from "./utils/tracing";

// Export Redis classes
export * from "./redis/publisher";
export * from "./redis/subscriber";

// Export Kafka classes
export * from "./events/consumer";
export * from "./events/producer";
export * from "./events/schemas";

// Export middleware
export * from "./middleware/health-check";
export * from "./middleware/auth";
export * from "./middleware/auth-middleware";

// Export authentication
export * from "./auth/rbac";
export * from "./auth/clerk";
export * from "./auth/service-auth";
export * from "./auth/api-key";

// Export main initialization function
import { initializeTracing } from "./utils/tracing";
import { setupGlobalErrorHandlers } from "./utils/errors";
import { logger } from "./utils/logger";

// Export logger instance
export { logger };

export const initializeService = (options: {
  serviceName: string;
  enableTracing?: boolean;
  enableGlobalErrorHandlers?: boolean;
}): void => {
  const { serviceName, enableTracing = true, enableGlobalErrorHandlers = true } = options;

  logger.info(`Initializing service: ${serviceName}`);

  if (enableTracing) {
    logger.info("Initializing OpenTelemetry tracing");
    initializeTracing(serviceName);
  }

  if (enableGlobalErrorHandlers) {
    logger.info("Setting up global error handlers");
    setupGlobalErrorHandlers();
  }

  logger.info(`Service ${serviceName} initialized`);
};
