import express from "express";
import { Logger } from "./utils/logger";
import { KafkaConsumer } from "./kafka/consumer";
import { RedisPublisher } from "./redis/publisher";
import { NotificationService } from "./services/notificationService";
import { config } from "./config";
import templatesRouter from "./routes/templates";

export class NotificationsApp {
  private logger: Logger;
  private kafkaConsumer: KafkaConsumer;
  private redisPublisher: RedisPublisher;
  private notificationService: NotificationService;
  private app: express.Application;
  private server: any;
  private isRunning: boolean = false;

  constructor() {
    // Initialize logger
    this.logger = new Logger({
      serviceName: "notifications-service",
      level: config.logLevel,
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
    });

    this.logger.info("Initializing Notifications Service", {
      environment: process.env.NODE_ENV || "development",
    });

    // Initialize Express app
    this.app = express();
    this.setupExpressApp();

    // Initialize services
    this.notificationService = new NotificationService(config.database, this.logger);

    this.redisPublisher = new RedisPublisher(config.redis, this.logger);

    this.kafkaConsumer = new KafkaConsumer(
      config.kafka.brokers,
      config.kafka.groupId,
      config.kafka.topics,
      this.notificationService,
      this.redisPublisher,
      this.logger
    );
  }

  /**
   * Setup Express application middleware and routes
   */
  private setupExpressApp(): void {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get("/health", (_req, res) => {
      res.json({ status: "healthy", service: "notifications" });
    });

    // API routes
    this.app.use("/api/templates", templatesRouter);

    // Error handling middleware
    this.app.use(
      (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        this.logger.error("Express error:", error);
        res.status(500).json({
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    );
  }

  /**
   * Start the application and all its services
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Application is already running");
      return;
    }

    try {
      // Start HTTP server
      this.logger.info("Starting HTTP server");
      this.server = this.app.listen(config.port, () => {
        this.logger.info(`HTTP server listening on port ${config.port}`);
      });

      // Start Kafka consumer
      this.logger.info("Starting Kafka consumer");
      await this.kafkaConsumer.start();

      this.isRunning = true;
      this.logger.info("Notifications Service started successfully");
    } catch (error) {
      this.logger.error("Failed to start application", error);
      await this.stop();
      throw error;
    }

    // Setup graceful shutdown
    process.on("SIGTERM", async () => {
      this.logger.info("SIGTERM signal received");
      await this.stop();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      this.logger.info("SIGINT signal received");
      await this.stop();
      process.exit(0);
    });

    process.on("uncaughtException", async (error) => {
      this.logger.error("Uncaught exception", error);
      await this.stop();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      this.logger.error("Unhandled rejection", { reason });
      await this.stop();
      process.exit(1);
    });
  }

  /**
   * Stop the application and all its services
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("Stopping Notifications Service");

    try {
      // Stop HTTP server
      if (this.server) {
        this.server.close();
        this.logger.info("HTTP server stopped");
      }

      // Stop Kafka consumer
      await this.kafkaConsumer.stop();

      // Disconnect Redis publisher
      await this.redisPublisher.disconnect();

      // Close database connections
      await this.notificationService.close();

      this.isRunning = false;
      this.logger.info("Notifications Service stopped successfully");
    } catch (error) {
      this.logger.error("Error stopping application", error);
      throw error;
    }
  }
}
