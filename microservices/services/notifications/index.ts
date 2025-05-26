import { getContextLogger, KafkaConsumer, RedisPublisher } from "@social-proof/shared";
import { OrderEventHandler } from "./handlers/order-event-handler";
import { NotificationService } from "./services/notification-service";

const logger = getContextLogger({ service: "notifications-service" });

// Create dependencies
const redisPublisher = new RedisPublisher(process.env.REDIS_URL);
const notificationService = new NotificationService();

// Create order event handler
const orderEventHandler = new OrderEventHandler(redisPublisher, notificationService);

// Create Kafka consumer
const consumer = new KafkaConsumer({
  clientId: process.env.KAFKA_CLIENT_ID || "notifications-service",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
  groupId: process.env.KAFKA_GROUP_ID || "notifications-group",
  topic: "order-events",
});

// Attach message handler
consumer.setMessageHandler(orderEventHandler.handleMessage.bind(orderEventHandler));

// Start consumer
async function startService() {
  try {
    logger.info("Starting notifications service...");
    await consumer.start();
    logger.info("Notifications service started successfully");
  } catch (error) {
    logger.error("Failed to start notifications service:", error);
    process.exit(1);
  }
}

// Start the service
startService();

// Handle shutdown signals
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down gracefully");
  await consumer.disconnect();
  await redisPublisher.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Shutting down gracefully");
  await consumer.disconnect();
  await redisPublisher.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled promise rejection:", reason);
  process.exit(1);
});
