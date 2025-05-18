import { Kafka, CompressionTypes } from "kafkajs";
import { logger } from "../../../shared/src/utils/logger";
/**
 * KafkaProducer class for handling Kafka integration
 * Used to publish events to different Kafka topics
 */
export class KafkaProducer {
  producer;
  isConnected = false;
  static instance;
  constructor() {
    const brokers = process.env.KAFKA_BROKERS?.split(",") || ["kafka:9092"];
    const kafka = new Kafka({
      clientId: "integrations-service",
      brokers,
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
   * Get singleton instance of KafkaProducer
   */
  static getInstance() {
    if (!KafkaProducer.instance) {
      KafkaProducer.instance = new KafkaProducer();
    }
    return KafkaProducer.instance;
  }
  /**
   * Connect to Kafka broker
   */
  async connect() {
    if (!this.isConnected) {
      try {
        await this.producer.connect();
        this.isConnected = true;
        logger.info("Connected to Kafka broker");
      } catch (error) {
        logger.error("Failed to connect to Kafka broker", { error });
        throw error;
      }
    }
  }
  /**
   * Disconnect from Kafka broker
   */
  async disconnect() {
    if (this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info("Disconnected from Kafka broker");
      } catch (error) {
        logger.error("Failed to disconnect from Kafka broker", { error });
        throw error;
      }
    }
  }
  /**
   * Send a message to a specific topic
   * @param topic Kafka topic
   * @param message Message to send
   * @param key Optional message key
   */
  async sendMessage(topic, message, key) {
    if (!this.isConnected) {
      await this.connect();
    }
    const record = {
      topic,
      messages: [
        {
          key: key ? key : undefined,
          value: JSON.stringify(message),
          headers: {
            "content-type": "application/json",
            source: "integrations-service",
            timestamp: Date.now().toString(),
          },
        },
      ],
      compression: CompressionTypes.GZIP,
    };
    try {
      await this.producer.send(record);
      logger.info(`Message sent to topic ${topic}`, {
        topic,
        key: key || "undefined",
      });
    } catch (error) {
      logger.error(`Failed to send message to topic ${topic}`, { error, topic });
      throw error;
    }
  }
  /**
   * Send a batch of messages to a specific topic
   * @param topic Kafka topic
   * @param messages Array of messages to send
   * @param keyField Optional field name to use as key from each message
   */
  async sendBatch(topic, messages, keyField) {
    if (!this.isConnected) {
      await this.connect();
    }
    const kafkaMessages = messages.map((message) => ({
      key: keyField && message[keyField] ? message[keyField].toString() : undefined,
      value: JSON.stringify(message),
      headers: {
        "content-type": "application/json",
        source: "integrations-service",
        timestamp: Date.now().toString(),
      },
    }));
    const record = {
      topic,
      messages: kafkaMessages,
      compression: CompressionTypes.GZIP,
    };
    try {
      await this.producer.send(record);
      logger.info(`Batch of ${messages.length} messages sent to topic ${topic}`, { topic });
    } catch (error) {
      logger.error(`Failed to send batch to topic ${topic}`, { error, topic });
      throw error;
    }
  }
}
// Export a singleton instance
export const kafkaProducer = KafkaProducer.getInstance();
//# sourceMappingURL=kafka.js.map
