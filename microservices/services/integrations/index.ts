import { createServer } from "./server";

// Get port from environment variable or use default
const PORT = process.env.INTEGRATIONS_SERVICE_PORT || process.env.PORT || 3001;

// Create and start the server
const app = createServer();

// Start the server
app.listen(PORT, () => {
  console.log(`Integrations service listening on port ${PORT}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

// Handle termination signals
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully");
  process.exit(0);
});
