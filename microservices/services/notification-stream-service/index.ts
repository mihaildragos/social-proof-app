import { createServer } from "./server";
import { getContextLogger } from "./src/utils/logger";

const logger = getContextLogger({ service: "notification-stream-service" });

// Get port from environment variable or use default
const PORT = process.env.PORT || 3002;

// Create and start the server
const app = createServer();

// Start the server
app.listen(PORT, () => {
  logger.info(`Notification stream service listening on port ${PORT}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

// Handle termination signals
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received. Shutting down gracefully");
  process.exit(0);
});
