import { Kafka, Consumer, KafkaMessage, EachMessagePayload } from 'kafkajs';
import { getContextLogger } from '../utils/logger';

const logger = getContextLogger({ service: 'kafka-consumer' });

/**
 * Configuration options for Kafka consumer
 */
export interface KafkaConsumerConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
  topic: string;
}

/**
 * Kafka consumer for receiving messages from Kafka topics
 */
export class KafkaConsumer {
  private consumer: Consumer;
  private isConnected: boolean = false;
  private messageHandler?: (message: any) => Promise<void>;

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
        retries: 8
      }
    });

    this.consumer = kafka.consumer({
      groupId: this.config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
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
   * Connect to Kafka and subscribe to topic
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.consumer.connect();
        await this.consumer.subscribe({
          topic: this.config.topic,
          fromBeginning: false
        });
        
        this.isConnected = true;
        logger.info(`Connected to Kafka and subscribed to topic ${this.config.topic}`);
      } catch (error: any) {
        logger.error('Failed to connect to Kafka:', error);
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
        logger.info('Disconnected from Kafka');
      } catch (error: any) {
        logger.error('Failed to disconnect from Kafka:', error);
        throw error;
      }
    }
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (!this.messageHandler) {
      throw new Error('No message handler set. Call setMessageHandler() before starting consumption');
    }

    try {
      await this.connect();

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            await this.processMessage(payload.message);
          } catch (error: any) {
            logger.error('Error processing message:', error);
          }
        }
      });

      logger.info(`Started consuming from topic ${this.config.topic}`);
    } catch (error: any) {
      logger.error('Failed to start Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Process a Kafka message
   * @param message - Kafka message to process
   */
  async processMessage(message: KafkaMessage): Promise<void> {
    if (!this.messageHandler) {
      logger.warn('Received message but no handler is set');
      return;
    }

    try {
      if (!message.value) {
        logger.warn('Received message with empty value');
        return;
      }

      const messageContent = JSON.parse(message.value.toString());
      
      // Extract key if present
      let key: string | undefined;
      if (message.key) {
        key = message.key.toString();
      }

      // Add metadata to the message
      const enrichedMessage = {
        ...messageContent,
        _metadata: {
          topic: this.config.topic,
          partition: 0, // In a real implementation, this would come from the message
          offset: 0,    // In a real implementation, this would come from the message
          timestamp: new Date().toISOString(),
          key
        }
      };

      // Process the message
      await this.messageHandler(enrichedMessage);
    } catch (error: any) {
      logger.error('Error parsing or processing message:', error);
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