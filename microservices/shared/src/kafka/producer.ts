import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { getContextLogger } from "../utils/logger";

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
          },
        ],
      };

      const result = await this.producer.send(record);
      logger.info(`Produced message to topic ${topic}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to produce message to topic ${topic}:`, error);
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
