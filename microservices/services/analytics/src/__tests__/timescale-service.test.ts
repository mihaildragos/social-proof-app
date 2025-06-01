import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { TimescaleService } from "../services/timescale-service";
import { Pool } from "pg";

// Mock the pg Pool
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

describe("TimescaleService", () => {
  let timescaleService: TimescaleService;
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    // Mock Pool methods
    const MockedPool = Pool as jest.MockedClass<typeof Pool>;
    const connectMock = jest.fn() as jest.MockedFunction<any>;
    const endMock = jest.fn() as jest.MockedFunction<any>;
    
    connectMock.mockResolvedValue(mockClient);
    endMock.mockResolvedValue(undefined);
    
    mockPool = {
      connect: connectMock,
      end: endMock,
    };
    MockedPool.mockImplementation(() => mockPool);
    
    timescaleService = new TimescaleService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("insertEvent", () => {
    it("should insert event successfully", async () => {
      const eventData = {
        organization_id: "org_123",
        site_id: "site_123",
        event_type: "notification",
        event_name: "notification_sent",
        user_id: "user_123",
        session_id: "session_123",
        properties: { message: "Test notification" },
        timestamp: new Date(),
      };

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await timescaleService.insertEvent(eventData);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO analytics_events"),
        expect.arrayContaining([
          eventData.organization_id,
          eventData.site_id,
          eventData.event_type,
          eventData.event_name,
          eventData.user_id,
          eventData.session_id,
          JSON.stringify(eventData.properties),
          eventData.timestamp,
        ])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle null optional fields", async () => {
      const eventData = {
        organization_id: "org_123",
        event_type: "notification",
        event_name: "notification_sent",
        properties: { message: "Test notification" },
      };

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await timescaleService.insertEvent(eventData);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO analytics_events"),
        expect.arrayContaining([
          eventData.organization_id,
          null, // site_id
          eventData.event_type,
          eventData.event_name,
          null, // user_id
          null, // session_id
          JSON.stringify(eventData.properties),
          expect.any(Date), // timestamp
        ])
      );
    });

    it("should release client even on error", async () => {
      const eventData = {
        organization_id: "org_123",
        event_type: "notification",
        event_name: "notification_sent",
      };

      mockClient.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(timescaleService.insertEvent(eventData)).rejects.toThrow("Database error");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("getEventStats", () => {
    it("should get event statistics", async () => {
      const mockRows = [
        {
          time_bucket: new Date("2024-01-01T00:00:00Z"),
          event_count: "100",
          unique_users: "50",
          unique_sessions: "75",
        },
        {
          time_bucket: new Date("2024-01-01T01:00:00Z"),
          event_count: "150",
          unique_users: "60",
          unique_sessions: "85",
        },
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await timescaleService.getEventStats("org_123", {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-02"),
        interval: "hour",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("time_bucket('1 hour', timestamp)"),
        expect.arrayContaining(["org_123", expect.any(Date), expect.any(Date)])
      );

      expect(result).toEqual([
        {
          timestamp: mockRows[0].time_bucket,
          event_count: 100,
          unique_users: 50,
          unique_sessions: 75,
        },
        {
          timestamp: mockRows[1].time_bucket,
          event_count: 150,
          unique_users: 60,
          unique_sessions: 85,
        },
      ]);
    });

    it("should filter by site ID when provided", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await timescaleService.getEventStats("org_123", {
        siteId: "site_123",
        eventType: "notification",
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/AND site_id = \$4.*AND event_type = \$5/),
        expect.arrayContaining(["org_123", expect.any(Date), expect.any(Date), "site_123", "notification"])
      );
    });
  });

  describe("getTopEvents", () => {
    it("should get top events", async () => {
      const mockRows = [
        {
          event_name: "notification_sent",
          event_type: "notification",
          event_count: "500",
          unique_users: "100",
        },
        {
          event_name: "page_view",
          event_type: "engagement",
          event_count: "300",
          unique_users: "80",
        },
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await timescaleService.getTopEvents("org_123", {
        limit: 5,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("GROUP BY event_name, event_type"),
        expect.arrayContaining(["org_123", expect.any(Date), expect.any(Date), 5])
      );

      expect(result).toEqual([
        {
          event_name: "notification_sent",
          event_type: "notification",
          event_count: 500,
          unique_users: 100,
        },
        {
          event_name: "page_view",
          event_type: "engagement",
          event_count: 300,
          unique_users: 80,
        },
      ]);
    });
  });

  describe("getUserActivity", () => {
    it("should get user activity data", async () => {
      const mockStatsRow = {
        total_events: "25",
        total_sessions: "3",
        first_seen: new Date("2024-01-01"),
        last_seen: new Date("2024-01-02"),
        unique_events: "5",
      };

      const mockTimelineRows = [
        {
          timestamp: new Date("2024-01-02T10:00:00Z"),
          event_name: "notification_sent",
          event_type: "notification",
          properties: { message: "Test" },
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockStatsRow] })
        .mockResolvedValueOnce({ rows: mockTimelineRows });

      const result = await timescaleService.getUserActivity("org_123", "user_123");

      expect(result).toEqual({
        total_events: 25,
        total_sessions: 3,
        first_seen: mockStatsRow.first_seen,
        last_seen: mockStatsRow.last_seen,
        unique_events: 5,
        timeline: [
          {
            timestamp: mockTimelineRows[0].timestamp,
            event_name: "notification_sent",
            event_type: "notification",
            properties: { message: "Test" },
          },
        ],
      });
    });
  });

  describe("getFunnelAnalysis", () => {
    it("should analyze conversion funnel", async () => {
      const steps = ["page_view", "signup", "purchase"];
      const mockRow = {
        step_1_users: "1000",
        step_2_users: "300",
        step_3_users: "50",
      };

      mockClient.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await timescaleService.getFunnelAnalysis("org_123", steps);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WITH user_events AS"),
        expect.arrayContaining(["org_123", expect.any(Date), expect.any(Date), steps])
      );

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0]).toEqual({
        step: "page_view",
        step_number: 1,
        users: 1000,
        conversion_rate: 100,
        drop_off_rate: 0,
      });
      expect(result.total_users).toBe(1000);
      expect(result.conversion_rate).toBe(5); // 50/1000 * 100
    });

    it("should handle empty steps array", async () => {
      const result = await timescaleService.getFunnelAnalysis("org_123", []);

      expect(result).toEqual({
        steps: [],
        conversion_rate: 0,
        total_users: 0,
      });
    });
  });

  describe("getDeviceStats", () => {
    it("should get device statistics", async () => {
      const mockRows = [
        {
          device_type: "desktop",
          browser: "Chrome",
          operating_system: "Windows",
          unique_users: "500",
          total_events: "2000",
        },
        {
          device_type: "mobile",
          browser: "Safari",
          operating_system: "iOS",
          unique_users: "300",
          total_events: "1200",
        },
        {
          device_type: "desktop",
          browser: "Firefox",
          operating_system: "Windows",
          unique_users: "200",
          total_events: "800",
        },
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await timescaleService.getDeviceStats("org_123");

      expect(result.device_types).toEqual([
        { device_type: "desktop", users: 700 }, // 500 + 200
        { device_type: "mobile", users: 300 },
      ]);

      expect(result.browsers).toEqual([
        { browser: "Chrome", users: 500 },
        { browser: "Safari", users: 300 },
        { browser: "Firefox", users: 200 },
      ]);

      expect(result.operating_systems).toEqual([
        { operating_system: "Windows", users: 700 }, // 500 + 200
        { operating_system: "iOS", users: 300 },
      ]);
    });
  });

  describe("query", () => {
    it("should execute query and release client", async () => {
      const queryText = "SELECT * FROM analytics_events WHERE id = $1";
      const queryParams = ["123"];
      const mockResult = { rows: [{ id: "123" }] };

      mockClient.query.mockResolvedValueOnce(mockResult);

      const result = await timescaleService.query(queryText, queryParams);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(queryText, queryParams);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe("close", () => {
    it("should close the pool", async () => {
      await timescaleService.close();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});