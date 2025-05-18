import express from "express";
import cors from "cors";
import webhookRoutes from "./routes/webhookRoutes";
import { kafkaProducer } from "./utils/kafka";
import { logger } from "../../../shared/src/utils/logger";
// Create express application
const app = express();
const PORT = process.env.PORT || 3004;
// Configure middleware
app.use(cors());
app.use(express.json());
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// Register routes
app.use("/api/webhooks", webhookRoutes);
// Global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});
// Start server
const server = app.listen(PORT, async () => {
  try {
    // Connect to Kafka
    await kafkaProducer.connect();
    logger.info(`Integrations service listening on port ${PORT}`);
  } catch (error) {
    logger.error("Failed to start integrations service", { error });
    process.exit(1);
  }
});
// Handle graceful shutdown
process.on("SIGTERM", async () => {
  try {
    logger.info("SIGTERM received, shutting down gracefully");
    // Disconnect from Kafka
    await kafkaProducer.disconnect();
    // Close server
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error("Error during shutdown", { error });
    process.exit(1);
  }
});
export default app;
//# sourceMappingURL=index.js.map
