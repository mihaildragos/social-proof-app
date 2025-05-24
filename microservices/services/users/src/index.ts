import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { router } from "./routes";
import { requestLogger } from "./middleware/requestLogger";
import { setupTelemetry } from "./utils/tracing";
import { securityHeaders, rateLimit, sanitizeInputs } from "./middleware/securityMiddleware";

// Load environment variables
dotenv.config();

// Initialize telemetry if enabled
if (process.env.TELEMETRY_ENABLED === "true") {
  setupTelemetry("users-service");
}

// Create Express application
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Sets security headers
app.use(securityHeaders); // Add additional security headers
app.use(
  cors({
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") || ["https://app.socialproofapp.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
    maxAge: 86400, // 24 hours
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser()); // Parse cookies
app.use(requestLogger);
app.use(rateLimit); // Apply rate limiting
app.use(sanitizeInputs); // Sanitize input data

// CSRF protection
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const origin = req.get("origin");
    const referer = req.get("referer");

    // Skip CSRF check for SCIM API (uses token-based auth)
    if (req.path.startsWith("/scim/")) {
      return next();
    }

    if (!origin && !referer) {
      return res.status(403).json({
        status: "error",
        message: "CSRF protection: origin or referer header is required",
      });
    }
  }
  next();
});

// Health check endpoints
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", (req, res) => {
  // Here you would check database connections, etc.
  res.status(200).json({ status: "ready" });
});

// Mount API routes
app.use("/", router);

// Error handler (must be last)
app.use(errorHandler);

// Start the server
app.listen(port, () => {
  logger.info(`Users service running on port ${port}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

export default app;
