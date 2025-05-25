import Redis from "ioredis";
import { getContextLogger } from "../utils/logger";

const logger = getContextLogger({ service: "redis-subscriber" });

/**
 * Redis subscriber class for handling pub/sub operations
 */
export class RedisSubscriber {
  private client: Redis;
  private subscribers: Map<string, Function[]> = new Map();

  /**
   * Create a new Redis subscriber
   * @param redisUrl - Redis connection URL
   */
  constructor(redisUrl?: string) {
    // Use provided URL or default
    const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";

    // Create Redis client
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Set up error handler
    this.client.on("error", (err) => {
      logger.error("Redis subscriber error:", err);
    });

    // Set up message handler
    this.client.on("message", (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Subscribe to a Redis channel
   * @param channel - Channel name to subscribe to
   * @param callback - Function to call when a message is received
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      // Get existing subscribers for this channel or create new array
      const callbacks = this.subscribers.get(channel) || [];

      // Add the new callback
      callbacks.push(callback);

      // Store updated callbacks
      this.subscribers.set(channel, callbacks);

      // If this is the first subscriber for this channel, subscribe at Redis level
      if (callbacks.length === 1) {
        await this.client.subscribe(channel);
        logger.info(`Subscribed to channel: ${channel}`);
      }
    } catch (error: any) {
      logger.error(`Error subscribing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a Redis channel
   * @param channel - Channel name to unsubscribe from
   * @param callback - Optional specific callback to remove (if omitted, all callbacks are removed)
   */
  async unsubscribe(channel: string, callback?: Function): Promise<void> {
    try {
      const callbacks = this.subscribers.get(channel);

      if (!callbacks || callbacks.length === 0) {
        return;
      }

      if (callback) {
        // Remove specific callback
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }

        // Update subscribers map
        this.subscribers.set(channel, callbacks);
      } else {
        // Remove all callbacks
        this.subscribers.delete(channel);
      }

      // If no more callbacks for this channel, unsubscribe at Redis level
      if (!this.subscribers.has(channel) || this.subscribers.get(channel)!.length === 0) {
        await this.client.unsubscribe(channel);
        logger.info(`Unsubscribed from channel: ${channel}`);
      }
    } catch (error: any) {
      logger.error(`Error unsubscribing from channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from Redis
   * @param channel - Channel the message was received on
   * @param message - Message content
   */
  private handleMessage(channel: string, message: string): void {
    const callbacks = this.subscribers.get(channel);

    if (callbacks && callbacks.length > 0) {
      // Call all subscribers for this channel
      callbacks.forEach((callback) => {
        try {
          callback(message);
        } catch (error: any) {
          logger.error(`Error in subscriber callback for channel ${channel}:`, error);
        }
      });
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info("Redis subscriber disconnected");
    } catch (error: any) {
      logger.error("Error disconnecting Redis subscriber:", error);
      throw error;
    }
  }
}

export default RedisSubscriber;
