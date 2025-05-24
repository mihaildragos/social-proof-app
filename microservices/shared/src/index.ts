// Export utilities
export * from "./utils/logger";
export * from "./utils/errors";
export * from "./utils/tracing";

// Export main initialization function
import { initializeTracing } from "./utils/tracing";
import { setupGlobalErrorHandlers } from "./utils/errors";
import { logger } from "./utils/logger";

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
