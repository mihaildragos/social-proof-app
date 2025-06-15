import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { AnalyticsService } from "../services/analytics-service";

// Mock environment variables
process.env.USE_PRISMA = "true";

// Create mock functions with proper return types
const mockCreate = jest.fn() as jest.MockedFunction<any>;
const mockCount = jest.fn() as jest.MockedFunction<any>;
const mockFindMany = jest.fn() as jest.MockedFunction<any>;
const mockFunnelCreate = jest.fn() as jest.MockedFunction<any>;
const mockFunnelFindMany = jest.fn() as jest.MockedFunction<any>;
const mockFunnelFindFirst = jest.fn() as jest.MockedFunction<any>;
const mockReportCreate = jest.fn() as jest.MockedFunction<any>;
const mockReportFindMany = jest.fn() as jest.MockedFunction<any>;
const mockTransaction = jest.fn() as jest.MockedFunction<any>;
const mockQueryRaw = jest.fn() as jest.MockedFunction<any>;
const mockDisconnect = jest.fn() as jest.MockedFunction<any>;

// Mock dependencies
jest.mock("../services/clickhouse-service", () => ({
  ClickHouseService: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined as never),
    getConversionFunnel: jest.fn().mockResolvedValue({
      steps: [],
      conversion_rate: 0,
      total_users: 0,
    } as never),
    getTopEvents: jest.fn().mockResolvedValue([] as never),
    getDeviceAnalytics: jest.fn().mockResolvedValue({
      devices: [],
      browsers: [],
      operating_systems: [],
    } as never),
    getGeographicData: jest.fn().mockResolvedValue([] as never),
    getPerformanceMetrics: jest.fn().mockResolvedValue({
      avg_page_load_time: 0,
      p95_page_load_time: 0,
      avg_ttfb: 0,
      avg_dom_ready: 0,
      page_views: 0,
      errors: 0,
      unique_users: 0,
      error_rate: 0,
    } as never),
  })),
}));

