import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { Logger } from "../utils/logger";
import { OrderEventHandler } from "../handlers/orderEventHandler";
import { NotificationService } from "../services/notificationService";
import { RedisPublisher } from "../redis/publisher";

export class KafkaConsumer {
  private consumer: Consumer;
  private isRunning: boolean = false;
  private orderEventHandler: OrderEventHandler;
  private logger: Logger;

  constructor(
    private readonly brokers: string[],
    private readonly groupId: string,
    private readonly topics: string[],
    notificationService: NotificationService,
    redisPublisher: RedisPublisher,
    logger: Logger
  ) {
    this.logger = logger;
    const kafka = new Kafka({
      clientId: "notifications-service",
      brokers: this.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 10,
        maxRetryTime: 30000,
      },
    });

    this.consumer = kafka.consumer({ groupId: this.groupId });
    this.orderEventHandler = new OrderEventHandler(notificationService, redisPublisher, logger);
  }

  public async start(): Promise<void> {
    try {
      await this.consumer.connect();

      // Subscribe to topics
      for (const topic of this.topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }

      // Start consuming messages
      await this.consumer.run({
        partitionsConsumedConcurrently: 3,
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload);
        },
      });

      this.isRunning = true;
      this.logger.info("Kafka consumer started successfully");
    } catch (error) {
      this.logger.error("Failed to start Kafka consumer", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.isRunning) {
        await this.consumer.disconnect();
        this.isRunning = false;
        this.logger.info("Kafka consumer stopped successfully");
      }
    } catch (error) {
      this.logger.error("Error shutting down Kafka consumer", error);
      throw error;
    }
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const key = message.key?.toString();
    const value = message.value?.toString();

    if (!value) {
      this.logger.warn("Received empty message", { topic, partition });
      return;
    }

    try {
      const event = JSON.parse(value);

      this.logger.info("Processing message", {
        topic,
        partition,
        key,
        eventType: event.type,
      });

      // Route to the appropriate handler based on event type
      switch (event.type) {
        case "order.created":
        case "order.paid":
        case "order.fulfilled":
          await this.orderEventHandler.handle(event);
          break;
        default:
          this.logger.warn("Unhandled event type", { eventType: event.type });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error("Error processing message", {
        topic,
        partition,
        key,
        error: errorMessage,
      });

      // Implement dead letter queue or retry logic here
      // For critical errors, we might want to stop processing
      if (error instanceof Error && this.isFatalError(error)) {
        await this.stop();
        throw error;
      }
    }
  }

  private isFatalError(error: Error): boolean {
    // Define conditions for errors that should cause the consumer to stop
    // For example, connection errors or critical system errors
    return (
      error.message.includes("Authentication failed") || error.message.includes("Connection error")
    );
  }
}
