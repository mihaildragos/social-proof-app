import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Request, Response } from "express";

describe("Campaigns Routes", () => {
  // Mock NotificationService
  const mockNotificationService = {
    getAllCampaigns: jest.fn() as jest.MockedFunction<any>,
    getCampaignsBySite: jest.fn() as jest.MockedFunction<any>,
    getCampaignById: jest.fn() as jest.MockedFunction<any>,
    createCampaign: jest.fn() as jest.MockedFunction<any>,
    updateCampaign: jest.fn() as jest.MockedFunction<any>,
    deleteCampaign: jest.fn() as jest.MockedFunction<any>,
    startCampaign: jest.fn() as jest.MockedFunction<any>,
    pauseCampaign: jest.fn() as jest.MockedFunction<any>,
    getCampaignStats: jest.fn() as jest.MockedFunction<any>,
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
  const mockReq = {
    user: {
      id: "user-123",
      organizationId: "org-123",
      role: "admin",
    },
    params: {},
    body: {},
    query: {},
  } as unknown as Request;

  // Campaigns route handler implementation
  class CampaignsRouteHandler {
    constructor(private notificationService = mockNotificationService) {}

    async getAllCampaigns(req: any, res: any) {
      try {
        const { user } = req as any;
        const { page = 1, limit = 20, status, search } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const campaigns = await this.notificationService.getAllCampaigns({
          organizationId: user.organizationId,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          status: status as string,
          search: search as string,
        });

        res.json({
          success: true,
          data: campaigns.data,
          pagination: campaigns.pagination,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getCampaignsBySite(req: any, res: any) {
      try {
        const { user } = req as any;
        const { siteId } = req.params;
        const { status } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!siteId) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        const campaigns = await this.notificationService.getCampaignsBySite({
          siteId,
          organizationId: user.organizationId,
          status: status as string,
        });

        res.json({
          success: true,
          data: campaigns,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getCampaignById(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        const campaign = await this.notificationService.getCampaignById(id, user.organizationId);

        if (!campaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        res.json({
          success: true,
          data: campaign,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async createCampaign(req: any, res: any) {
      try {
        const { user } = req as any;
        const campaignData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Validate required fields
        const requiredFields = ["name", "siteId", "templateId", "triggerEvent"];
        for (const field of requiredFields) {
          if (!campaignData[field]) {
            return res.status(400).json({
              error: `${field} is required`,
            });
          }
        }

        // Validate schedule if provided
        if (campaignData.schedule && !this.isValidSchedule(campaignData.schedule)) {
          return res.status(400).json({
            error: "Invalid schedule format",
          });
        }

        const campaign = await this.notificationService.createCampaign({
          ...campaignData,
          organizationId: user.organizationId,
          createdBy: user.id,
          status: "draft",
        });

        res.status(201).json({
          success: true,
          data: campaign,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Campaign with this name already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async updateCampaign(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const updateData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        // Check if campaign exists
        const existingCampaign = await this.notificationService.getCampaignById(id, user.organizationId);
        if (!existingCampaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingCampaign.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Prevent editing of active campaigns
        if (existingCampaign.status === "active" && updateData.status !== "paused") {
          return res.status(400).json({
            error: "Cannot edit active campaign. Pause it first.",
          });
        }

        // Validate schedule if being updated
        if (updateData.schedule && !this.isValidSchedule(updateData.schedule)) {
          return res.status(400).json({
            error: "Invalid schedule format",
          });
        }

        const campaign = await this.notificationService.updateCampaign(id, {
          ...updateData,
          updatedBy: user.id,
        });

        res.json({
          success: true,
          data: campaign,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async deleteCampaign(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        // Check if campaign exists
        const existingCampaign = await this.notificationService.getCampaignById(id, user.organizationId);
        if (!existingCampaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingCampaign.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Prevent deletion of active campaigns
        if (existingCampaign.status === "active") {
          return res.status(400).json({
            error: "Cannot delete active campaign. Pause it first.",
          });
        }

        await this.notificationService.deleteCampaign(id, user.organizationId);

        res.json({
          success: true,
          message: "Campaign deleted successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async startCampaign(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        // Check if campaign exists
        const existingCampaign = await this.notificationService.getCampaignById(id, user.organizationId);
        if (!existingCampaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingCampaign.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Check if campaign can be started
        if (existingCampaign.status === "active") {
          return res.status(400).json({
            error: "Campaign is already active",
          });
        }

        if (existingCampaign.status === "completed") {
          return res.status(400).json({
            error: "Cannot start completed campaign",
          });
        }

        const campaign = await this.notificationService.startCampaign(id, user.id);

        res.json({
          success: true,
          data: campaign,
          message: "Campaign started successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async pauseCampaign(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        // Check if campaign exists
        const existingCampaign = await this.notificationService.getCampaignById(id, user.organizationId);
        if (!existingCampaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingCampaign.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Check if campaign can be paused
        if (existingCampaign.status !== "active") {
          return res.status(400).json({
            error: "Only active campaigns can be paused",
          });
        }

        const campaign = await this.notificationService.pauseCampaign(id, user.id);

        res.json({
          success: true,
          data: campaign,
          message: "Campaign paused successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getCampaignStats(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const { timeRange = "24h" } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Campaign ID is required" });
        }

        // Check if campaign exists
        const existingCampaign = await this.notificationService.getCampaignById(id, user.organizationId);
        if (!existingCampaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }

        const stats = await this.notificationService.getCampaignStats(id, timeRange as string);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    private isValidSchedule(schedule: any): boolean {
      if (!schedule || typeof schedule !== "object") {
        return false;
      }

      // Check for required schedule fields
      if (schedule.type === "once") {
        return schedule.datetime && new Date(schedule.datetime) > new Date();
      }

      if (schedule.type === "recurring") {
        return schedule.frequency && ["daily", "weekly", "monthly"].includes(schedule.frequency);
      }

      return false;
    }
  }

  let routeHandler: CampaignsRouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock response chain
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
    mockRes.send.mockReturnValue(mockRes);
    
    routeHandler = new CampaignsRouteHandler();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("GET /", () => {
    it("should get all campaigns for organization", async () => {
      const mockCampaigns = {
        data: [
          {
            id: "campaign-1",
            name: "Summer Sale Campaign",
            status: "active",
            triggerEvent: "purchase",
          },
          {
            id: "campaign-2",
            name: "Welcome Campaign",
            status: "draft",
            triggerEvent: "signup",
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1,
        },
      };

      mockNotificationService.getAllCampaigns.mockResolvedValue(mockCampaigns);

      await routeHandler.getAllCampaigns(mockReq, mockRes);

      expect(mockNotificationService.getAllCampaigns).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 1,
        limit: 20,
        status: undefined,
        search: undefined,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCampaigns.data,
        pagination: mockCampaigns.pagination,
      });
    });

    it("should handle filter parameters", async () => {
      const reqWithFilters = {
        ...mockReq,
        query: { status: "active", search: "sale", page: "2", limit: "10" },
      };

      mockNotificationService.getAllCampaigns.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 0, pages: 0 },
      });

      await routeHandler.getAllCampaigns(reqWithFilters, mockRes);

      expect(mockNotificationService.getAllCampaigns).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 2,
        limit: 10,
        status: "active",
        search: "sale",
      });
    });
  });

  describe("POST /", () => {
    it("should create new campaign", async () => {
      const campaignData = {
        name: "New Campaign",
        siteId: "site-123",
        templateId: "template-123",
        triggerEvent: "purchase",
        targetingRules: {
          audience: "all",
        },
      };

      const createdCampaign = {
        id: "campaign-new",
        ...campaignData,
        organizationId: "org-123",
        createdBy: "user-123",
        status: "draft",
      };

      const reqWithBody = {
        ...mockReq,
        body: campaignData,
      };

      mockNotificationService.createCampaign.mockResolvedValue(createdCampaign);

      await routeHandler.createCampaign(reqWithBody, mockRes);

      expect(mockNotificationService.createCampaign).toHaveBeenCalledWith({
        ...campaignData,
        organizationId: "org-123",
        createdBy: "user-123",
        status: "draft",
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdCampaign,
      });
    });

    it("should validate required fields", async () => {
      const invalidCampaignData = {
        name: "Test Campaign",
        // Missing siteId, templateId, triggerEvent
      };

      const reqWithInvalidBody = {
        ...mockReq,
        body: invalidCampaignData,
      };

      await routeHandler.createCampaign(reqWithInvalidBody, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "siteId is required",
      });
    });

    it("should validate schedule format", async () => {
      const campaignWithInvalidSchedule = {
        name: "Scheduled Campaign",
        siteId: "site-123",
        templateId: "template-123",
        triggerEvent: "purchase",
        schedule: {
          type: "invalid",
        },
      };

      const reqWithInvalidSchedule = {
        ...mockReq,
        body: campaignWithInvalidSchedule,
      };

      await routeHandler.createCampaign(reqWithInvalidSchedule, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid schedule format",
      });
    });
  });

  describe("POST /:id/start", () => {
    it("should start draft campaign", async () => {
      const draftCampaign = {
        id: "campaign-123",
        name: "Test Campaign",
        status: "draft",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const activeCampaign = {
        ...draftCampaign,
        status: "active",
        startedAt: new Date(),
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(draftCampaign);
      mockNotificationService.startCampaign.mockResolvedValue(activeCampaign);

      await routeHandler.startCampaign(reqWithId, mockRes);

      expect(mockNotificationService.startCampaign).toHaveBeenCalledWith(
        "campaign-123",
        "user-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: activeCampaign,
        message: "Campaign started successfully",
      });
    });

    it("should not start already active campaign", async () => {
      const activeCampaign = {
        id: "campaign-123",
        status: "active",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(activeCampaign);

      await routeHandler.startCampaign(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Campaign is already active",
      });
    });

    it("should not start completed campaign", async () => {
      const completedCampaign = {
        id: "campaign-123",
        status: "completed",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(completedCampaign);

      await routeHandler.startCampaign(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Cannot start completed campaign",
      });
    });
  });

  describe("POST /:id/pause", () => {
    it("should pause active campaign", async () => {
      const activeCampaign = {
        id: "campaign-123",
        name: "Test Campaign",
        status: "active",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const pausedCampaign = {
        ...activeCampaign,
        status: "paused",
        pausedAt: new Date(),
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(activeCampaign);
      mockNotificationService.pauseCampaign.mockResolvedValue(pausedCampaign);

      await routeHandler.pauseCampaign(reqWithId, mockRes);

      expect(mockNotificationService.pauseCampaign).toHaveBeenCalledWith(
        "campaign-123",
        "user-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: pausedCampaign,
        message: "Campaign paused successfully",
      });
    });

    it("should not pause non-active campaign", async () => {
      const draftCampaign = {
        id: "campaign-123",
        status: "draft",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(draftCampaign);

      await routeHandler.pauseCampaign(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Only active campaigns can be paused",
      });
    });
  });

  describe("PUT /:id", () => {
    it("should prevent editing active campaign", async () => {
      const activeCampaign = {
        id: "campaign-123",
        status: "active",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithUpdate = {
        ...mockReq,
        params: { id: "campaign-123" },
        body: { name: "Updated Campaign" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(activeCampaign);

      await routeHandler.updateCampaign(reqWithUpdate, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Cannot edit active campaign. Pause it first.",
      });
    });
  });

  describe("DELETE /:id", () => {
    it("should prevent deletion of active campaign", async () => {
      const activeCampaign = {
        id: "campaign-123",
        status: "active",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "campaign-123" },
      };

      mockNotificationService.getCampaignById.mockResolvedValue(activeCampaign);

      await routeHandler.deleteCampaign(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Cannot delete active campaign. Pause it first.",
      });
    });
  });

  describe("GET /:id/stats", () => {
    it("should get campaign statistics", async () => {
      const mockStats = {
        totalNotifications: 50,
        delivered: 45,
        clicked: 10,
        conversionRate: 0.22,
        trends: {
          hourly: [1, 2, 3, 4, 5],
        },
      };

      const reqWithStats = {
        ...mockReq,
        params: { id: "campaign-123" },
        query: { timeRange: "7d" },
      };

      const existingCampaign = {
        id: "campaign-123",
        organizationId: "org-123",
      };

      mockNotificationService.getCampaignById.mockResolvedValue(existingCampaign);
      mockNotificationService.getCampaignStats.mockResolvedValue(mockStats);

      await routeHandler.getCampaignStats(reqWithStats, mockRes);

      expect(mockNotificationService.getCampaignStats).toHaveBeenCalledWith(
        "campaign-123",
        "7d"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });
});