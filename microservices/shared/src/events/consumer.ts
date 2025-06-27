import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { getContextLogger } from "../../utils/logger";
import { Event } from "../events/schemas";
import { validateAndMigrateEvent } from "../events/versioning";

const logger = getContextLogger({ service: "kafka-consumer" });

/**
 * Configuration options for Kafka consumer
 */
export interface KafkaConsumerConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
  topic: string | string[];
  fromBeginning?: boolean;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxWaitTimeInMs?: number;
  minBytes?: number;
  maxBytes?: number;
  allowAutoTopicCreation?: boolean;
}

/**
 * Kafka consumer for receiving messages from Kafka topics
 */
export class KafkaConsumer {
  private consumer: Consumer;
  private isConnected: boolean = false;
  private messageHandler?: (message: any) => Promise<void>;
  private eventHandler?: (event: Event) => Promise<void>;
  private errorHandler?: (error: Error, message?: any) => Promise<void>;

  /**
   * Create a new Kafka consumer
   * @param config - Kafka consumer configuration
   */
  constructor(private config: KafkaConsumerConfig) {
    const kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
      connectionTimeout: 3000,
      requestTimeout: 30000,
    });

    this.consumer = kafka.consumer({
      groupId: this.config.groupId,
      sessionTimeout: this.config.sessionTimeout || 30000,
      heartbeatInterval: this.config.heartbeatInterval || 3000,
      maxWaitTimeInMs: this.config.maxWaitTimeInMs || 5000,
      minBytes: this.config.minBytes || 1,
      maxBytes: this.config.maxBytes || 10485760, // 10MB
      allowAutoTopicCreation: this.config.allowAutoTopicCreation || true,
    });
  }

  /**
   * Set the message handler function
   * @param handler - Function to handle incoming messages
   */
  setMessageHandler(handler: (message: any) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Set the event handler function for validated events
   * @param handler - Function to handle incoming events
   */
  setEventHandler(handler: (event: Event) => Promise<void>): void {
    this.eventHandler = handler;
  }

  /**
   * Set the error handler function
   * @param handler - Function to handle errors
   */
  setErrorHandler(handler: (error: Error, message?: any) => Promise<void>): void {
    this.errorHandler = handler;
  }

  /**
   * Connect to Kafka and subscribe to topic(s)
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.consumer.connect();

        // Handle both single topic and multiple topics
        const topics = Array.isArray(this.config.topic) ? this.config.topic : [this.config.topic];

        for (const topic of topics) {
          await this.consumer.subscribe({
            topic,
            fromBeginning: this.config.fromBeginning || false,
          });
        }

        this.isConnected = true;
        logger.info(`Connected to Kafka and subscribed to topics: ${topics.join(", ")}`);
      } catch (error: any) {
        logger.error("Failed to connect to Kafka:", error);
        throw error;
      }
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info("Disconnected from Kafka");
      } catch (error: any) {
        logger.error("Failed to disconnect from Kafka:", error);
        throw error;
      }
    }
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (!this.messageHandler && !this.eventHandler) {
      throw new Error(
        "No message or event handler set. Call setMessageHandler() or setEventHandler() before starting consumption"
      );
    }

    try {
      await this.connect();

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            await this.processMessage(payload);
          } catch (error: any) {
            logger.error("Error processing message:", error, {
              topic: payload.topic,
              partition: payload.partition,
              offset: payload.message.offset,
            });

            if (this.errorHandler) {
              try {
                await this.errorHandler(error, payload.message);
              } catch (handlerError: any) {
                logger.error("Error in error handler:", handlerError);
              }
            }
          }
        },
      });

      const topics = Array.isArray(this.config.topic) ? this.config.topic : [this.config.topic];
      logger.info(`Started consuming from topics: ${topics.join(", ")}`);
    } catch (error: any) {
      logger.error("Failed to start Kafka consumer:", error);
      throw error;
    }
  }

  /**
   * Process a Kafka message
   * @param payload - Kafka message payload with metadata
   */
  async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn("Received message with empty value", {
          topic,
          partition,
          offset: message.offset,
        });
        return;
      }

      const messageContent = JSON.parse(message.value.toString());

      // Extract key if present
      let key: string | undefined;
      if (message.key) {
        key = message.key.toString();
      }

      // Extract headers
      const headers: Record<string, string> = {};
      if (message.headers) {
        for (const [headerKey, headerValue] of Object.entries(message.headers)) {
          if (headerValue) {
            headers[headerKey] = headerValue.toString();
          }
        }
      }

      // Check if this is a structured event
      const isEvent = headers["event-type"] || messageContent.type;

      if (isEvent && this.eventHandler) {
        await this.processEvent(messageContent, {
          topic,
          partition,
          offset: message.offset?.toString() || "0",
          timestamp: message.timestamp || new Date().toISOString(),
          key,
          headers,
        });
      } else if (this.messageHandler) {
        // Add metadata to the message for legacy handler
        const enrichedMessage = {
          ...messageContent,
          _metadata: {
            topic,
            partition,
            offset: message.offset?.toString() || "0",
            timestamp: message.timestamp || new Date().toISOString(),
            key,
            headers,
          },
        };

        await this.messageHandler(enrichedMessage);
      } else {
        logger.warn("Received message but no appropriate handler is set", {
          topic,
          partition,
          offset: message.offset,
          isEvent,
        });
      }
    } catch (error: any) {
      logger.error("Error parsing or processing message:", error, {
        topic,
        partition,
        offset: message.offset,
      });
      throw error;
    }
  }

  /**
   * Process a structured event
   * @param eventData - Raw event data
   * @param metadata - Message metadata
   */
  async processEvent(
    eventData: any,
    metadata: {
      topic: string;
      partition: number;
      offset: string;
      timestamp: string;
      key?: string;
      headers: Record<string, string>;
    }
  ): Promise<void> {
    try {
      // Validate and potentially migrate the event
      const validation = validateAndMigrateEvent(eventData);

      if (!validation.valid) {
        logger.error("Received invalid event:", {
          errors: validation.errors,
          eventType: eventData.type,
          eventId: eventData.id,
          ...metadata,
        });

        if (this.errorHandler) {
          await this.errorHandler(
            new Error(`Invalid event: ${validation.errors?.join(", ")}`),
            eventData
          );
        }
        return;
      }

      const validatedEvent = validation.event!;

      // Add processing metadata
      const enrichedEvent = {
        ...validatedEvent,
        _processing: {
          ...metadata,
          migrated: validation.migrated,
          processedAt: new Date().toISOString(),
          consumerGroupId: this.config.groupId,
        },
      };

      logger.debug("Processing event:", {
        eventId: validatedEvent.id,
        eventType: validatedEvent.type,
        eventVersion: validatedEvent.version,
        migrated: validation.migrated,
        ...metadata,
      });

      await this.eventHandler!(enrichedEvent);

      logger.debug("Successfully processed event:", {
        eventId: validatedEvent.id,
        eventType: validatedEvent.type,
        ...metadata,
      });
    } catch (error: any) {
      logger.error("Error processing event:", error, {
        eventType: eventData.type,
        eventId: eventData.id,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Check if consumer is connected
   */
  isConsumerConnected(): boolean {
    return this.isConnected;
  }
}

export default KafkaConsumer;
