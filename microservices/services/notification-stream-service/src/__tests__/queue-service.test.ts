import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("QueueService", () => {
  // Mock dependencies
  const mockRedis = {
    zadd: jest.fn(),
    zrange: jest.fn(),
    zrem: jest.fn(),
    zcount: jest.fn(),
    zrangebyscore: jest.fn(),
    zremrangebyscore: jest.fn(),
    expire: jest.fn(),
    multi: jest.fn(() => mockRedis),
    exec: jest.fn(),
    pipeline: jest.fn(() => mockRedis),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockMetrics = {
    increment: jest.fn(),
    decrement: jest.fn(),
    gauge: jest.fn(),
    histogram: jest.fn(),
  };

  // QueueService implementation
  class QueueService {
    private readonly QUEUE_PREFIX = "notification:queue:";
    private readonly PRIORITY_WEIGHTS = {
      urgent: 4,
      high: 3,
      normal: 2,
      low: 1,
    };

    constructor(
      private redis = mockRedis,
      private logger = mockLogger,
      private metrics = mockMetrics
    ) {}

    async enqueue(notification: {
      id: string;
      siteId: string;
      channel: string;
      priority: "urgent" | "high" | "normal" | "low";
      data: any;
      metadata?: any;
      scheduledFor?: Date;
      retryCount?: number;
      maxRetries?: number;
    }) {
      try {
        const { id, siteId, channel, priority = "normal", scheduledFor } = notification;

        if (!id) throw new Error("Notification ID is required");
        if (!siteId) throw new Error("Site ID is required");
        if (!channel) throw new Error("Channel is required");

        const queueKey = this.getQueueKey(channel);
        const score = this.calculateScore(priority, scheduledFor);
        
        const queueItem = {
          ...notification,
          enqueuedAt: new Date().toISOString(),
          retryCount: notification.retryCount || 0,
          maxRetries: notification.maxRetries || 3,
        };

        await this.redis.zadd(queueKey, score, JSON.stringify(queueItem));
        await this.redis.expire(queueKey, 86400); // 24 hours TTL

        // Update metrics
        this.metrics.increment("queue.enqueued", 1, {
          channel,
          priority,
          siteId,
        });

        this.metrics.gauge(`queue.size.${channel}`, await this.getQueueSize(channel));

        this.logger.debug("Notification enqueued", {
          notificationId: id,
          channel,
          priority,
          score,
        });

        return queueItem;
      } catch (error) {
        this.logger.error("Failed to enqueue notification", { error, notification });
        this.metrics.increment("queue.enqueue.errors");
        throw error;
      }
    }

    async dequeue(channel: string, count = 1): Promise<any[]> {
      try {
        const queueKey = this.getQueueKey(channel);
        const now = Date.now();

        // Get items that are ready to be processed
        const items = await this.redis.zrangebyscore(
          queueKey,
          "-inf",
          now,
          "LIMIT",
          0,
          count
        );

        if (items.length === 0) {
          return [];
        }

        // Remove items from queue atomically
        const pipeline = this.redis.pipeline();
        for (const item of items) {
          pipeline.zrem(queueKey, item);
        }
        await pipeline.exec();

        // Parse items
        const notifications = items.map((item: string) => {
          try {
            return JSON.parse(item);
          } catch (error) {
            this.logger.error("Failed to parse queue item", { error, item });
            return null;
          }
        }).filter(Boolean);

        // Update metrics
        this.metrics.increment("queue.dequeued", notifications.length, { channel });
        this.metrics.gauge(`queue.size.${channel}`, await this.getQueueSize(channel));

        return notifications;
      } catch (error) {
        this.logger.error("Failed to dequeue notifications", { error, channel });
        this.metrics.increment("queue.dequeue.errors");
        throw error;
      }
    }

    async requeue(notification: any, delay = 5000) {
      try {
        const updatedNotification = {
          ...notification,
          retryCount: (notification.retryCount || 0) + 1,
          lastRetryAt: new Date().toISOString(),
          scheduledFor: new Date(Date.now() + delay),
        };

        if (updatedNotification.retryCount > updatedNotification.maxRetries) {
          await this.moveToDeadLetter(updatedNotification);
          return null;
        }

        await this.enqueue(updatedNotification);

        this.metrics.increment("queue.requeued", 1, {
          channel: notification.channel,
          retryCount: updatedNotification.retryCount,
        });

        return updatedNotification;
      } catch (error) {
        this.logger.error("Failed to requeue notification", { error, notification });
        throw error;
      }
    }

    async moveToDeadLetter(notification: any) {
      try {
        const dlqKey = `${this.QUEUE_PREFIX}dlq:${notification.channel}`;
        const score = Date.now();

        await this.redis.zadd(dlqKey, score, JSON.stringify({
          ...notification,
          movedToDLQAt: new Date().toISOString(),
          reason: "max_retries_exceeded",
        }));

        await this.redis.expire(dlqKey, 604800); // 7 days TTL

        this.metrics.increment("queue.dead_letter", 1, {
          channel: notification.channel,
          siteId: notification.siteId,
        });

        this.logger.warn("Notification moved to dead letter queue", {
          notificationId: notification.id,
          channel: notification.channel,
          retryCount: notification.retryCount,
        });
      } catch (error) {
        this.logger.error("Failed to move to dead letter queue", { error, notification });
        throw error;
      }
    }

    async getQueueSize(channel: string): Promise<number> {
      try {
        const queueKey = this.getQueueKey(channel);
        return await this.redis.zcount(queueKey, "-inf", "+inf");
      } catch (error) {
        this.logger.error("Failed to get queue size", { error, channel });
        return 0;
      }
    }

    async getQueueStats(channel?: string): Promise<any> {
      try {
        if (channel) {
          const queueKey = this.getQueueKey(channel);
          const dlqKey = `${this.QUEUE_PREFIX}dlq:${channel}`;
          const now = Date.now();

          const [total, ready, scheduled, dlq] = await Promise.all([
            this.redis.zcount(queueKey, "-inf", "+inf"),
            this.redis.zcount(queueKey, "-inf", now),
            this.redis.zcount(queueKey, now, "+inf"),
            this.redis.zcount(dlqKey, "-inf", "+inf"),
          ]);

          return {
            channel,
            total,
            ready,
            scheduled,
            deadLetter: dlq,
          };
        } else {
          // Get stats for all channels
          // In a real implementation, you'd scan for all queue keys
          return {
            message: "Global stats not implemented in test",
          };
        }
      } catch (error) {
        this.logger.error("Failed to get queue stats", { error, channel });
        throw error;
      }
    }

    async peek(channel: string, count = 10): Promise<any[]> {
      try {
        const queueKey = this.getQueueKey(channel);
        const items = await this.redis.zrange(queueKey, 0, count - 1);

        return items.map((item: string) => {
          try {
            return JSON.parse(item);
          } catch (error) {
            this.logger.error("Failed to parse queue item", { error, item });
            return null;
          }
        }).filter(Boolean);
      } catch (error) {
        this.logger.error("Failed to peek queue", { error, channel });
        throw error;
      }
    }

    async remove(channel: string, notificationId: string): Promise<boolean> {
      try {
        const queueKey = this.getQueueKey(channel);
        const items = await this.redis.zrange(queueKey, 0, -1);

        for (const item of items) {
          try {
            const notification = JSON.parse(item);
            if (notification.id === notificationId) {
              await this.redis.zrem(queueKey, item);
              this.metrics.increment("queue.removed", 1, { channel });
              return true;
            }
          } catch (error) {
            continue;
          }
        }

        return false;
      } catch (error) {
        this.logger.error("Failed to remove from queue", { error, channel, notificationId });
        throw error;
      }
    }

    async clear(channel: string): Promise<number> {
      try {
        const queueKey = this.getQueueKey(channel);
        const count = await this.redis.zcount(queueKey, "-inf", "+inf");
        await this.redis.zremrangebyscore(queueKey, "-inf", "+inf");

        this.metrics.increment("queue.cleared", count, { channel });
        this.logger.info("Queue cleared", { channel, count });

        return count;
      } catch (error) {
        this.logger.error("Failed to clear queue", { error, channel });
        throw error;
      }
    }

    async processExpired(channel: string): Promise<number> {
      try {
        const queueKey = this.getQueueKey(channel);
        const expiredBefore = Date.now() - 3600000; // 1 hour ago

        // Get expired items
        const items = await this.redis.zrangebyscore(
          queueKey,
          "-inf",
          expiredBefore
        );

        if (items.length === 0) {
          return 0;
        }

        // Move to dead letter queue
        for (const item of items) {
          try {
            const notification = JSON.parse(item);
            await this.moveToDeadLetter({
              ...notification,
              reason: "expired",
            });
          } catch (error) {
            this.logger.error("Failed to process expired item", { error, item });
          }
        }

        // Remove from main queue
        await this.redis.zremrangebyscore(queueKey, "-inf", expiredBefore);

        this.metrics.increment("queue.expired", items.length, { channel });
        return items.length;
      } catch (error) {
        this.logger.error("Failed to process expired items", { error, channel });
        throw error;
      }
    }

    private getQueueKey(channel: string): string {
      return `${this.QUEUE_PREFIX}${channel}`;
    }

    private calculateScore(priority: string, scheduledFor?: Date): number {
      const now = Date.now();
      const scheduledTime = scheduledFor ? scheduledFor.getTime() : now;
      const priorityWeight = this.PRIORITY_WEIGHTS[priority as keyof typeof this.PRIORITY_WEIGHTS] || 2;
      
      // Lower score = higher priority
      // Urgent items get negative scores to ensure they're processed first
      if (priority === "urgent") {
        return scheduledTime - 1000000;
      }
      
      return scheduledTime / priorityWeight;
    }
  }

  let queueService: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queueService = new QueueService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("enqueue", () => {
    const validNotification = {
      id: "notif-123",
      siteId: "site-123",
      channel: "web",
      priority: "normal" as const,
      data: { message: "Test notification" },
    };

    it("should enqueue notification successfully", async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zcount.mockResolvedValue(5);

      const result = await queueService.enqueue(validNotification);

      expect(result).toMatchObject({
        ...validNotification,
        enqueuedAt: expect.any(String),
        retryCount: 0,
        maxRetries: 3,
      });

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "notification:queue:web",
        expect.any(Number),
        expect.any(String)
      );

      expect(mockRedis.expire).toHaveBeenCalledWith("notification:queue:web", 86400);
      expect(mockMetrics.increment).toHaveBeenCalledWith("queue.enqueued", 1, {
        channel: "web",
        priority: "normal",
        siteId: "site-123",
      });
    });

    it("should handle urgent priority", async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zcount.mockResolvedValue(1);

      const urgentNotification = { ...validNotification, priority: "urgent" as const };
      await queueService.enqueue(urgentNotification);

      // Check that urgent items get a lower score (higher priority)
      const scoreArg = mockRedis.zadd.mock.calls[0][1];
      expect(scoreArg).toBeLessThan(Date.now());
    });

    it("should handle scheduled notifications", async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zcount.mockResolvedValue(1);

      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const scheduledNotification = {
        ...validNotification,
        scheduledFor: futureDate,
      };

      await queueService.enqueue(scheduledNotification);

      const scoreArg = mockRedis.zadd.mock.calls[0][1];
      expect(scoreArg).toBeGreaterThan(Date.now());
    });

    it("should throw error for missing ID", async () => {
      const invalidNotification = { ...validNotification, id: "" };

      await expect(queueService.enqueue(invalidNotification)).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for missing site ID", async () => {
      const invalidNotification = { ...validNotification, siteId: "" };

      await expect(queueService.enqueue(invalidNotification)).rejects.toThrow(
        "Site ID is required"
      );
    });

    it("should throw error for missing channel", async () => {
      const invalidNotification = { ...validNotification, channel: "" };

      await expect(queueService.enqueue(invalidNotification)).rejects.toThrow(
        "Channel is required"
      );
    });
  });

  describe("dequeue", () => {
    it("should dequeue notifications successfully", async () => {
      const queuedItems = [
        JSON.stringify({ id: "1", data: "notification 1" }),
        JSON.stringify({ id: "2", data: "notification 2" }),
      ];

      mockRedis.zrangebyscore.mockResolvedValue(queuedItems);
      mockRedis.pipeline.mockReturnValue(mockRedis);
      mockRedis.exec.mockResolvedValue([]);
      mockRedis.zcount.mockResolvedValue(0);

      const result = await queueService.dequeue("web", 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "1", data: "notification 1" });
      expect(result[1]).toEqual({ id: "2", data: "notification 2" });

      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
        "notification:queue:web",
        "-inf",
        expect.any(Number),
        "LIMIT",
        0,
        2
      );

      expect(mockRedis.zrem).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when queue is empty", async () => {
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const result = await queueService.dequeue("web");

      expect(result).toEqual([]);
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it("should handle parse errors gracefully", async () => {
      const queuedItems = [
        JSON.stringify({ id: "1", data: "valid" }),
        "invalid json",
        JSON.stringify({ id: "3", data: "valid" }),
      ];

      mockRedis.zrangebyscore.mockResolvedValue(queuedItems);
      mockRedis.pipeline.mockReturnValue(mockRedis);
      mockRedis.exec.mockResolvedValue([]);
      mockRedis.zcount.mockResolvedValue(0);

      const result = await queueService.dequeue("web", 3);

      expect(result).toHaveLength(2); // Only valid items
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("3");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to parse queue item",
        expect.any(Object)
      );
    });
  });

  describe("requeue", () => {
    it("should requeue notification with incremented retry count", async () => {
      const notification = {
        id: "notif-123",
        siteId: "site-123",
        channel: "web",
        priority: "normal",
        data: { message: "Test" },
        retryCount: 1,
        maxRetries: 3,
      };

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zcount.mockResolvedValue(1);

      const result = await queueService.requeue(notification, 10000);

      expect(result).toMatchObject({
        ...notification,
        retryCount: 2,
        lastRetryAt: expect.any(String),
        scheduledFor: expect.any(Date),
      });

      expect(mockMetrics.increment).toHaveBeenCalledWith("queue.requeued", 1, {
        channel: "web",
        retryCount: 2,
      });
    });

    it("should move to dead letter queue when max retries exceeded", async () => {
      const notification = {
        id: "notif-123",
        siteId: "site-123",
        channel: "web",
        priority: "normal",
        data: { message: "Test" },
        retryCount: 3,
        maxRetries: 3,
      };

      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await queueService.requeue(notification);

      expect(result).toBeNull();
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "notification:queue:dlq:web",
        expect.any(Number),
        expect.stringContaining("max_retries_exceeded")
      );
    });
  });

  describe("getQueueStats", () => {
    it("should return stats for specific channel", async () => {
      mockRedis.zcount
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // ready
        .mockResolvedValueOnce(3)  // scheduled
        .mockResolvedValueOnce(2); // dead letter

      const stats = await queueService.getQueueStats("web");

      expect(stats).toEqual({
        channel: "web",
        total: 10,
        ready: 7,
        scheduled: 3,
        deadLetter: 2,
      });
    });
  });

  describe("peek", () => {
    it("should return notifications without removing them", async () => {
      const queuedItems = [
        JSON.stringify({ id: "1", data: "notification 1" }),
        JSON.stringify({ id: "2", data: "notification 2" }),
      ];

      mockRedis.zrange.mockResolvedValue(queuedItems);

      const result = await queueService.peek("web", 2);

      expect(result).toHaveLength(2);
      expect(mockRedis.zrange).toHaveBeenCalledWith("notification:queue:web", 0, 1);
      expect(mockRedis.zrem).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove specific notification from queue", async () => {
      const queuedItems = [
        JSON.stringify({ id: "1", data: "notification 1" }),
        JSON.stringify({ id: "2", data: "notification 2" }),
        JSON.stringify({ id: "3", data: "notification 3" }),
      ];

      mockRedis.zrange.mockResolvedValue(queuedItems);
      mockRedis.zrem.mockResolvedValue(1);

      const result = await queueService.remove("web", "2");

      expect(result).toBe(true);
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        "notification:queue:web",
        queuedItems[1]
      );
    });

    it("should return false if notification not found", async () => {
      mockRedis.zrange.mockResolvedValue([]);

      const result = await queueService.remove("web", "non-existent");

      expect(result).toBe(false);
      expect(mockRedis.zrem).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear entire queue", async () => {
      mockRedis.zcount.mockResolvedValue(5);
      mockRedis.zremrangebyscore.mockResolvedValue(5);

      const result = await queueService.clear("web");

      expect(result).toBe(5);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        "notification:queue:web",
        "-inf",
        "+inf"
      );
      expect(mockMetrics.increment).toHaveBeenCalledWith("queue.cleared", 5, {
        channel: "web",
      });
    });
  });

  describe("processExpired", () => {
    it("should move expired items to dead letter queue", async () => {
      const expiredItems = [
        JSON.stringify({ id: "1", data: "expired 1" }),
        JSON.stringify({ id: "2", data: "expired 2" }),
      ];

      mockRedis.zrangebyscore.mockResolvedValue(expiredItems);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.zremrangebyscore.mockResolvedValue(2);

      const result = await queueService.processExpired("web");

      expect(result).toBe(2);
      expect(mockRedis.zadd).toHaveBeenCalledTimes(2); // Once for each expired item
      expect(mockMetrics.increment).toHaveBeenCalledWith("queue.expired", 2, {
        channel: "web",
      });
    });
  });
});