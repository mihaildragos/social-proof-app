import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("DeliveryService", () => {
  // Mock dependencies
  const mockDatabase = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  const mockRedis = {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockMetrics = {
    increment: jest.fn(),
    gauge: jest.fn(),
    histogram: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  // DeliveryService implementation
  class DeliveryService {
    private readonly CACHE_PREFIX = "delivery:";
    private readonly CACHE_TTL = 3600; // 1 hour

    constructor(
      private db = mockDatabase,
      private redis = mockRedis,
      private logger = mockLogger,
      private metrics = mockMetrics,
      private eventPublisher = mockEventPublisher
    ) {}

    async recordDelivery(delivery: {
      notificationId: string;
      connectionId: string;
      channel: string;
      status: "sent" | "delivered" | "read" | "clicked" | "failed";
      metadata?: any;
      error?: string;
    }) {
      try {
        const { notificationId, connectionId, channel, status, metadata, error } = delivery;

        if (!notificationId) throw new Error("Notification ID is required");
        if (!connectionId) throw new Error("Connection ID is required");
        if (!channel) throw new Error("Channel is required");
        if (!status) throw new Error("Status is required");

        const deliveryRecord = {
          id: this.generateId(),
          notificationId,
          connectionId,
          channel,
          status,
          metadata: metadata || {},
          error: error || null,
          timestamp: new Date(),
          ip: metadata?.ip || null,
          userAgent: metadata?.userAgent || null,
          location: metadata?.location || null,
        };

        // Save to database
        await this.db.query(
          `INSERT INTO notification_deliveries 
           (id, notification_id, connection_id, channel, status, metadata, error, 
            timestamp, ip, user_agent, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            deliveryRecord.id,
            deliveryRecord.notificationId,
            deliveryRecord.connectionId,
            deliveryRecord.channel,
            deliveryRecord.status,
            JSON.stringify(deliveryRecord.metadata),
            deliveryRecord.error,
            deliveryRecord.timestamp,
            deliveryRecord.ip,
            deliveryRecord.userAgent,
            deliveryRecord.location,
          ]
        );

        // Cache delivery status
        await this.cacheDeliveryStatus(notificationId, connectionId, status);

        // Update metrics
        this.metrics.increment(`delivery.${status}`, 1, { channel });

        // Publish event
        await this.eventPublisher.publish(`notification.${status}`, {
          notificationId,
          connectionId,
          channel,
          timestamp: deliveryRecord.timestamp,
        });

        this.logger.debug("Delivery recorded", {
          notificationId,
          connectionId,
          status,
        });

        return deliveryRecord;
      } catch (error) {
        this.logger.error("Failed to record delivery", { error, delivery });
        this.metrics.increment("delivery.record.errors");
        throw error;
      }
    }

    async updateDeliveryStatus(
      notificationId: string,
      connectionId: string,
      newStatus: "delivered" | "read" | "clicked" | "failed",
      metadata?: any
    ) {
      try {
        const existingDelivery = await this.getDelivery(notificationId, connectionId);
        if (!existingDelivery) {
          throw new Error("Delivery record not found");
        }

        // Validate status transition
        if (!this.isValidStatusTransition(existingDelivery.status, newStatus)) {
          throw new Error(
            `Invalid status transition from ${existingDelivery.status} to ${newStatus}`
          );
        }

        // Update delivery record
        await this.db.query(
          `UPDATE notification_deliveries 
           SET status = $1, updated_at = $2, metadata = metadata || $3
           WHERE notification_id = $4 AND connection_id = $5`,
          [
            newStatus,
            new Date(),
            JSON.stringify(metadata || {}),
            notificationId,
            connectionId,
          ]
        );

        // Update cache
        await this.cacheDeliveryStatus(notificationId, connectionId, newStatus);

        // Update metrics
        this.metrics.increment(`delivery.status_update.${newStatus}`, 1);

        // Publish event
        await this.eventPublisher.publish(`notification.${newStatus}`, {
          notificationId,
          connectionId,
          previousStatus: existingDelivery.status,
          newStatus,
          timestamp: new Date(),
        });

        return {
          ...existingDelivery,
          status: newStatus,
          updatedAt: new Date(),
        };
      } catch (error) {
        this.logger.error("Failed to update delivery status", {
          error,
          notificationId,
          connectionId,
          newStatus,
        });
        throw error;
      }
    }

    async getDelivery(notificationId: string, connectionId: string) {
      try {
        // Check cache first
        const cached = await this.getCachedDelivery(notificationId, connectionId);
        if (cached) return cached;

        // Query database
        const result = await this.db.query(
          `SELECT * FROM notification_deliveries 
           WHERE notification_id = $1 AND connection_id = $2`,
          [notificationId, connectionId]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const delivery = this.mapDeliveryRow(result.rows[0]);
        
        // Cache for future requests
        await this.cacheDelivery(delivery);

        return delivery;
      } catch (error) {
        this.logger.error("Failed to get delivery", {
          error,
          notificationId,
          connectionId,
        });
        throw error;
      }
    }

    async getDeliveryStats(notificationId: string) {
      try {
        const result = await this.db.query(
          `SELECT 
             status,
             channel,
             COUNT(*) as count,
             MIN(timestamp) as first_delivered,
             MAX(timestamp) as last_delivered
           FROM notification_deliveries
           WHERE notification_id = $1
           GROUP BY status, channel`,
          [notificationId]
        );

        const stats = {
          notificationId,
          total: 0,
          byStatus: {} as Record<string, number>,
          byChannel: {} as Record<string, any>,
          timeline: [] as any[],
        };

        for (const row of result.rows) {
          const count = parseInt(row.count);
          stats.total += count;
          
          // By status
          stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + count;
          
          // By channel
          if (!stats.byChannel[row.channel]) {
            stats.byChannel[row.channel] = {
              total: 0,
              byStatus: {},
            };
          }
          stats.byChannel[row.channel].total += count;
          stats.byChannel[row.channel].byStatus[row.status] = count;
          
          // Timeline
          stats.timeline.push({
            status: row.status,
            channel: row.channel,
            count,
            firstDelivered: row.first_delivered,
            lastDelivered: row.last_delivered,
          });
        }

        // Calculate conversion rates
        stats.conversionRate = this.calculateConversionRate(stats.byStatus);

        return stats;
      } catch (error) {
        this.logger.error("Failed to get delivery stats", { error, notificationId });
        throw error;
      }
    }

    async getChannelDeliveryRate(channel: string, timeWindow = 3600000) {
      try {
        const startTime = new Date(Date.now() - timeWindow);
        
        const result = await this.db.query(
          `SELECT 
             status,
             COUNT(*) as count
           FROM notification_deliveries
           WHERE channel = $1 AND timestamp >= $2
           GROUP BY status`,
          [channel, startTime]
        );

        let sent = 0;
        let delivered = 0;
        let failed = 0;

        for (const row of result.rows) {
          const count = parseInt(row.count);
          if (row.status === "sent") sent += count;
          else if (row.status === "delivered") delivered += count;
          else if (row.status === "failed") failed += count;
        }

        const total = sent + delivered + failed;
        const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

        return {
          channel,
          timeWindow,
          total,
          sent,
          delivered,
          failed,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
        };
      } catch (error) {
        this.logger.error("Failed to get channel delivery rate", { error, channel });
        throw error;
      }
    }

    async trackInteraction(interaction: {
      notificationId: string;
      connectionId: string;
      type: "click" | "dismiss" | "hover";
      metadata?: any;
    }) {
      try {
        const { notificationId, connectionId, type, metadata } = interaction;

        // Record interaction
        await this.db.query(
          `INSERT INTO notification_interactions 
           (id, notification_id, connection_id, type, metadata, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            this.generateId(),
            notificationId,
            connectionId,
            type,
            JSON.stringify(metadata || {}),
            new Date(),
          ]
        );

        // Update delivery status if click
        if (type === "click") {
          await this.updateDeliveryStatus(notificationId, connectionId, "clicked", metadata);
        }

        // Update metrics
        this.metrics.increment(`delivery.interaction.${type}`, 1);

        // Publish event
        await this.eventPublisher.publish("notification.interaction", {
          notificationId,
          connectionId,
          type,
          timestamp: new Date(),
        });

        return { success: true };
      } catch (error) {
        this.logger.error("Failed to track interaction", { error, interaction });
        throw error;
      }
    }

    async batchRecordDeliveries(deliveries: any[]) {
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as any[],
      };

      try {
        await this.db.transaction(async (client: any) => {
          for (const delivery of deliveries) {
            try {
              await this.recordDelivery(delivery);
              results.successful++;
            } catch (error) {
              results.failed++;
              results.errors.push({
                delivery,
                error: (error as Error).message,
              });
            }
          }
        });

        this.metrics.increment("delivery.batch.successful", results.successful);
        this.metrics.increment("delivery.batch.failed", results.failed);

        return results;
      } catch (error) {
        this.logger.error("Failed to batch record deliveries", { error });
        throw error;
      }
    }

    async cleanupOldDeliveries(olderThan: Date) {
      try {
        const result = await this.db.query(
          `DELETE FROM notification_deliveries 
           WHERE timestamp < $1
           RETURNING id`,
          [olderThan]
        );

        const deletedCount = result.rows.length;

        if (deletedCount > 0) {
          this.logger.info("Cleaned up old deliveries", {
            count: deletedCount,
            olderThan,
          });
          this.metrics.increment("delivery.cleanup", deletedCount);
        }

        return deletedCount;
      } catch (error) {
        this.logger.error("Failed to cleanup old deliveries", { error });
        throw error;
      }
    }

    private async cacheDeliveryStatus(
      notificationId: string,
      connectionId: string,
      status: string
    ) {
      const key = `${this.CACHE_PREFIX}status:${notificationId}:${connectionId}`;
      await this.redis.setex(key, this.CACHE_TTL, status);
    }

    private async cacheDelivery(delivery: any) {
      const key = `${this.CACHE_PREFIX}delivery:${delivery.notificationId}:${delivery.connectionId}`;
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(delivery));
    }

    private async getCachedDelivery(notificationId: string, connectionId: string) {
      const key = `${this.CACHE_PREFIX}delivery:${notificationId}:${connectionId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    }

    private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
      const validTransitions: Record<string, string[]> = {
        sent: ["delivered", "failed"],
        delivered: ["read", "clicked", "failed"],
        read: ["clicked"],
        clicked: [],
        failed: [],
      };

      return validTransitions[currentStatus]?.includes(newStatus) || false;
    }

    private calculateConversionRate(byStatus: Record<string, number>) {
      const sent = byStatus.sent || 0;
      const delivered = byStatus.delivered || 0;
      const read = byStatus.read || 0;
      const clicked = byStatus.clicked || 0;

      return {
        deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
        openRate: delivered > 0 ? (read / delivered) * 100 : 0,
        clickRate: read > 0 ? (clicked / read) * 100 : 0,
      };
    }

    private mapDeliveryRow(row: any) {
      return {
        id: row.id,
        notificationId: row.notification_id,
        connectionId: row.connection_id,
        channel: row.channel,
        status: row.status,
        metadata: row.metadata,
        error: row.error,
        timestamp: row.timestamp,
        ip: row.ip,
        userAgent: row.user_agent,
        location: row.location,
        updatedAt: row.updated_at,
      };
    }

    private generateId(): string {
      return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  let deliveryService: DeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    deliveryService = new DeliveryService();
    
    // Default mock implementations
    mockDatabase.query.mockResolvedValue({ rows: [] });
    mockDatabase.transaction.mockImplementation(async (callback) => {
      await callback(mockDatabase);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("recordDelivery", () => {
    const validDelivery = {
      notificationId: "notif-123",
      connectionId: "conn-123",
      channel: "web",
      status: "sent" as const,
      metadata: {
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        location: "US",
      },
    };

    it("should record delivery successfully", async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await deliveryService.recordDelivery(validDelivery);

      expect(result).toMatchObject({
        id: expect.any(String),
        notificationId: validDelivery.notificationId,
        connectionId: validDelivery.connectionId,
        channel: validDelivery.channel,
        status: validDelivery.status,
        metadata: validDelivery.metadata,
        timestamp: expect.any(Date),
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO notification_deliveries"),
        expect.arrayContaining([
          expect.any(String), // id
          validDelivery.notificationId,
          validDelivery.connectionId,
          validDelivery.channel,
          validDelivery.status,
        ])
      );

      expect(mockMetrics.increment).toHaveBeenCalledWith("delivery.sent", 1, {
        channel: "web",
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith("notification.sent", {
        notificationId: validDelivery.notificationId,
        connectionId: validDelivery.connectionId,
        channel: validDelivery.channel,
        timestamp: expect.any(Date),
      });
    });

    it("should handle delivery with error", async () => {
      const deliveryWithError = {
        ...validDelivery,
        status: "failed" as const,
        error: "Connection timeout",
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await deliveryService.recordDelivery(deliveryWithError);

      expect(result.error).toBe("Connection timeout");
      expect(mockMetrics.increment).toHaveBeenCalledWith("delivery.failed", 1, {
        channel: "web",
      });
    });

    it("should throw error for missing notification ID", async () => {
      const invalidDelivery = { ...validDelivery, notificationId: "" };

      await expect(deliveryService.recordDelivery(invalidDelivery)).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for missing connection ID", async () => {
      const invalidDelivery = { ...validDelivery, connectionId: "" };

      await expect(deliveryService.recordDelivery(invalidDelivery)).rejects.toThrow(
        "Connection ID is required"
      );
    });

    it("should throw error for missing channel", async () => {
      const invalidDelivery = { ...validDelivery, channel: "" };

      await expect(deliveryService.recordDelivery(invalidDelivery)).rejects.toThrow(
        "Channel is required"
      );
    });

    it("should throw error for missing status", async () => {
      const invalidDelivery = { ...validDelivery, status: "" as any };

      await expect(deliveryService.recordDelivery(invalidDelivery)).rejects.toThrow(
        "Status is required"
      );
    });
  });

  describe("updateDeliveryStatus", () => {
    it("should update delivery status successfully", async () => {
      // Mock existing delivery
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            id: "delivery-123",
            notification_id: "notif-123",
            connection_id: "conn-123",
            channel: "web",
            status: "sent",
            metadata: {},
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Update query

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await deliveryService.updateDeliveryStatus(
        "notif-123",
        "conn-123",
        "delivered",
        { deliveredAt: new Date() }
      );

      expect(result.status).toBe("delivered");
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE notification_deliveries"),
        expect.arrayContaining(["delivered", expect.any(Date)])
      );
    });

    it("should throw error for invalid status transition", async () => {
      // Mock existing delivery with "clicked" status
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: "delivery-123",
          notification_id: "notif-123",
          connection_id: "conn-123",
          status: "clicked",
        }],
      });

      mockRedis.get.mockResolvedValue(null);

      await expect(
        deliveryService.updateDeliveryStatus("notif-123", "conn-123", "sent")
      ).rejects.toThrow("Invalid status transition from clicked to sent");
    });

    it("should throw error if delivery not found", async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      mockRedis.get.mockResolvedValue(null);

      await expect(
        deliveryService.updateDeliveryStatus("notif-123", "conn-123", "delivered")
      ).rejects.toThrow("Delivery record not found");
    });
  });

  describe("getDeliveryStats", () => {
    it("should return comprehensive delivery statistics", async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [
          { status: "sent", channel: "web", count: "10", first_delivered: new Date(), last_delivered: new Date() },
          { status: "delivered", channel: "web", count: "8", first_delivered: new Date(), last_delivered: new Date() },
          { status: "read", channel: "web", count: "5", first_delivered: new Date(), last_delivered: new Date() },
          { status: "clicked", channel: "web", count: "2", first_delivered: new Date(), last_delivered: new Date() },
          { status: "sent", channel: "email", count: "5", first_delivered: new Date(), last_delivered: new Date() },
          { status: "delivered", channel: "email", count: "4", first_delivered: new Date(), last_delivered: new Date() },
        ],
      });

      const stats = await deliveryService.getDeliveryStats("notif-123");

      expect(stats.notificationId).toBe("notif-123");
      expect(stats.total).toBe(34);
      expect(stats.byStatus).toEqual({
        sent: 15,
        delivered: 12,
        read: 5,
        clicked: 2,
      });
      expect(stats.byChannel.web.total).toBe(25);
      expect(stats.byChannel.email.total).toBe(9);
      expect(stats.conversionRate.deliveryRate).toBe(80); // 12/15 * 100
      expect(stats.timeline).toHaveLength(6);
    });
  });

  describe("getChannelDeliveryRate", () => {
    it("should calculate channel delivery rate", async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [
          { status: "sent", count: "100" },
          { status: "delivered", count: "85" },
          { status: "failed", count: "15" },
        ],
      });

      const result = await deliveryService.getChannelDeliveryRate("web", 3600000);

      expect(result).toEqual({
        channel: "web",
        timeWindow: 3600000,
        total: 200,
        sent: 100,
        delivered: 85,
        failed: 15,
        deliveryRate: 42.5, // 85/200 * 100
      });
    });

    it("should handle no deliveries", async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await deliveryService.getChannelDeliveryRate("web");

      expect(result.deliveryRate).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("trackInteraction", () => {
    it("should track click interaction and update delivery status", async () => {
      const interaction = {
        notificationId: "notif-123",
        connectionId: "conn-123",
        type: "click" as const,
        metadata: { link: "https://example.com" },
      };

      // Mock for updateDeliveryStatus
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // Insert interaction
        .mockResolvedValueOnce({
          rows: [{
            id: "delivery-123",
            notification_id: "notif-123",
            connection_id: "conn-123",
            status: "read",
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Update delivery

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await deliveryService.trackInteraction(interaction);

      expect(result.success).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO notification_interactions"),
        expect.any(Array)
      );
      expect(mockMetrics.increment).toHaveBeenCalledWith("delivery.interaction.click", 1);
    });

    it("should track dismiss interaction without updating delivery status", async () => {
      const interaction = {
        notificationId: "notif-123",
        connectionId: "conn-123",
        type: "dismiss" as const,
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await deliveryService.trackInteraction(interaction);

      expect(result.success).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledTimes(1); // Only insert, no update
    });
  });

  describe("batchRecordDeliveries", () => {
    it("should batch record multiple deliveries", async () => {
      const deliveries = [
        {
          notificationId: "notif-1",
          connectionId: "conn-1",
          channel: "web",
          status: "sent",
        },
        {
          notificationId: "notif-2",
          connectionId: "conn-2",
          channel: "email",
          status: "sent",
        },
        {
          notificationId: "", // Invalid
          connectionId: "conn-3",
          channel: "push",
          status: "sent",
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      const results = await deliveryService.batchRecordDeliveries(deliveries);

      expect(results.successful).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].error).toBe("Notification ID is required");
    });
  });

  describe("cleanupOldDeliveries", () => {
    it("should delete old delivery records", async () => {
      const deletedIds = [
        { id: "delivery-1" },
        { id: "delivery-2" },
        { id: "delivery-3" },
      ];

      mockDatabase.query.mockResolvedValue({ rows: deletedIds });

      const olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const result = await deliveryService.cleanupOldDeliveries(olderThan);

      expect(result).toBe(3);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM notification_deliveries"),
        [olderThan]
      );
      expect(mockLogger.info).toHaveBeenCalledWith("Cleaned up old deliveries", {
        count: 3,
        olderThan,
      });
      expect(mockMetrics.increment).toHaveBeenCalledWith("delivery.cleanup", 3);
    });
  });

  describe("caching", () => {
    it("should cache delivery status", async () => {
      const delivery = {
        notificationId: "notif-123",
        connectionId: "conn-123",
        channel: "web",
        status: "sent" as const,
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValue(true);

      await deliveryService.recordDelivery(delivery);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "delivery:status:notif-123:conn-123",
        3600,
        "sent"
      );
    });

    it("should use cached delivery when available", async () => {
      const cachedDelivery = {
        id: "delivery-123",
        notificationId: "notif-123",
        connectionId: "conn-123",
        status: "delivered",
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedDelivery));

      const result = await deliveryService.getDelivery("notif-123", "conn-123");

      expect(result).toEqual(cachedDelivery);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });
  });
});