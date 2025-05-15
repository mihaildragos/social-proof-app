/**
 * Kafka Configuration
 * 
 * This file contains configuration settings for connecting to Kafka.
 * 
 * In production, these values should be set in environment variables.
 */

// Kafka connection configuration
export const KAFKA_CONFIG = {
  // Comma-separated list of Kafka broker addresses
  BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  
  // Client ID used to identify this application to the Kafka broker
  CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'shopify-app-producer',
  
  // Topic for Shopify order events
  ORDER_EVENTS_TOPIC: process.env.ORDER_EVENTS_TOPIC || 'shopify-order-events',
  
  // Default configuration for producers
  PRODUCER_CONFIG: {
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  },
  
  // Whether to enable Kafka in development mode
  ENABLE_IN_DEVELOPMENT: process.env.ENABLE_KAFKA_IN_DEV === 'true' || false,
}; 