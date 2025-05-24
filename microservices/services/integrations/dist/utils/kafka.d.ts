/**
 * KafkaProducer class for handling Kafka integration
 * Used to publish events to different Kafka topics
 */
export declare class KafkaProducer {
  private producer;
  private isConnected;
  private static instance;
  private constructor();
  /**
   * Get singleton instance of KafkaProducer
   */
  static getInstance(): KafkaProducer;
  /**
   * Connect to Kafka broker
   */
  connect(): Promise<void>;
  /**
   * Disconnect from Kafka broker
   */
  disconnect(): Promise<void>;
  /**
   * Send a message to a specific topic
   * @param topic Kafka topic
   * @param message Message to send
   * @param key Optional message key
   */
  sendMessage(topic: string, message: any, key?: string): Promise<void>;
  /**
   * Send a batch of messages to a specific topic
   * @param topic Kafka topic
   * @param messages Array of messages to send
   * @param keyField Optional field name to use as key from each message
   */
  sendBatch(topic: string, messages: any[], keyField?: string): Promise<void>;
}
export declare const kafkaProducer: KafkaProducer;
