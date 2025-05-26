import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import webhookRoutes from "./routes/webhookRoutes";
import { kafkaProducer } from "./utils/kafka";
import { logger } from "@social-proof/shared";

// Create express application
const app = express();
const PORT = process.env.PORT || 3004;

// Configure middleware
app.use(cors());

// Add request logging middleware
app.use((req, res, next) => {
  try {
    logger.info("Incoming request", {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
    next();
  } catch (error) {
    logger.error("Error in request logging middleware", { error });
    next(error);
  }
});

// Use express.json() only for non-webhook routes to avoid conflicts with custom body parser
app.use((req, res, next) => {
  if (req.url.startsWith('/api/webhooks/shopify')) {
    // Skip express.json() for Shopify webhook routes - they use custom body parser
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Test endpoint
app.post("/test", (req: Request, res: Response) => {
  logger.info("Test endpoint called", { body: req.body });
  res.status(200).json({ message: "Test successful" });
});

// Simple webhook test endpoint
app.post("/api/webhooks/test", (req: Request, res: Response) => {
  try {
    logger.info("Simple webhook test called", { 
      headers: {
        shopDomain: req.headers["x-shopify-shop-domain"],
        topic: req.headers["x-shopify-topic"],
        hmac: req.headers["x-shopify-hmac-sha256"]
      },
      body: req.body 
    });
    res.status(200).json({ message: "Webhook test successful" });
  } catch (error) {
    logger.error("Error in simple webhook test", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Register routes
try {
  app.use("/api/webhooks", webhookRoutes);
  logger.info("Webhook routes registered successfully");
} catch (error) {
  logger.error("Error registering webhook routes", { error });
}

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", { 
    error: err.message, 
    stack: err.stack,
    name: err.name,
    fullError: err,
    url: req.url,
    method: req.method
  });
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
