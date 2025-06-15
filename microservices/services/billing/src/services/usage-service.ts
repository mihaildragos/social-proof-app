import { EventEmitter } from "events";
import { prisma } from "../lib/prisma";

interface UsageEvent {
  id: string;
  userId: string;
  eventType: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, string> | undefined;
  properties?: Record<string, any> | undefined;
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
  constructor() {
    super();
  }

  // Record usage events
  async recordUsage(data: {
    organizationId: string;
    subscriptionId: string;
    resourceType: string;
    quantity: number;
    timestamp: Date;
    metadata?: Record<string, string>;
    properties?: Record<string, any>;
  }): Promise<UsageEvent> {
    return await prisma.$transaction(async (prisma) => {
      // Check if usage limit is exceeded
      const limitCheck = await this.checkUsageLimit(data.organizationId, data.resourceType, data.quantity);
      if (!limitCheck.allowed) {
        throw new Error(`Usage limit exceeded: ${limitCheck.message}`);
      }

      // Record usage event
      const usageRecord = await prisma.usageRecord.create({
        data: {
          organizationId: data.organizationId,
          subscriptionId: data.subscriptionId,
          resourceType: data.resourceType,
          quantity: data.quantity,
          recordedAt: data.timestamp,
        }
      });

      // Update usage aggregates
      await this.updateUsageAggregates(
        data.organizationId,
        data.subscriptionId,
        data.resourceType,
        data.quantity,
        data.timestamp
      );

      const usageEvent: UsageEvent = {
        id: usageRecord.id,
        userId: data.organizationId, // Map organizationId to userId for backward compatibility
        eventType: data.resourceType,
        quantity: data.quantity,
        timestamp: data.timestamp,
        metadata: data.metadata,
        properties: data.properties,
        createdAt: usageRecord.recordedAt,
      };

      // Emit event
      this.emit("usage.recorded", {
        usageEvent,
        userId: data.organizationId,
        eventType: data.resourceType,
        quantity: data.quantity,
      });

      return usageEvent;
    });
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
    return await prisma.$transaction(async (prisma) => {
      const usageEvents: UsageEvent[] = [];

      for (const event of events) {
        // Check usage limits for each event
        const limitCheck = await this.checkUsageLimit(userId, event.eventType, event.quantity);
        if (!limitCheck.allowed) {
          throw new Error(`Usage limit exceeded for ${event.eventType}: ${limitCheck.message}`);
        }

        // Record usage event using the existing recordUsage method
        const usageEvent = await this.recordUsage({
          organizationId: userId,
          subscriptionId: "default", // This should be passed as parameter
          resourceType: event.eventType,
          quantity: event.quantity,
          timestamp: event.timestamp,
          ...(event.metadata && { metadata: event.metadata }),
          ...(event.properties && { properties: event.properties }),
        });

        usageEvents.push(usageEvent);
      }

      // Emit event
      this.emit("usage.batch_recorded", {
        usageEvents,
        userId,
        totalEvents: events.length,
      });

      return usageEvents;
    });
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

    // Use Prisma to get usage records
    const whereClause: any = {
      organizationId: userId,
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (eventType) {
      whereClause.resourceType = eventType;
    }

    const usageRecords = await prisma.usageRecord.findMany({
      where: whereClause,
      orderBy: { recordedAt: 'desc' },
    });

    // Group by event type and calculate aggregates
    const usageByEventType: Record<string, any[]> = {};
    let totalQuantity = 0;
    let totalEvents = 0;

    // Process records by day (simplified grouping)
    const dailyUsage: Record<string, Record<string, { quantity: number; count: number }>> = {};

    usageRecords.forEach((record) => {
      const dateKey = record.recordedAt.toISOString().split('T')[0]!;
      const eventType = record.resourceType;

      if (!dailyUsage[dateKey]) {
        dailyUsage[dateKey] = {};
      }

      const dayData = dailyUsage[dateKey]!;
      if (!dayData[eventType]) {
        dayData[eventType] = { quantity: 0, count: 0 };
      }

      const eventData = dayData[eventType]!;
      eventData.quantity += record.quantity;
      eventData.count += 1;

      totalQuantity += record.quantity;
      totalEvents += 1;
    });

    // Convert to expected format
    Object.entries(dailyUsage).forEach(([date, eventTypes]) => {
      Object.entries(eventTypes).forEach(([eventType, stats]) => {
        if (!usageByEventType[eventType]) {
          usageByEventType[eventType] = [];
        }
        usageByEventType[eventType].push({
          period: date,
          quantity: stats.quantity,
          eventCount: stats.count,
        });
      });
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

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        organizationId: userId,
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Aggregate by resource type
    const eventTypeStats: Record<string, { quantity: number; count: number }> = {};
    let totalQuantity = 0;

    usageRecords.forEach((record) => {
      const eventType = record.resourceType;
      if (!eventTypeStats[eventType]) {
        eventTypeStats[eventType] = { quantity: 0, count: 0 };
      }
      eventTypeStats[eventType].quantity += record.quantity;
      eventTypeStats[eventType].count += 1;
      totalQuantity += record.quantity;
    });

    return Object.entries(eventTypeStats)
      .map(([eventType, stats]) => ({
        eventType,
        quantity: stats.quantity,
        eventCount: stats.count,
        percentage: totalQuantity > 0 ? Math.round((stats.quantity / totalQuantity) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  async getUserQuotas(userId: string): Promise<UsageQuota[]> {
    // For now, return empty quotas - this should be implemented with plan limits
    return [];
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
    // For now, allow all usage - this should check against plan limits
    return {
      allowed: true,
      currentUsage: 0,
      limit: -1,
      remainingUsage: -1,
      message: "No quota defined",
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

    // Simplified analytics using Prisma
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        organizationId: userId,
        recordedAt: { gte: startDate, lte: endDate },
        ...(eventType && { resourceType: eventType }),
      },
    });

    // Mock result structure for compatibility
    const result = { rows: [] };

    // Calculate analytics
    const eventTypeCounts: Record<string, number> = {};
    const dailyBreakdown: Record<string, number> = {};
    let totalEvents = 0;

    usageRecords.forEach((record) => {
      const eventType = record.resourceType;
      const date = record.recordedAt.toISOString().split("T")[0]!;
      const count = 1; // Each record represents one event

      if (!eventTypeCounts[eventType]) {
        eventTypeCounts[eventType] = 0;
      }
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] ?? 0) + count;
      dailyBreakdown[date] = (dailyBreakdown[date] ?? 0) + count;
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

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        organizationId: userId,
        recordedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { recordedAt: 'desc' },
    });

    if (format === "csv") {
      const headers = ["Event Type", "Quantity", "Timestamp", "Metadata", "Properties"];
      const rows = usageRecords.map((record) => [
        record.resourceType,
        record.quantity,
        record.recordedAt.toISOString(),
        "{}",  // metadata not available in current schema
        "{}",  // properties not available in current schema
      ]);

      return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    } else {
      return JSON.stringify(usageRecords, null, 2);
    }
  }

  async resetUsage(userId: string, eventType?: string): Promise<void> {
    await prisma.$transaction(async (prisma) => {
      const whereClause: any = { organizationId: userId };
      if (eventType) {
        whereClause.resourceType = eventType;
      }

      // Delete usage records
      await prisma.usageRecord.deleteMany({ where: whereClause });
      
      // Delete usage summaries
      await prisma.usageSummary.deleteMany({ where: whereClause });

      // Emit event
      this.emit("usage.reset", {
        userId,
        eventType,
      });
    });
  }

  // Helper methods
  private async updateUsageAggregates(
    organizationId: string,
    subscriptionId: string,
    resourceType: string,
    quantity: number,
    timestamp: Date
  ): Promise<void> {
    // Update usage summary for the current period
    const periodStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1);
    const periodEnd = new Date(timestamp.getFullYear(), timestamp.getMonth() + 1, 0);

    // Find or create usage summary
    let summary = await prisma.usageSummary.findFirst({
      where: {
        organizationId,
        subscriptionId,
        resourceType,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd }
      }
    });

    if (!summary) {
      summary = await prisma.usageSummary.create({
        data: {
          organizationId,
          subscriptionId,
          resourceType,
          periodStart,
          periodEnd,
          includedQuantity: 0, // This should come from plan limits
          usedQuantity: quantity,
          overageQuantity: 0,
          overageAmount: 0,
          status: 'pending'
        }
      });
    } else {
      await prisma.usageSummary.update({
        where: { id: summary.id },
        data: {
          usedQuantity: { increment: quantity }
        }
      });
    }
  }

}
