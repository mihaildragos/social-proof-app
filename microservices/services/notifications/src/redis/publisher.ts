import Redis from "ioredis";
import { Logger } from "../utils/logger";
import { PublishableNotification } from "../types/events";

export class RedisPublisher {
  private redisClient: Redis;

  constructor(
    redisOptions: { host: string; port: number; password?: string },
    private readonly logger: Logger
  ) {
    this.redisClient = new Redis({
      host: redisOptions.host,
      port: redisOptions.port,
      password: redisOptions.password,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redisClient.on("error", (error: Error) => {
      this.logger.error("Redis connection error", error);
    });

    this.redisClient.on("connect", () => {
      this.logger.info("Connected to Redis server");
    });
  }

  public async publishNotification(notification: PublishableNotification): Promise<void> {
    try {
      const { siteId } = notification;

      // Create channel names based on multi-tenant structure
      // This allows clients to subscribe to notifications for specific sites
      const siteChannel = `notifications:site:${siteId}`;

      // Serialize notification object to JSON
      const serializedNotification = JSON.stringify(notification);

      // Publish to site-specific channel
      await this.redisClient.publish(siteChannel, serializedNotification);

      // Also publish to a global channel for monitoring/debugging
      await this.redisClient.publish("notifications:all", serializedNotification);

      // Store the notification in Redis for delivery tracking and potential replay
      const notificationKey = `notification:${notification.id}`;
      await this.redisClient.set(notificationKey, serializedNotification);
      await this.redisClient.expire(notificationKey, 86400); // 24 hour TTL

      // Track delivery status
      await this.redisClient.hset(`notification:status:${notification.id}`, {
        status: "published",
        published_at: new Date().toISOString(),
        delivered_count: 0,
        clicked_count: 0,
      });
      await this.redisClient.expire(`notification:status:${notification.id}`, 604800); // 7 day TTL

      this.logger.info("Notification published to Redis", {
        notificationId: notification.id,
        siteId: notification.siteId,
      });
    } catch (error) {
      this.logger.error("Failed to publish notification to Redis", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async trackDelivery(notificationId: string): Promise<void> {
    try {
      // Increment delivery counter
      await this.redisClient.hincrby(`notification:status:${notificationId}`, "delivered_count", 1);

      // Set delivery timestamp if this is the first delivery
      const deliveredCount = await this.redisClient.hget(
        `notification:status:${notificationId}`,
        "delivered_count"
      );
      if (deliveredCount === "1") {
        await this.redisClient.hset(
          `notification:status:${notificationId}`,
          "first_delivered_at",
          new Date().toISOString()
        );
      }

      this.logger.info("Notification delivery tracked", { notificationId });
    } catch (error) {
      this.logger.error("Failed to track notification delivery", {
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async trackClick(notificationId: string): Promise<void> {
    try {
      // Increment click counter
      await this.redisClient.hincrby(`notification:status:${notificationId}`, "clicked_count", 1);

      // Set first click timestamp if this is the first click
      const clickedCount = await this.redisClient.hget(
        `notification:status:${notificationId}`,
        "clicked_count"
      );
      if (clickedCount === "1") {
        await this.redisClient.hset(
          `notification:status:${notificationId}`,
          "first_clicked_at",
          new Date().toISOString()
        );
      }

      this.logger.info("Notification click tracked", { notificationId });
    } catch (error) {
      this.logger.error("Failed to track notification click", {
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.redisClient.quit();
      this.logger.info("Redis publisher disconnected");
    } catch (error) {
      this.logger.error("Error disconnecting from Redis", error);
      throw error;
    }
  }
}
