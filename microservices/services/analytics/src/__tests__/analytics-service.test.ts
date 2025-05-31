import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("AnalyticsService", () => {
  // Mock data
  const mockEvent = {
    id: "event-123",
    type: "notification_displayed",
    siteId: "site-123",
    sessionId: "session-123",
    userId: "user-123",
    properties: {
      notificationId: "notification-123",
      position: "bottom-left",
      duration: 5000,
    },
    timestamp: new Date("2024-01-01T10:00:00Z"),
    createdAt: new Date("2024-01-01T10:00:00Z"),
  };

  const mockMetric = {
    id: "metric-123",
    name: "conversion_rate",
    value: 0.15,
    siteId: "site-123",
    period: "daily",
    date: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
  };

  // Mock dependencies
  const mockTimescaleDB = {
    query: jest.fn(),
    insert: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockClickHouse = {
    query: jest.fn(),
    insert: jest.fn(),
    createTable: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  // Mock AnalyticsService class
  class AnalyticsService {
    constructor(
      private timescaleDB = mockTimescaleDB,
      private clickHouse = mockClickHouse,
      private eventPublisher = mockEventPublisher,
      private cacheService = mockCacheService
    ) {}

    async trackEvent(eventData: {
      type: string;
      siteId: string;
      sessionId?: string;
      userId?: string;
      properties?: Record<string, any>;
      timestamp?: Date;
    }) {
      if (!eventData.type) {
        throw new Error("Event type is required");
      }

      if (!eventData.siteId) {
        throw new Error("Site ID is required");
      }

      const event = {
        id: this.generateId(),
        type: eventData.type,
        siteId: eventData.siteId,
        sessionId: eventData.sessionId || null,
        userId: eventData.userId || null,
        properties: eventData.properties || {},
        timestamp: eventData.timestamp || new Date(),
        createdAt: new Date(),
      };

      // Store in TimescaleDB for time-series analysis
      await this.timescaleDB.insert("events", event);

      // Store in ClickHouse for fast aggregations
      await this.clickHouse.insert("events", event);

      // Publish event for real-time processing
      await this.eventPublisher.publish("analytics.event.tracked", {
        eventId: event.id,
        type: event.type,
        siteId: event.siteId,
      });

      return event;
    }

    async getEventStats(
      siteId: string,
      options: {
        startDate: Date;
        endDate: Date;
        eventType?: string;
        groupBy?: "hour" | "day" | "week" | "month";
      }
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      const { startDate, endDate, eventType, groupBy = "day" } = options;

      // Check cache first
      const cacheKey = `event_stats:${siteId}:${startDate.toISOString()}:${endDate.toISOString()}:${eventType || "all"}:${groupBy}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      let query = `
        SELECT 
          date_trunc('${groupBy}', timestamp) as period,
          type,
          COUNT(*) as count
        FROM events 
        WHERE site_id = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
      `;

      const params = [siteId, startDate, endDate];

      if (eventType) {
        query += " AND type = $4";
        params.push(eventType);
      }

      query += " GROUP BY period, type ORDER BY period";

      const results = (await this.timescaleDB.query(query, params)) as any;

      // Transform results
      const stats = results.reduce((acc: any, row: any) => {
        const period = row.period.toISOString();
        if (!acc[period]) {
          acc[period] = {};
        }
        acc[period][row.type] = row.count;
        return acc;
      }, {});

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(stats), 300);

      return stats;
    }

    async getConversionFunnel(
      siteId: string,
      funnelSteps: string[],
      options: {
        startDate: Date;
        endDate: Date;
      }
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      if (!funnelSteps || funnelSteps.length === 0) {
        throw new Error("Funnel steps are required");
      }

      const { startDate, endDate } = options;

      // Build funnel query
      const stepQueries = funnelSteps
        .map(
          (step, index) => `
        step_${index} AS (
          SELECT DISTINCT session_id
          FROM events
          WHERE site_id = $1
            AND type = '${step}'
            AND timestamp >= $2
            AND timestamp <= $3
        )
      `
        )
        .join(",\n");

      const joinQueries = funnelSteps
        .map((_, index) => {
          if (index === 0) return "step_0";
          return `step_${index} ON step_0.session_id = step_${index}.session_id`;
        })
        .join("\n  LEFT JOIN ");

      const query = `
        WITH ${stepQueries}
        SELECT 
          ${funnelSteps.map((_, index) => `COUNT(step_${index}.session_id) as step_${index}_count`).join(",\n          ")}
        FROM ${joinQueries}
      `;

      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      const row = (results as any)[0];

      const funnel = funnelSteps.map((step, index) => ({
        step,
        count: parseInt(row[`step_${index}_count`]) || 0,
        conversionRate:
          index === 0 ? 1 : (
            (parseInt(row[`step_${index}_count`]) || 0) / (parseInt(row[`step_0_count`]) || 1)
          ),
      }));

      return {
        steps: funnel,
        totalSessions: funnel[0]?.count || 0,
        overallConversionRate:
          funnel.length > 1 ? funnel[funnel.length - 1].count / funnel[0].count : 0,
      };
    }

    async getCohortAnalysis(
      siteId: string,
      options: {
        startDate: Date;
        endDate: Date;
        cohortType: "daily" | "weekly" | "monthly";
        retentionPeriods: number;
      }
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      const { startDate, endDate, cohortType, retentionPeriods } = options;

      // Get user first seen dates (cohort assignment)
      const cohortQuery = `
        SELECT 
          user_id,
          date_trunc('${cohortType}', MIN(timestamp)) as cohort_period
        FROM events
        WHERE site_id = $1
          AND user_id IS NOT NULL
          AND timestamp >= $2
          AND timestamp <= $3
        GROUP BY user_id
      `;

      const cohortResults = await this.timescaleDB.query(cohortQuery, [siteId, startDate, endDate]);

      // Get user activity in subsequent periods
      const activityQuery = `
        SELECT 
          user_id,
          date_trunc('${cohortType}', timestamp) as activity_period
        FROM events
        WHERE site_id = $1
          AND user_id IS NOT NULL
          AND timestamp >= $2
          AND timestamp <= $3
        GROUP BY user_id, activity_period
      `;

      const activityResults = await this.timescaleDB.query(activityQuery, [
        siteId,
        startDate,
        endDate,
      ]);

      // Process cohort analysis
      const cohorts: Record<string, any> = {};

      (cohortResults as any).forEach((row: any) => {
        const cohortPeriod = row.cohort_period.toISOString();
        if (!cohorts[cohortPeriod]) {
          cohorts[cohortPeriod] = {
            cohortPeriod,
            totalUsers: 0,
            retentionData: Array(retentionPeriods).fill(0),
          };
        }
        cohorts[cohortPeriod].totalUsers++;
      });

      // Calculate retention rates
      (activityResults as any).forEach((row: any) => {
        const userCohort = (cohortResults as any).find((c: any) => c.user_id === row.user_id);
        if (userCohort) {
          const cohortPeriod = userCohort.cohort_period.toISOString();
          const activityPeriod = row.activity_period;
          const periodDiff = this.calculatePeriodDifference(
            userCohort.cohort_period,
            activityPeriod,
            cohortType
          );

          if (periodDiff < retentionPeriods && cohorts[cohortPeriod]) {
            cohorts[cohortPeriod].retentionData[periodDiff]++;
          }
        }
      });

      // Convert to percentages
      Object.values(cohorts).forEach((cohort: any) => {
        cohort.retentionRates = cohort.retentionData.map((count: number) =>
          cohort.totalUsers > 0 ? (count / cohort.totalUsers) * 100 : 0
        );
      });

      return Object.values(cohorts);
    }

    async getDashboardMetrics(
      siteId: string,
      dateRange: {
        startDate: Date;
        endDate: Date;
      }
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      const { startDate, endDate } = dateRange;

      // Check cache
      const cacheKey = `dashboard_metrics:${siteId}:${startDate.toISOString()}:${endDate.toISOString()}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Get key metrics in parallel
      const [totalEvents, uniqueUsers, uniqueSessions, topEvents, conversionRate] =
        await Promise.all([
          this.getTotalEvents(siteId, startDate, endDate),
          this.getUniqueUsers(siteId, startDate, endDate),
          this.getUniqueSessions(siteId, startDate, endDate),
          this.getTopEvents(siteId, startDate, endDate),
          this.getConversionRate(siteId, startDate, endDate),
        ]);

      const metrics = {
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        topEvents,
        conversionRate,
        avgEventsPerSession: uniqueSessions > 0 ? totalEvents / uniqueSessions : 0,
        avgEventsPerUser: uniqueUsers > 0 ? totalEvents / uniqueUsers : 0,
      };

      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(metrics), 600);

      return metrics;
    }

    async generateReport(
      siteId: string,
      reportType: "daily" | "weekly" | "monthly",
      options: {
        startDate: Date;
        endDate: Date;
        metrics: string[];
      }
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      const { startDate, endDate, metrics } = options;

      const report = {
        siteId,
        reportType,
        period: { startDate, endDate },
        generatedAt: new Date(),
        data: {} as Record<string, any>,
      };

      // Generate requested metrics
      for (const metric of metrics) {
        switch (metric) {
          case "events":
            report.data.events = await this.getEventStats(siteId, {
              startDate,
              endDate,
              groupBy:
                reportType === "daily" ? "day"
                : reportType === "weekly" ? "week"
                : "month",
            });
            break;
          case "funnel":
            report.data.funnel = await this.getConversionFunnel(
              siteId,
              ["notification_displayed", "notification_clicked", "conversion"],
              { startDate, endDate }
            );
            break;
          case "cohort":
            report.data.cohort = await this.getCohortAnalysis(siteId, {
              startDate,
              endDate,
              cohortType:
                reportType === "daily" ? "daily"
                : reportType === "weekly" ? "weekly"
                : "monthly",
              retentionPeriods: 12,
            });
            break;
          case "dashboard":
            report.data.dashboard = await this.getDashboardMetrics(siteId, { startDate, endDate });
            break;
        }
      }

      // Publish report generated event
      await this.eventPublisher.publish("analytics.report.generated", {
        siteId,
        reportType,
        metrics,
      });

      return report;
    }

    private async getTotalEvents(siteId: string, startDate: Date, endDate: Date): Promise<number> {
      const query =
        "SELECT COUNT(*) as count FROM events WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3";
      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      return parseInt((results as any)[0].count) || 0;
    }

    private async getUniqueUsers(siteId: string, startDate: Date, endDate: Date): Promise<number> {
      const query =
        "SELECT COUNT(DISTINCT user_id) as count FROM events WHERE site_id = $1 AND user_id IS NOT NULL AND timestamp >= $2 AND timestamp <= $3";
      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      return parseInt((results as any)[0].count) || 0;
    }

    private async getUniqueSessions(
      siteId: string,
      startDate: Date,
      endDate: Date
    ): Promise<number> {
      const query =
        "SELECT COUNT(DISTINCT session_id) as count FROM events WHERE site_id = $1 AND session_id IS NOT NULL AND timestamp >= $2 AND timestamp <= $3";
      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      return parseInt((results as any)[0].count) || 0;
    }

    private async getTopEvents(
      siteId: string,
      startDate: Date,
      endDate: Date
    ): Promise<Array<{ type: string; count: number }>> {
      const query =
        "SELECT type, COUNT(*) as count FROM events WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3 GROUP BY type ORDER BY count DESC LIMIT 10";
      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      return (results as any).map((row: any) => ({ type: row.type, count: parseInt(row.count) }));
    }

    private async getConversionRate(
      siteId: string,
      startDate: Date,
      endDate: Date
    ): Promise<number> {
      const query = `
        SELECT 
          COUNT(CASE WHEN type = 'notification_displayed' THEN 1 END) as displayed,
          COUNT(CASE WHEN type = 'conversion' THEN 1 END) as conversions
        FROM events 
        WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
      `;
      const results = await this.timescaleDB.query(query, [siteId, startDate, endDate]);
      const { displayed, conversions } = (results as any)[0];
      return displayed > 0 ? (conversions / displayed) * 100 : 0;
    }

    private calculatePeriodDifference(startDate: Date, endDate: Date, periodType: string): number {
      const start = new Date(startDate);
      const end = new Date(endDate);

      switch (periodType) {
        case "daily":
          return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        case "weekly":
          return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
        case "monthly":
          return (
            (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
          );
        default:
          return 0;
      }
    }

    private generateId(): string {
      return "event_" + Math.random().toString(36).substr(2, 9);
    }
  }

  let analyticsService: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("trackEvent", () => {
    const validEventData = {
      type: "notification_displayed",
      siteId: "site-123",
      sessionId: "session-123",
      userId: "user-123",
      properties: { notificationId: "notification-123" },
    };

    it("should track event successfully", async () => {
      mockTimescaleDB.insert.mockResolvedValue(true as never);
      mockClickHouse.insert.mockResolvedValue(true as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await analyticsService.trackEvent(validEventData);

      expect(result).toMatchObject({
        type: validEventData.type,
        siteId: validEventData.siteId,
        sessionId: validEventData.sessionId,
        userId: validEventData.userId,
        properties: validEventData.properties,
      });

      expect(mockTimescaleDB.insert).toHaveBeenCalledWith(
        "events",
        expect.objectContaining({
          type: validEventData.type,
          siteId: validEventData.siteId,
        })
      );

      expect(mockClickHouse.insert).toHaveBeenCalledWith(
        "events",
        expect.objectContaining({
          type: validEventData.type,
          siteId: validEventData.siteId,
        })
      );

      expect(mockEventPublisher.publish).toHaveBeenCalledWith("analytics.event.tracked", {
        eventId: expect.any(String),
        type: validEventData.type,
        siteId: validEventData.siteId,
      });
    });

    it("should throw error for missing event type", async () => {
      const invalidData = { ...validEventData, type: "" };

      await expect(analyticsService.trackEvent(invalidData)).rejects.toThrow(
        "Event type is required"
      );
    });

    it("should throw error for missing site ID", async () => {
      const invalidData = { ...validEventData, siteId: "" };

      await expect(analyticsService.trackEvent(invalidData)).rejects.toThrow("Site ID is required");
    });

    it("should handle optional fields", async () => {
      const minimalData = {
        type: "notification_displayed",
        siteId: "site-123",
      };

      mockTimescaleDB.insert.mockResolvedValue(true as never);
      mockClickHouse.insert.mockResolvedValue(true as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await analyticsService.trackEvent(minimalData);

      expect(result).toMatchObject({
        type: minimalData.type,
        siteId: minimalData.siteId,
        sessionId: null,
        userId: null,
        properties: {},
      });
    });
  });

  describe("getEventStats", () => {
    const options = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      eventType: "notification_displayed",
      groupBy: "day" as const,
    };

    it("should return event statistics from cache", async () => {
      const cachedStats = { "2024-01-01": { notification_displayed: 100 } };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedStats) as never);

      const result = await analyticsService.getEventStats("site-123", options);

      expect(result).toEqual(cachedStats);
      expect(mockTimescaleDB.query).not.toHaveBeenCalled();
    });

    it("should query database when cache miss", async () => {
      const dbResults = [
        { period: new Date("2024-01-01"), type: "notification_displayed", count: 100 },
        { period: new Date("2024-01-02"), type: "notification_displayed", count: 150 },
      ];

      mockCacheService.get.mockResolvedValue(null as never);
      mockTimescaleDB.query.mockResolvedValue(dbResults as never);
      mockCacheService.set.mockResolvedValue(true as never);

      const result = await analyticsService.getEventStats("site-123", options);

      expect(result).toEqual({
        "2024-01-01T00:00:00.000Z": { notification_displayed: 100 },
        "2024-01-02T00:00:00.000Z": { notification_displayed: 150 },
      });

      expect(mockTimescaleDB.query).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should throw error for missing site ID", async () => {
      await expect(analyticsService.getEventStats("", options)).rejects.toThrow(
        "Site ID is required"
      );
    });
  });

  describe("getConversionFunnel", () => {
    const funnelSteps = ["notification_displayed", "notification_clicked", "conversion"];
    const options = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };

    it("should return conversion funnel analysis", async () => {
      const dbResults = [{ step_0_count: 1000, step_1_count: 200, step_2_count: 50 }];

      mockTimescaleDB.query.mockResolvedValue(dbResults as never);

      const result = await analyticsService.getConversionFunnel("site-123", funnelSteps, options);

      expect(result).toEqual({
        steps: [
          { step: "notification_displayed", count: 1000, conversionRate: 1 },
          { step: "notification_clicked", count: 200, conversionRate: 0.2 },
          { step: "conversion", count: 50, conversionRate: 0.05 },
        ],
        totalSessions: 1000,
        overallConversionRate: 0.05,
      });
    });

    it("should throw error for missing site ID", async () => {
      await expect(analyticsService.getConversionFunnel("", funnelSteps, options)).rejects.toThrow(
        "Site ID is required"
      );
    });

    it("should throw error for empty funnel steps", async () => {
      await expect(analyticsService.getConversionFunnel("site-123", [], options)).rejects.toThrow(
        "Funnel steps are required"
      );
    });
  });

  describe("getDashboardMetrics", () => {
    const dateRange = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };

    it("should return dashboard metrics from cache", async () => {
      const cachedMetrics = {
        totalEvents: 1000,
        uniqueUsers: 500,
        uniqueSessions: 800,
        topEvents: [{ type: "notification_displayed", count: 600 }],
        conversionRate: 5.0,
      };

      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedMetrics) as never);

      const result = await analyticsService.getDashboardMetrics("site-123", dateRange);

      expect(result).toEqual(cachedMetrics);
    });

    it("should calculate dashboard metrics when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null as never);
      mockTimescaleDB.query
        .mockResolvedValueOnce([{ count: 1000 }] as never) // total events
        .mockResolvedValueOnce([{ count: 500 }] as never) // unique users
        .mockResolvedValueOnce([{ count: 800 }] as never) // unique sessions
        .mockResolvedValueOnce([{ type: "notification_displayed", count: 600 }] as never) // top events
        .mockResolvedValueOnce([{ displayed: 1000, conversions: 50 }] as never); // conversion rate

      mockCacheService.set.mockResolvedValue(true as never);

      const result = await analyticsService.getDashboardMetrics("site-123", dateRange);

      expect(result).toMatchObject({
        totalEvents: 1000,
        uniqueUsers: 500,
        uniqueSessions: 800,
        conversionRate: 5.0,
        avgEventsPerSession: 1.25,
        avgEventsPerUser: 2.0,
      });

      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should throw error for missing site ID", async () => {
      await expect(analyticsService.getDashboardMetrics("", dateRange)).rejects.toThrow(
        "Site ID is required"
      );
    });
  });

  describe("generateReport", () => {
    const options = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      metrics: ["events", "dashboard"],
    };

    it("should generate report with requested metrics", async () => {
      // Mock the methods that will be called
      mockCacheService.get.mockResolvedValue(null as never);
      mockTimescaleDB.query
        .mockResolvedValueOnce([] as never) // event stats
        .mockResolvedValueOnce([{ count: 1000 }] as never) // total events
        .mockResolvedValueOnce([{ count: 500 }] as never) // unique users
        .mockResolvedValueOnce([{ count: 800 }] as never) // unique sessions
        .mockResolvedValueOnce([] as never) // top events
        .mockResolvedValueOnce([{ displayed: 1000, conversions: 50 }] as never); // conversion rate

      mockCacheService.set.mockResolvedValue(true as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await analyticsService.generateReport("site-123", "daily", options);

      expect(result).toMatchObject({
        siteId: "site-123",
        reportType: "daily",
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
        data: {
          events: expect.any(Object),
          dashboard: expect.any(Object),
        },
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith("analytics.report.generated", {
        siteId: "site-123",
        reportType: "daily",
        metrics: options.metrics,
      });
    });

    it("should throw error for missing site ID", async () => {
      await expect(analyticsService.generateReport("", "daily", options)).rejects.toThrow(
        "Site ID is required"
      );
    });
  });
});
