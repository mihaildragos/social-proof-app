import { Pool } from "pg";
import { EventEmitter } from "events";

interface UsageEvent {
  id: string;
  userId: string;
  eventType: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, string>;
  properties?: Record<string, any>;
  createdAt: Date;
}

interface UsageQuota {
  eventType: string;
  limit: number;
  period: string;
  currentUsage: number;
  remainingUsage: number;
  resetDate: Date;
  isExceeded: boolean;
}

interface UsageAnalytics {
  period: string;
  totalEvents: number;
  uniqueEventTypes: number;
  topEventTypes: Array<{
    eventType: string;
    count: number;
    percentage: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    count: number;
  }>;
  averagePerDay: number;
  peakUsageDay: string;
  peakUsageCount: number;
}

export class UsageService extends EventEmitter {
  private db: Pool;

  constructor() {
    super();
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  // Record usage events
  async recordUsage(data: {
    userId: string;
    eventType: string;
    quantity: number;
    timestamp: Date;
    metadata?: Record<string, string>;
    properties?: Record<string, any>;
  }): Promise<UsageEvent> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Check if usage limit is exceeded
      const limitCheck = await this.checkUsageLimit(data.userId, data.eventType, data.quantity);
      if (!limitCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitCheck.message}`);
      }

      // Record usage event
      const result = await client.query(
        `INSERT INTO usage_events (
          user_id, event_type, quantity, timestamp, metadata, properties, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [
          data.userId,
          data.eventType,
          data.quantity,
          data.timestamp,
          JSON.stringify(data.metadata || {}),
          JSON.stringify(data.properties || {}),
        ]
      );

      // Update usage aggregates
      await this.updateUsageAggregates(
        client,
        data.userId,
        data.eventType,
        data.quantity,
        data.timestamp
      );

      await client.query("COMMIT");

      const usageEvent = this.mapUsageEvent(result.rows[0]);

      // Emit event
      this.emit("usage.recorded", {
        usageEvent,
        userId: data.userId,
        eventType: data.eventType,
        quantity: data.quantity,
      });

      return usageEvent;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordBatchUsage(
    userId: string,
    events: Array<{
      eventType: string;
      quantity: number;
      timestamp: Date;
      metadata?: Record<string, string>;
      properties?: Record<string, any>;
    }>
  ): Promise<UsageEvent[]> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      const usageEvents: UsageEvent[] = [];

      for (const event of events) {
        // Check usage limits for each event
        const limitCheck = await this.checkUsageLimit(userId, event.eventType, event.quantity);
        if (!limitCheck.allowed) {
          throw new Error(`Usage limit exceeded for ${event.eventType}: ${limitCheck.message}`);
        }

        // Record usage event
        const result = await client.query(
          `INSERT INTO usage_events (
            user_id, event_type, quantity, timestamp, metadata, properties, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING *`,
          [
            userId,
            event.eventType,
            event.quantity,
            event.timestamp,
            JSON.stringify(event.metadata || {}),
            JSON.stringify(event.properties || {}),
          ]
        );

        // Update usage aggregates
        await this.updateUsageAggregates(
          client,
          userId,
          event.eventType,
          event.quantity,
          event.timestamp
        );

        usageEvents.push(this.mapUsageEvent(result.rows[0]));
      }

      await client.query("COMMIT");

      // Emit event
      this.emit("usage.batch_recorded", {
        usageEvents,
        userId,
        totalEvents: events.length,
      });

      return usageEvents;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUsage(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      eventType?: string;
      granularity?: "hour" | "day" | "week" | "month";
    } = {}
  ): Promise<any> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      eventType,
      granularity = "day",
    } = options;

    let query = `
      SELECT 
        event_type,
        DATE_TRUNC($1, timestamp) as period,
        SUM(quantity) as total_quantity,
        COUNT(*) as event_count
      FROM usage_events 
      WHERE user_id = $2 AND timestamp >= $3 AND timestamp <= $4
    `;
    const params: any[] = [granularity, userId, startDate, endDate];

    if (eventType) {
      query += " AND event_type = $5";
      params.push(eventType);
    }

    query += " GROUP BY event_type, period ORDER BY period DESC, event_type";

    const result = await this.db.query(query, params);

    // Group by event type
    const usageByEventType: Record<string, any[]> = {};
    let totalQuantity = 0;
    let totalEvents = 0;

    result.rows.forEach((row) => {
      if (!usageByEventType[row.event_type]) {
        usageByEventType[row.event_type] = [];
      }
      usageByEventType[row.event_type].push({
        period: row.period,
        quantity: parseInt(row.total_quantity),
        eventCount: parseInt(row.event_count),
      });
      totalQuantity += parseInt(row.total_quantity);
      totalEvents += parseInt(row.event_count);
    });

    return {
      period: {
        startDate,
        endDate,
        granularity,
      },
      summary: {
        totalQuantity,
        totalEvents,
        uniqueEventTypes: Object.keys(usageByEventType).length,
      },
      usageByEventType,
    };
  }

  async getCurrentPeriodUsage(userId: string): Promise<any> {
    // Get current billing period (assuming monthly)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usage = await this.getUsage(userId, {
      startDate: startOfMonth,
      endDate: endOfMonth,
    });

    // Get user quotas
    const quotas = await this.getUserQuotas(userId);

    // Calculate percentage used for each quota
    const quotaUsage = quotas.map((quota) => {
      const eventUsage = usage.usageByEventType[quota.eventType] || [];
      const currentUsage = eventUsage.reduce(
        (sum: number, period: any) => sum + period.quantity,
        0
      );
      const percentageUsed = quota.limit > 0 ? (currentUsage / quota.limit) * 100 : 0;

      return {
        eventType: quota.eventType,
        currentUsage,
        limit: quota.limit,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        remainingUsage: Math.max(0, quota.limit - currentUsage),
        isExceeded: currentUsage > quota.limit,
      };
    });

    return {
      period: {
        start: startOfMonth,
        end: endOfMonth,
      },
      usage: usage.summary,
      limits: quotaUsage,
      percentageUsed:
        quotaUsage.length > 0 ?
          quotaUsage.reduce((sum, q) => sum + q.percentageUsed, 0) / quotaUsage.length
        : 0,
      resetDate: endOfMonth,
    };
  }

  async getUsageByEventType(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<
    Array<{ eventType: string; quantity: number; eventCount: number; percentage: number }>
  > {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 10,
    } = options;

    const result = await this.db.query(
      `SELECT 
        event_type,
        SUM(quantity) as total_quantity,
        COUNT(*) as event_count
       FROM usage_events 
       WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY event_type 
       ORDER BY total_quantity DESC 
       LIMIT $4`,
      [userId, startDate, endDate, limit]
    );

    const totalQuantity = result.rows.reduce((sum, row) => sum + parseInt(row.total_quantity), 0);

    return result.rows.map((row) => ({
      eventType: row.event_type,
      quantity: parseInt(row.total_quantity),
      eventCount: parseInt(row.event_count),
      percentage:
        totalQuantity > 0 ?
          Math.round((parseInt(row.total_quantity) / totalQuantity) * 10000) / 100
        : 0,
    }));
  }

  async getUserQuotas(userId: string): Promise<UsageQuota[]> {
    const result = await this.db.query(
      `SELECT uq.*, 
        COALESCE(ua.current_usage, 0) as current_usage,
        GREATEST(0, uq.limit - COALESCE(ua.current_usage, 0)) as remaining_usage,
        CASE WHEN COALESCE(ua.current_usage, 0) > uq.limit THEN true ELSE false END as is_exceeded
       FROM usage_quotas uq
       LEFT JOIN usage_aggregates ua ON uq.user_id = ua.user_id 
         AND uq.event_type = ua.event_type 
         AND ua.period_start <= NOW() 
         AND ua.period_end > NOW()
       WHERE uq.user_id = $1 AND uq.active = true`,
      [userId]
    );

    return result.rows.map((row) => ({
      eventType: row.event_type,
      limit: row.limit,
      period: row.period,
      currentUsage: parseInt(row.current_usage),
      remainingUsage: parseInt(row.remaining_usage),
      resetDate: row.reset_date,
      isExceeded: row.is_exceeded,
    }));
  }

  async checkUsageLimit(
    userId: string,
    eventType: string,
    quantity: number = 1
  ): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    remainingUsage: number;
    resetDate?: Date;
    message?: string;
  }> {
    const result = await this.db.query(
      `SELECT uq.limit, uq.period, uq.reset_date,
        COALESCE(ua.current_usage, 0) as current_usage
       FROM usage_quotas uq
       LEFT JOIN usage_aggregates ua ON uq.user_id = ua.user_id 
         AND uq.event_type = ua.event_type 
         AND ua.period_start <= NOW() 
         AND ua.period_end > NOW()
       WHERE uq.user_id = $1 AND uq.event_type = $2 AND uq.active = true`,
      [userId, eventType]
    );

    if (result.rows.length === 0) {
      // No quota defined, allow unlimited usage
      return {
        allowed: true,
        currentUsage: 0,
        limit: -1,
        remainingUsage: -1,
        message: "No quota defined",
      };
    }

    const quota = result.rows[0];
    const currentUsage = parseInt(quota.current_usage);
    const limit = quota.limit;
    const newUsage = currentUsage + quantity;

    if (newUsage > limit) {
      return {
        allowed: false,
        currentUsage,
        limit,
        remainingUsage: Math.max(0, limit - currentUsage),
        resetDate: quota.reset_date,
        message: `Usage limit exceeded. Current: ${currentUsage}, Limit: ${limit}, Requested: ${quantity}`,
      };
    }

    return {
      allowed: true,
      currentUsage,
      limit,
      remainingUsage: limit - newUsage,
      resetDate: quota.reset_date,
      message: "Usage allowed",
    };
  }

  async getUsageAnalytics(
    userId: string,
    options: {
      period?: string;
      eventType?: string;
    } = {}
  ): Promise<UsageAnalytics> {
    const { period = "month", eventType } = options;

    // Calculate date range based on period
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let query = `
      SELECT 
        event_type,
        DATE(timestamp) as date,
        SUM(quantity) as daily_quantity,
        COUNT(*) as daily_count
      FROM usage_events 
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
    `;
    const params: any[] = [userId, startDate, endDate];

    if (eventType) {
      query += " AND event_type = $4";
      params.push(eventType);
    }

    query += " GROUP BY event_type, DATE(timestamp) ORDER BY date DESC";

    const result = await this.db.query(query, params);

    // Calculate analytics
    const eventTypeCounts: Record<string, number> = {};
    const dailyBreakdown: Record<string, number> = {};
    let totalEvents = 0;

    result.rows.forEach((row) => {
      const eventType = row.event_type;
      const date = row.date.toISOString().split("T")[0];
      const count = parseInt(row.daily_count);

      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + count;
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + count;
      totalEvents += count;
    });

    // Top event types
    const topEventTypes = Object.entries(eventTypeCounts)
      .map(([eventType, count]) => ({
        eventType,
        count,
        percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily breakdown
    const dailyBreakdownArray = Object.entries(dailyBreakdown)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Peak usage day
    const peakDay = dailyBreakdownArray.reduce(
      (peak, day) => (day.count > peak.count ? day : peak),
      { date: "", count: 0 }
    );

    // Average per day
    const daysInPeriod = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const averagePerDay =
      daysInPeriod > 0 ? Math.round((totalEvents / daysInPeriod) * 100) / 100 : 0;

    return {
      period,
      totalEvents,
      uniqueEventTypes: Object.keys(eventTypeCounts).length,
      topEventTypes,
      dailyBreakdown: dailyBreakdownArray,
      averagePerDay,
      peakUsageDay: peakDay.date,
      peakUsageCount: peakDay.count,
    };
  }

  async exportUsageData(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      format?: string;
    } = {}
  ): Promise<string> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      format = "csv",
    } = options;

    const result = await this.db.query(
      `SELECT 
        event_type,
        quantity,
        timestamp,
        metadata,
        properties
       FROM usage_events 
       WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
       ORDER BY timestamp DESC`,
      [userId, startDate, endDate]
    );

    if (format === "csv") {
      const headers = ["Event Type", "Quantity", "Timestamp", "Metadata", "Properties"];
      const rows = result.rows.map((row) => [
        row.event_type,
        row.quantity,
        row.timestamp.toISOString(),
        JSON.stringify(row.metadata),
        JSON.stringify(row.properties),
      ]);

      return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    } else {
      return JSON.stringify(result.rows, null, 2);
    }
  }

  async resetUsage(userId: string, eventType?: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      if (eventType) {
        // Reset specific event type
        await client.query("DELETE FROM usage_events WHERE user_id = $1 AND event_type = $2", [
          userId,
          eventType,
        ]);
        await client.query("DELETE FROM usage_aggregates WHERE user_id = $1 AND event_type = $2", [
          userId,
          eventType,
        ]);
      } else {
        // Reset all usage
        await client.query("DELETE FROM usage_events WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM usage_aggregates WHERE user_id = $1", [userId]);
      }

      await client.query("COMMIT");

      // Emit event
      this.emit("usage.reset", {
        userId,
        eventType,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper methods
  private async updateUsageAggregates(
    client: any,
    userId: string,
    eventType: string,
    quantity: number,
    timestamp: Date
  ): Promise<void> {
    // Update daily aggregate
    const date = timestamp.toISOString().split("T")[0];
    await client.query(
      `INSERT INTO usage_aggregates (
        user_id, event_type, period_type, period_start, period_end, current_usage, updated_at
      ) VALUES ($1, $2, 'day', $3, $3 + INTERVAL '1 day', $4, NOW())
      ON CONFLICT (user_id, event_type, period_type, period_start)
      DO UPDATE SET 
        current_usage = usage_aggregates.current_usage + $4,
        updated_at = NOW()`,
      [userId, eventType, date, quantity]
    );

    // Update monthly aggregate
    const monthStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1);
    const monthEnd = new Date(timestamp.getFullYear(), timestamp.getMonth() + 1, 0);
    await client.query(
      `INSERT INTO usage_aggregates (
        user_id, event_type, period_type, period_start, period_end, current_usage, updated_at
      ) VALUES ($1, $2, 'month', $3, $4, $5, NOW())
      ON CONFLICT (user_id, event_type, period_type, period_start)
      DO UPDATE SET 
        current_usage = usage_aggregates.current_usage + $5,
        updated_at = NOW()`,
      [userId, eventType, monthStart, monthEnd, quantity]
    );
  }

  private mapUsageEvent(row: any): UsageEvent {
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      quantity: row.quantity,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      properties: row.properties ? JSON.parse(row.properties) : {},
      createdAt: row.created_at,
    };
  }
}
