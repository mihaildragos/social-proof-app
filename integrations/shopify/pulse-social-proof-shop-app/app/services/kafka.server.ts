import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { KAFKA_CONFIG } from "../../kafka.config";

// Create Kafka client instance
const kafka = new Kafka({
  clientId: KAFKA_CONFIG.CLIENT_ID,
  brokers: KAFKA_CONFIG.BROKERS,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
});

// Create a producer instance
let producer: Producer | null = null;

/**
 * Initialize the Kafka producer
 */
export const initializeKafkaProducer = async () => {
  // Skip initialization in development unless explicitly enabled
  if (process.env.NODE_ENV !== "production" && !KAFKA_CONFIG.ENABLE_IN_DEVELOPMENT) {
    console.log("Kafka producer initialization skipped in development mode");
    return null;
  }

  if (!producer) {
    try {
      producer = kafka.producer(KAFKA_CONFIG.PRODUCER_CONFIG);
      await producer.connect();
      console.log("Kafka producer connected successfully");
    } catch (error) {
      console.error("Failed to connect Kafka producer:", error);
      producer = null;
    }
  }
  return producer;
};

/**
 * Disconnect the Kafka producer
 */
export const disconnectKafkaProducer = async () => {
  if (producer) {
    try {
      await producer.disconnect();
      console.log("Kafka producer disconnected");
    } catch (error) {
      console.error("Error disconnecting Kafka producer:", error);
    } finally {
      producer = null;
    }
  }
};

/**
 * Send a message to the Kafka topic
 */
export const sendOrderEvent = async (shop: string, orderId: string, orderData: any) => {
  // In development mode without Kafka enabled, just log the event
  if (process.env.NODE_ENV !== "production" && !KAFKA_CONFIG.ENABLE_IN_DEVELOPMENT) {
    console.log("DEVELOPMENT MODE: Would send to Kafka:", {
      topic: KAFKA_CONFIG.ORDER_EVENTS_TOPIC,
      key: `${shop}-${orderId}`,
      value: {
        source: "shopify",
        event_type: "order.created",
        shop,
        timestamp: new Date().toISOString(),
        data: orderData,
      },
    });
    return true;
  }

  try {
    if (!producer) {
      await initializeKafkaProducer();
    }

    // If producer still null after initialization, something failed
    if (!producer) {
      throw new Error("Kafka producer not available");
    }

    const message: ProducerRecord = {
      topic: KAFKA_CONFIG.ORDER_EVENTS_TOPIC,
      messages: [
        {
          key: `${shop}-${orderId}`,
          value: JSON.stringify({
            source: "shopify",
            event_type: "order.created",
            shop,
            timestamp: new Date().toISOString(),
            data: orderData,
          }),
        },
      ],
    };

    await producer.send(message);
    console.log(`Order event for ${orderId} from ${shop} sent to Kafka`);
    return true;
  } catch (error) {
    console.error("Error sending order event to Kafka:", error);
    throw error;
  }
};
