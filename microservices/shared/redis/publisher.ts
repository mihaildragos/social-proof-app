import Redis from "ioredis";
import { getContextLogger } from "../utils/logger";

const logger = getContextLogger({ service: "redis-publisher" });

/**
 * Redis publisher for sending messages to Redis channels
 */
export class RedisPublisher {
  private client: Redis;

  /**
   * Create a new Redis publisher
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
      logger.error("Redis publisher error:", err);
    });
  }

  /**
   * Publish a message to a Redis channel
   * @param channel - Channel name to publish to
   * @param message - Message to publish
   * @returns Number of clients that received the message
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      const result = await this.client.publish(channel, message);
      logger.info(`Published message to channel ${channel}, received by ${result} clients`);
      return result;
    } catch (error: any) {
      logger.error(`Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info("Redis publisher disconnected");
    } catch (error: any) {
      logger.error("Error disconnecting Redis publisher:", error);
      throw error;
    }
  }
}

export default RedisPublisher;