jest.mock("../lib/prisma", () => ({
  prisma: {
    analyticsEvent: {
      create: mockCreate,
      count: mockCount,
      findMany: mockFindMany,
    },
    analyticsFunnel: {
      create: mockFunnelCreate,
      findMany: mockFunnelFindMany,
      findFirst: mockFunnelFindFirst,
    },
    analyticsReport: {
      create: mockReportCreate,
      findMany: mockReportFindMany,
    },
    $transaction: mockTransaction,
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
  }
}));

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

  let analyticsService: AnalyticsService;
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
  });

  afterEach(async () => {
    await analyticsService.close();
  });

  describe("recordEvent", () => {
    const mockEventData = {
      siteId: "site-123",
      eventType: "page_view",
      eventName: "home_page",
      userId: "user-123",
      sessionId: "session-123",
      properties: { page: "/home" },
      source: "google",
      campaign: "summer-sale",
      medium: "cpc",
    };

    it("should record event using Prisma", async () => {
      const mockResult = { 
        id: "event-123", 
        organizationId: mockOrganizationId,
        ...mockEventData,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock prisma.analyticsEvent.create
      mockCreate.mockResolvedValue(mockResult);

      const result = await analyticsService.recordEvent(mockOrganizationId, mockEventData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrganizationId,
          siteId: mockEventData.siteId,
          eventType: mockEventData.eventType,
          eventName: mockEventData.eventName,
          userId: mockEventData.userId,
          sessionId: mockEventData.sessionId,
          properties: mockEventData.properties,
          source: mockEventData.source,
          campaign: mockEventData.campaign,
          medium: mockEventData.medium,
          timestamp: expect.any(Date),
        },
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle Prisma errors gracefully", async () => {
      // Mock prisma.analyticsEvent.create to throw error
      mockCreate.mockRejectedValue(new Error("Prisma connection failed"));

      await expect(
        analyticsService.recordEvent(mockOrganizationId, mockEventData as never)
      ).rejects.toThrow("Prisma connection failed");
    });
  });

  describe("recordBatchEvents", () => {
    const mockEventsData = [
      { eventType: "page_view", eventName: "home" },
      { eventType: "click", eventName: "button_click" },
    ];

    it("should batch record events using transaction", async () => {
      const mockResults = [
        { id: "event-1", eventType: "page_view", organizationId: mockOrganizationId },
        { id: "event-2", eventType: "click", organizationId: mockOrganizationId },
      ];
      
      // Mock transaction
      const mockTx = {
        analyticsEvent: {
          create: jest.fn()
            .mockResolvedValueOnce(mockResults[0] as never)
            .mockResolvedValueOnce(mockResults[1] as never),
        },
      };
      
      mockTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await analyticsService.recordBatchEvents(mockOrganizationId, mockEventsData);

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTx.analyticsEvent.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResults);
    });
  });

  describe("getDashboardData", () => {
    it("should get dashboard data using Prisma", async () => {
      const mockCountValue = 100;
      const mockUsers = [{ userId: "user-1" }, { userId: "user-2" }];
      const mockSessions = [{ sessionId: "session-1" }, { sessionId: "session-2" }];
      const mockTimeSeries = [{ time_bucket: new Date(), events: 10, users: 5 }];
      
      // Mock prisma methods
      mockCount.mockResolvedValue(mockCountValue);
      mockFindMany
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce(mockSessions);
      mockQueryRaw.mockResolvedValue(mockTimeSeries);

      const options = { timeRange: "24h" };
      const result = await analyticsService.getDashboardData(mockOrganizationId, options);

      expect(mockCount).toHaveBeenCalled();
      expect(mockFindMany).toHaveBeenCalledTimes(2);
      expect(mockQueryRaw).toHaveBeenCalled();
      expect(result).toHaveProperty('metrics');
      expect(result.metrics.total_events).toBe(mockCountValue);
      expect(result.metrics.unique_users).toBe(mockUsers.length);
      expect(result.metrics.sessions).toBe(mockSessions.length);
    });
  });

  describe("funnel operations", () => {
    const mockFunnelData = {
      organizationId: mockOrganizationId,
      name: "Sales Funnel",
      description: "Track user journey",
      steps: [{ name: "Sign Up", event: "signup" }],
    };

    it("should create funnel using Prisma", async () => {
      const mockResult = { 
        id: "funnel-123", 
        ...mockFunnelData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockFunnelCreate.mockResolvedValue(mockResult);

      const result = await analyticsService.createFunnel(mockFunnelData);

      expect(mockFunnelCreate).toHaveBeenCalledWith({
        data: mockFunnelData,
      });
      expect(result).toEqual(mockResult);
    });

    it("should get funnels using Prisma", async () => {
      const mockFunnels = [
        { id: "funnel-1", name: "Funnel 1", organizationId: mockOrganizationId },
        { id: "funnel-2", name: "Funnel 2", organizationId: mockOrganizationId },
      ];
      
      mockFunnelFindMany.mockResolvedValue(mockFunnels);

      const options = { isActive: true };
      const result = await analyticsService.getFunnels(mockOrganizationId, options);

      expect(mockFunnelFindMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockFunnels);
    });

    it("should get funnel by ID using Prisma", async () => {
      const mockFunnel = { 
        id: "funnel-123", 
        name: "Test Funnel",
        organizationId: mockOrganizationId 
      };
      
      mockFunnelFindFirst.mockResolvedValue(mockFunnel);

      const result = await analyticsService.getFunnelById(mockOrganizationId, "funnel-123");

      expect(mockFunnelFindFirst).toHaveBeenCalledWith({
        where: {
          id: "funnel-123",
          organizationId: mockOrganizationId,
        },
      });
      expect(result).toEqual(mockFunnel);
    });
  });

  describe("report operations", () => {
    const mockReportData = {
      organizationId: mockOrganizationId,
      name: "Monthly Report",
      description: "Monthly analytics",
      config: { period: "month" },
    };

    it("should create report using Prisma", async () => {
      const mockResult = { 
        id: "report-123", 
        ...mockReportData,
        type: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockReportCreate.mockResolvedValue(mockResult);

      const result = await analyticsService.createReport(mockReportData);

      expect(mockReportCreate).toHaveBeenCalledWith({
        data: {
          ...mockReportData,
          type: undefined,
          isPublic: false,
        },
      });
      expect(result).toEqual(mockResult);
    });

    it("should get reports using Prisma", async () => {
      const mockReports = [
        { id: "report-1", name: "Report 1", organizationId: mockOrganizationId },
        { id: "report-2", name: "Report 2", organizationId: mockOrganizationId },
      ];
      
      mockReportFindMany.mockResolvedValue(mockReports);

      const options = { type: "dashboard" };
      const result = await analyticsService.getReports(mockOrganizationId, options);

      expect(mockReportFindMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId, type: "dashboard" },
        include: { schedules: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockReports);
    });
  });

  describe("service cleanup", () => {
    it("should close all connections", async () => {
      const mockClickhouseService = {
        close: jest.fn().mockResolvedValue(undefined as never),
      };
      
      mockDisconnect.mockResolvedValue(undefined as never);
      (analyticsService as any).clickhouseService = mockClickhouseService;

      await analyticsService.close();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockClickhouseService.close).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should log errors and rethrow", async () => {
      const mockLogger = {
        error: jest.fn(),
      };
      
      (analyticsService as any).logger = mockLogger;
      mockCreate.mockRejectedValue(new Error("Database error"));

      await expect(
        analyticsService.recordEvent(mockOrganizationId, { eventType: "test" })
      ).rejects.toThrow("Database error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error recording event:",
        expect.any(Error)
      );
    });
  });
});