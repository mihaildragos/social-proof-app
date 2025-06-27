import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { getContextLogger } from "../../utils/logger";
import { Event, getTopicForEventType } from "../events/schemas";
import { validateAndMigrateEvent, createVersionedEvent } from "../events/versioning";

const logger = getContextLogger({ service: "kafka-producer" });

/**
 * Kafka producer for sending messages to Kafka topics
 */
export class KafkaProducer {
  private producer: Producer;
  private isConnected: boolean = false;

  /**
   * Create a new Kafka producer
   * @param clientId - Kafka client ID
   * @param brokers - List of Kafka brokers
   */
  constructor(
    private clientId: string = "social-proof-producer",
    private brokers: string[] = (process.env.KAFKA_BROKERS || "kafka:9092").split(",")
  ) {
    const kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.producer.connect();
        this.isConnected = true;
        logger.info("Connected to Kafka");
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
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info("Disconnected from Kafka");
      } catch (error: any) {
        logger.error("Failed to disconnect from Kafka:", error);
        throw error;
      }
    }
  }

  /**
   * Produce a message to a Kafka topic
   * @param topic - Kafka topic to send to
   * @param message - Message to send (will be JSON stringified)
   * @param key - Optional message key
   * @returns Promise with message result
   */
  async produce(topic: string, message: any, key?: string): Promise<any> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const record: ProducerRecord = {
        topic,
        messages: [
          {
            key: key ? Buffer.from(key) : null,
            value: Buffer.from(JSON.stringify(message)),
            headers: {
              "content-type": "application/json",
              "producer-id": this.clientId,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      };

      const result = await this.producer.send(record);
      logger.info(`Produced message to topic ${topic}`, {
        messageId: message.id,
        eventType: message.type,
        organizationId: message.organizationId,
      });
      return result;
    } catch (error: any) {
      logger.error(`Failed to produce message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Produce a validated event to the appropriate Kafka topic
   * @param event - Event to send (must conform to event schema)
   * @param options - Additional options
   * @returns Promise with message result
   */
  async produceEvent(
    event: Event,
    options?: {
      key?: string;
      partition?: number;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    try {
      // Validate and potentially migrate the event
      const validation = validateAndMigrateEvent(event);
      if (!validation.valid) {
        throw new Error(`Invalid event: ${validation.errors?.join(", ")}`);
      }

      const validatedEvent = validation.event!;
      const topic = getTopicForEventType(validatedEvent.type);
      const key = options?.key || validatedEvent.organizationId || validatedEvent.id;

      if (!this.isConnected) {
        await this.connect();
      }

      const record: ProducerRecord = {
        topic,
        messages: [
          {
            key: Buffer.from(key),
            value: Buffer.from(JSON.stringify(validatedEvent)),
            partition: options?.partition,
            headers: {
              "content-type": "application/json",
              "event-type": validatedEvent.type,
              "event-version": validatedEvent.version,
              "producer-id": this.clientId,
              timestamp: validatedEvent.timestamp,
              "organization-id": validatedEvent.organizationId || "",
              "site-id": validatedEvent.siteId || "",
              "correlation-id": validatedEvent.correlationId || "",
              migrated: validation.migrated ? "true" : "false",
              ...options?.headers,
            },
          },
        ],
      };

      const result = await this.producer.send(record);
      logger.info(`Produced event to topic ${topic}`, {
        eventId: validatedEvent.id,
        eventType: validatedEvent.type,
        eventVersion: validatedEvent.version,
        organizationId: validatedEvent.organizationId,
        siteId: validatedEvent.siteId,
        migrated: validation.migrated,
      });
      return result;
    } catch (error: any) {
      logger.error(`Failed to produce event:`, error, {
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Create and produce a new event
   * @param eventType - Type of event to create
   * @param data - Event data
   * @param options - Event and producer options
   * @returns Promise with message result
   */
  async createAndProduceEvent(
    eventType: string,
    data: any,
    options?: {
      version?: string;
      source?: string;
      organizationId?: string;
      siteId?: string;
      userId?: string;
      sessionId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
      key?: string;
      partition?: number;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    const event = createVersionedEvent(eventType, data, {
      version: options?.version,
      source: options?.source,
      organizationId: options?.organizationId,
      siteId: options?.siteId,
      userId: options?.userId,
      sessionId: options?.sessionId,
      correlationId: options?.correlationId,
      metadata: options?.metadata,
    });

    return this.produceEvent(event, {
      key: options?.key,
      partition: options?.partition,
      headers: options?.headers,
    });
  }

  /**
   * Produce multiple events in a batch
   * @param events - Array of events to send
   * @param options - Batch options
   * @returns Promise with batch result
   */
  async produceBatch(
    events: Event[],
    options?: {
      topicOverride?: string;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Group events by topic
      const eventsByTopic = new Map<string, Event[]>();

      for (const event of events) {
        const validation = validateAndMigrateEvent(event);
        if (!validation.valid) {
          logger.warn(`Skipping invalid event in batch: ${validation.errors?.join(", ")}`, {
            eventId: event.id,
            eventType: event.type,
          });
          continue;
        }

        const validatedEvent = validation.event!;
        const topic = options?.topicOverride || getTopicForEventType(validatedEvent.type);

        if (!eventsByTopic.has(topic)) {
          eventsByTopic.set(topic, []);
        }
        eventsByTopic.get(topic)!.push(validatedEvent);
      }

      // Send batches for each topic
      const results = [];
      for (const [topic, topicEvents] of eventsByTopic) {
        const messages = topicEvents.map((event) => ({
          key: Buffer.from(event.organizationId || event.id),
          value: Buffer.from(JSON.stringify(event)),
          headers: {
            "content-type": "application/json",
            "event-type": event.type,
            "event-version": event.version,
            "producer-id": this.clientId,
            timestamp: event.timestamp,
            "organization-id": event.organizationId || "",
            "site-id": event.siteId || "",
            "correlation-id": event.correlationId || "",
            batch: "true",
            ...options?.headers,
          },
        }));

        const record: ProducerRecord = {
          topic,
          messages,
        };

        const result = await this.producer.send(record);
        results.push(result);

        logger.info(`Produced batch to topic ${topic}`, {
          eventCount: topicEvents.length,
          topic,
        });
      }

      return results;
    } catch (error: any) {
      logger.error(`Failed to produce batch:`, error);
      throw error;
    }
  }

  /**
   * Check if producer is connected
   */
  isProducerConnected(): boolean {
    return this.isConnected;
  }
}

export default KafkaProducer;
