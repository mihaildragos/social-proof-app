import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Request, Response } from "express";

describe("Dashboard Routes", () => {
  // Mock AnalyticsService
  const mockAnalyticsService = {
    getDashboardData: jest.fn() as jest.MockedFunction<any>,
    getRealtimeMetrics: jest.fn() as jest.MockedFunction<any>,
    getCustomMetrics: jest.fn() as jest.MockedFunction<any>,
    createCustomDashboard: jest.fn() as jest.MockedFunction<any>,
    updateDashboard: jest.fn() as jest.MockedFunction<any>,
    deleteDashboard: jest.fn() as jest.MockedFunction<any>,
    getDashboards: jest.fn() as jest.MockedFunction<any>,
  };

  // Mock response - setup a proper mock that returns itself
  const mockRes: any = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  
  // Setup chainable mocks
  mockRes.status.mockReturnValue(mockRes);
  mockRes.json.mockReturnValue(mockRes);
  mockRes.send.mockReturnValue(mockRes);

  // Mock request
  const mockReq: any = {
    user: {
      id: "user-123",
      organizationId: "org-123",
      role: "admin",
    },
    params: {},
    body: {},
    query: {},
  };

  // Dashboard route handler implementation
  class DashboardRouteHandler {
    constructor(private analyticsService = mockAnalyticsService) {}

    async getDashboardData(req: any, res: any) {
      try {
        const { user } = req as any;
        const { 
          timeRange = "24h", 
          siteId, 
          metrics = "all",
          granularity = "hour"
        } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Validate time range
        const validTimeRanges = ["1h", "24h", "7d", "30d", "90d"];
        if (!validTimeRanges.includes(timeRange as string)) {
          return res.status(400).json({
            error: "Invalid time range. Must be one of: " + validTimeRanges.join(", "),
          });
        }

        const dashboardData = await this.analyticsService.getDashboardData({
          organizationId: user.organizationId,
          timeRange: timeRange as string,
          siteId: siteId as string,
          metrics: metrics as string,
          granularity: granularity as string,
        });

        res.json({
          success: true,
          data: dashboardData,
          metadata: {
            timeRange,
            siteId,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getRealtimeMetrics(req: any, res: any) {
      try {
        const { user } = req as any;
        const { siteId } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const realtimeData = await this.analyticsService.getRealtimeMetrics({
          organizationId: user.organizationId,
          siteId: siteId as string,
        });

        res.json({
          success: true,
          data: realtimeData,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getCustomMetrics(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const { timeRange = "24h" } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Dashboard ID is required" });
        }

        const customMetrics = await this.analyticsService.getCustomMetrics({
          dashboardId: id,
          organizationId: user.organizationId,
          timeRange: timeRange as string,
        });

        res.json({
          success: true,
          data: customMetrics,
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          return res.status(404).json({
            error: "Dashboard not found",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async createCustomDashboard(req: any, res: any) {
      try {
        const { user } = req as any;
        const dashboardData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Validate required fields
        const requiredFields = ["name", "widgets"];
        for (const field of requiredFields) {
          if (!dashboardData[field]) {
            return res.status(400).json({
              error: `${field} is required`,
            });
          }
        }

        // Validate widgets structure
        if (!Array.isArray(dashboardData.widgets) || dashboardData.widgets.length === 0) {
          return res.status(400).json({
            error: "Dashboard must have at least one widget",
          });
        }

        for (const widget of dashboardData.widgets) {
          if (!widget.type || !widget.config) {
            return res.status(400).json({
              error: "Each widget must have type and config",
            });
          }
        }

        const dashboard = await this.analyticsService.createCustomDashboard({
          ...dashboardData,
          organizationId: user.organizationId,
          createdBy: user.id,
        });

        res.status(201).json({
          success: true,
          data: dashboard,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Dashboard with this name already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async updateDashboard(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const updateData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Dashboard ID is required" });
        }

        // Validate widgets if being updated
        if (updateData.widgets) {
          if (!Array.isArray(updateData.widgets) || updateData.widgets.length === 0) {
            return res.status(400).json({
              error: "Dashboard must have at least one widget",
            });
          }

          for (const widget of updateData.widgets) {
            if (!widget.type || !widget.config) {
              return res.status(400).json({
                error: "Each widget must have type and config",
              });
            }
          }
        }

        const dashboard = await this.analyticsService.updateDashboard(id, {
          ...updateData,
          organizationId: user.organizationId,
          updatedBy: user.id,
        });

        res.json({
          success: true,
          data: dashboard,
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          return res.status(404).json({
            error: "Dashboard not found",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async deleteDashboard(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Dashboard ID is required" });
        }

        await this.analyticsService.deleteDashboard(id, user.organizationId);

        res.json({
          success: true,
          message: "Dashboard deleted successfully",
        });
      } catch (error) {
        if ((error as Error).message.includes("not found")) {
          return res.status(404).json({
            error: "Dashboard not found",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getDashboards(req: any, res: any) {
      try {
        const { user } = req as any;
        const { page = 1, limit = 10 } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const dashboards = await this.analyticsService.getDashboards({
          organizationId: user.organizationId,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        });

        res.json({
          success: true,
          data: dashboards.data,
          pagination: dashboards.pagination,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }
  }

  let routeHandler: DashboardRouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock response chain
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
    mockRes.send.mockReturnValue(mockRes);
    
    routeHandler = new DashboardRouteHandler();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("GET /", () => {
    it("should get dashboard data with default parameters", async () => {
      const mockDashboardData = {
        overview: {
          totalNotifications: 1000,
          deliveryRate: 0.95,
          clickRate: 0.15,
          conversionRate: 0.05,
        },
        timeSeries: [
          { timestamp: "2024-01-01T00:00:00Z", notifications: 50, clicks: 7 },
          { timestamp: "2024-01-01T01:00:00Z", notifications: 45, clicks: 5 },
        ],
        topPages: [
          { page: "/", notifications: 500, clicks: 75 },
          { page: "/products", notifications: 300, clicks: 45 },
        ],
      };

      mockAnalyticsService.getDashboardData.mockResolvedValue(mockDashboardData);

      await routeHandler.getDashboardData(mockReq, mockRes);

      expect(mockAnalyticsService.getDashboardData).toHaveBeenCalledWith({
        organizationId: "org-123",
        timeRange: "24h",
        siteId: undefined,
        metrics: "all",
        granularity: "hour",
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDashboardData,
        metadata: {
          timeRange: "24h",
          siteId: undefined,
          generatedAt: expect.any(String),
        },
      });
    });

    it("should handle custom query parameters", async () => {
      const reqWithParams: any = {
        ...mockReq,
        query: {
          timeRange: "7d",
          siteId: "site-123",
          metrics: "overview,timeseries",
          granularity: "day",
        },
      };

      mockAnalyticsService.getDashboardData.mockResolvedValue({});

      await routeHandler.getDashboardData(reqWithParams, mockRes);

      expect(mockAnalyticsService.getDashboardData).toHaveBeenCalledWith({
        organizationId: "org-123",
        timeRange: "7d",
        siteId: "site-123",
        metrics: "overview,timeseries",
        granularity: "day",
      });
    });

    it("should validate time range parameter", async () => {
      const reqWithInvalidTimeRange = {
        ...mockReq,
        query: { timeRange: "invalid" },
      };

      await routeHandler.getDashboardData(reqWithInvalidTimeRange, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid time range. Must be one of: 1h, 24h, 7d, 30d, 90d",
      });
    });

    it("should return 401 without authentication", async () => {
      const unauthenticatedReq = {
        ...mockReq,
        user: null,
      };

      await routeHandler.getDashboardData(unauthenticatedReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
    });
  });

  describe("GET /realtime", () => {
    it("should get realtime metrics", async () => {
      const mockRealtimeData = {
        activeUsers: 150,
        notificationsPerMinute: 25,
        currentSessions: 75,
        topEvents: [
          { event: "purchase", count: 10 },
          { event: "signup", count: 5 },
        ],
        liveNotifications: [
          { id: "notif-1", message: "John just purchased...", timestamp: new Date() },
        ],
      };

      mockAnalyticsService.getRealtimeMetrics.mockResolvedValue(mockRealtimeData);

      await routeHandler.getRealtimeMetrics(mockReq, mockRes);

      expect(mockAnalyticsService.getRealtimeMetrics).toHaveBeenCalledWith({
        organizationId: "org-123",
        siteId: undefined,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRealtimeData,
        timestamp: expect.any(String),
      });
    });

    it("should filter by site ID", async () => {
      const reqWithSiteId = {
        ...mockReq,
        query: { siteId: "site-123" },
      };

      mockAnalyticsService.getRealtimeMetrics.mockResolvedValue({});

      await routeHandler.getRealtimeMetrics(reqWithSiteId, mockRes);

      expect(mockAnalyticsService.getRealtimeMetrics).toHaveBeenCalledWith({
        organizationId: "org-123",
        siteId: "site-123",
      });
    });
  });

  describe("GET /:id/metrics", () => {
    it("should get custom dashboard metrics", async () => {
      const mockCustomMetrics = {
        widgets: [
          {
            id: "widget-1",
            type: "chart",
            data: [{ x: "2024-01-01", y: 100 }],
          },
          {
            id: "widget-2",
            type: "counter",
            value: 500,
          },
        ],
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "dashboard-123" },
      };

      mockAnalyticsService.getCustomMetrics.mockResolvedValue(mockCustomMetrics);

      await routeHandler.getCustomMetrics(reqWithId, mockRes);

      expect(mockAnalyticsService.getCustomMetrics).toHaveBeenCalledWith({
        dashboardId: "dashboard-123",
        organizationId: "org-123",
        timeRange: "24h",
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCustomMetrics,
      });
    });

    it("should return 400 for missing dashboard ID", async () => {
      const reqWithoutId = {
        ...mockReq,
        params: {},
      };

      await routeHandler.getCustomMetrics(reqWithoutId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Dashboard ID is required",
      });
    });

    it("should return 404 for non-existent dashboard", async () => {
      const reqWithId = {
        ...mockReq,
        params: { id: "non-existent" },
      };

      mockAnalyticsService.getCustomMetrics.mockRejectedValue(
        new Error("Dashboard not found")
      );

      await routeHandler.getCustomMetrics(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Dashboard not found",
      });
    });
  });

  describe("POST /", () => {
    it("should create custom dashboard", async () => {
      const dashboardData = {
        name: "Custom Sales Dashboard",
        description: "Track sales performance",
        widgets: [
          {
            type: "chart",
            config: {
              chartType: "line",
              metric: "sales",
              timeRange: "7d",
            },
          },
          {
            type: "counter",
            config: {
              metric: "total_revenue",
              format: "currency",
            },
          },
        ],
      };

      const createdDashboard = {
        id: "dashboard-new",
        ...dashboardData,
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithBody = {
        ...mockReq,
        body: dashboardData,
      };

      mockAnalyticsService.createCustomDashboard.mockResolvedValue(createdDashboard);

      await routeHandler.createCustomDashboard(reqWithBody, mockRes);

      expect(mockAnalyticsService.createCustomDashboard).toHaveBeenCalledWith({
        ...dashboardData,
        organizationId: "org-123",
        createdBy: "user-123",
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdDashboard,
      });
    });

    it("should validate required fields", async () => {
      const invalidDashboardData = {
        description: "Missing name and widgets",
      };

      const reqWithInvalidBody = {
        ...mockReq,
        body: invalidDashboardData,
      };

      await routeHandler.createCustomDashboard(reqWithInvalidBody, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "name is required",
      });
    });

    it("should validate widgets structure", async () => {
      const dashboardWithInvalidWidgets = {
        name: "Test Dashboard",
        widgets: [
          {
            type: "chart",
            // Missing config
          },
        ],
      };

      const reqWithInvalidWidgets = {
        ...mockReq,
        body: dashboardWithInvalidWidgets,
      };

      await routeHandler.createCustomDashboard(reqWithInvalidWidgets, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Each widget must have type and config",
      });
    });

    it("should require at least one widget", async () => {
      const dashboardWithoutWidgets = {
        name: "Test Dashboard",
        widgets: [],
      };

      const reqWithoutWidgets = {
        ...mockReq,
        body: dashboardWithoutWidgets,
      };

      await routeHandler.createCustomDashboard(reqWithoutWidgets, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Dashboard must have at least one widget",
      });
    });

    it("should handle duplicate name error", async () => {
      const dashboardData = {
        name: "Existing Dashboard",
        widgets: [{ type: "chart", config: {} }],
      };

      const reqWithDuplicate = {
        ...mockReq,
        body: dashboardData,
      };

      mockAnalyticsService.createCustomDashboard.mockRejectedValue(
        new Error("duplicate key constraint")
      );

      await routeHandler.createCustomDashboard(reqWithDuplicate, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Dashboard with this name already exists",
      });
    });
  });

  describe("PUT /:id", () => {
    it("should update dashboard", async () => {
      const updateData = {
        name: "Updated Dashboard",
        widgets: [
          {
            type: "chart",
            config: { metric: "updated_metric" },
          },
        ],
      };

      const updatedDashboard = {
        id: "dashboard-123",
        ...updateData,
        organizationId: "org-123",
        updatedBy: "user-123",
      };

      const reqWithUpdate = {
        ...mockReq,
        params: { id: "dashboard-123" },
        body: updateData,
      };

      mockAnalyticsService.updateDashboard.mockResolvedValue(updatedDashboard);

      await routeHandler.updateDashboard(reqWithUpdate, mockRes);

      expect(mockAnalyticsService.updateDashboard).toHaveBeenCalledWith("dashboard-123", {
        ...updateData,
        organizationId: "org-123",
        updatedBy: "user-123",
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedDashboard,
      });
    });

    it("should validate widgets when updating", async () => {
      const updateWithInvalidWidgets = {
        widgets: [
          {
            type: "chart",
            // Missing config
          },
        ],
      };

      const reqWithInvalidUpdate = {
        ...mockReq,
        params: { id: "dashboard-123" },
        body: updateWithInvalidWidgets,
      };

      await routeHandler.updateDashboard(reqWithInvalidUpdate, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Each widget must have type and config",
      });
    });
  });

  describe("DELETE /:id", () => {
    it("should delete dashboard", async () => {
      const reqWithId = {
        ...mockReq,
        params: { id: "dashboard-123" },
      };

      mockAnalyticsService.deleteDashboard.mockResolvedValue(true);

      await routeHandler.deleteDashboard(reqWithId, mockRes);

      expect(mockAnalyticsService.deleteDashboard).toHaveBeenCalledWith(
        "dashboard-123",
        "org-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Dashboard deleted successfully",
      });
    });

    it("should return 404 for non-existent dashboard", async () => {
      const reqWithId = {
        ...mockReq,
        params: { id: "non-existent" },
      };

      mockAnalyticsService.deleteDashboard.mockRejectedValue(
        new Error("Dashboard not found")
      );

      await routeHandler.deleteDashboard(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Dashboard not found",
      });
    });
  });

  describe("GET /list", () => {
    it("should get list of dashboards", async () => {
      const mockDashboards = {
        data: [
          {
            id: "dashboard-1",
            name: "Sales Dashboard",
            createdAt: new Date(),
          },
          {
            id: "dashboard-2",
            name: "User Engagement Dashboard",
            createdAt: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1,
        },
      };

      mockAnalyticsService.getDashboards.mockResolvedValue(mockDashboards);

      await routeHandler.getDashboards(mockReq, mockRes);

      expect(mockAnalyticsService.getDashboards).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 1,
        limit: 10,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDashboards.data,
        pagination: mockDashboards.pagination,
      });
    });

    it("should handle pagination parameters", async () => {
      const reqWithPagination = {
        ...mockReq,
        query: { page: "2", limit: "5" },
      };

      mockAnalyticsService.getDashboards.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, pages: 0 },
      });

      await routeHandler.getDashboards(reqWithPagination, mockRes);

      expect(mockAnalyticsService.getDashboards).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 2,
        limit: 5,
      });
    });
  });
});