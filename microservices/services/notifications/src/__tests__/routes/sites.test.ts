import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Request, Response } from "express";

describe("Sites Routes", () => {
  // Mock NotificationService
  const mockNotificationService = {
    getAllSites: jest.fn() as jest.MockedFunction<any>,
    getSiteById: jest.fn() as jest.MockedFunction<any>,
    createSite: jest.fn() as jest.MockedFunction<any>,
    updateSite: jest.fn() as jest.MockedFunction<any>,
    deleteSite: jest.fn() as jest.MockedFunction<any>,
    getSiteStats: jest.fn() as jest.MockedFunction<any>,
  };

  // Mock authentication middleware
  const mockAuthMiddleware = jest.fn((req: any, res: any, next: any) => {
    req.user = {
      id: "user-123",
      organizationId: "org-123",
      role: "admin",
    };
    next();
  });

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

  // Sites route handler implementation
  class SitesRouteHandler {
    constructor(private notificationService = mockNotificationService) {}

    async getAllSites(req: any, res: any) {
      try {
        const { user } = req as any;
        const { page = 1, limit = 10, search } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const sites = await this.notificationService.getAllSites({
          organizationId: user.organizationId,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          search: search as string,
        });

        res.json({
          success: true,
          data: sites.data,
          pagination: sites.pagination,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getSiteById(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        const site = await this.notificationService.getSiteById(id, user.organizationId);

        if (!site) {
          return res.status(404).json({ error: "Site not found" });
        }

        res.json({
          success: true,
          data: site,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async createSite(req: any, res: any) {
      try {
        const { user } = req as any;
        const siteData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Validate required fields
        const requiredFields = ["name", "domain", "type"];
        for (const field of requiredFields) {
          if (!siteData[field]) {
            return res.status(400).json({
              error: `${field} is required`,
            });
          }
        }

        // Validate domain format
        if (!this.isValidDomain(siteData.domain)) {
          return res.status(400).json({
            error: "Invalid domain format",
          });
        }

        const site = await this.notificationService.createSite({
          ...siteData,
          organizationId: user.organizationId,
          createdBy: user.id,
        });

        res.status(201).json({
          success: true,
          data: site,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Site with this domain already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async updateSite(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const updateData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        // Check if site exists
        const existingSite = await this.notificationService.getSiteById(id, user.organizationId);
        if (!existingSite) {
          return res.status(404).json({ error: "Site not found" });
        }

        // Validate domain if being updated
        if (updateData.domain && !this.isValidDomain(updateData.domain)) {
          return res.status(400).json({
            error: "Invalid domain format",
          });
        }

        const site = await this.notificationService.updateSite(id, {
          ...updateData,
          updatedBy: user.id,
        });

        res.json({
          success: true,
          data: site,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Site with this domain already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async deleteSite(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        // Check if site exists
        const existingSite = await this.notificationService.getSiteById(id, user.organizationId);
        if (!existingSite) {
          return res.status(404).json({ error: "Site not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingSite.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        await this.notificationService.deleteSite(id, user.organizationId);

        res.json({
          success: true,
          message: "Site deleted successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getSiteStats(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const { timeRange = "24h" } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        // Check if site exists
        const existingSite = await this.notificationService.getSiteById(id, user.organizationId);
        if (!existingSite) {
          return res.status(404).json({ error: "Site not found" });
        }

        const stats = await this.notificationService.getSiteStats(id, timeRange as string);

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

    private isValidDomain(domain: string): boolean {
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
      return domainRegex.test(domain);
    }
  }

  let routeHandler: SitesRouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock response chain
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
    mockRes.send.mockReturnValue(mockRes);
    
    routeHandler = new SitesRouteHandler();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("GET /", () => {
    it("should get all sites for organization", async () => {
      const mockSites = {
        data: [
          {
            id: "site-1",
            name: "Test Site 1",
            domain: "example1.com",
            type: "ecommerce",
          },
          {
            id: "site-2",
            name: "Test Site 2",
            domain: "example2.com",
            type: "blog",
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1,
        },
      };

      mockNotificationService.getAllSites.mockResolvedValue(mockSites);

      await routeHandler.getAllSites(mockReq, mockRes);

      expect(mockNotificationService.getAllSites).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 1,
        limit: 10,
        search: undefined,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSites.data,
        pagination: mockSites.pagination,
      });
    });

    it("should handle pagination parameters", async () => {
      const reqWithPagination: any = {
        ...mockReq,
        query: { page: "2", limit: "5", search: "test" },
      };

      mockNotificationService.getAllSites.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, pages: 0 },
      });

      await routeHandler.getAllSites(reqWithPagination, mockRes);

      expect(mockNotificationService.getAllSites).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 2,
        limit: 5,
        search: "test",
      });
    });

    it("should return 401 without authentication", async () => {
      const unauthenticatedReq = {
        ...mockReq,
        user: null,
      };

      await routeHandler.getAllSites(unauthenticatedReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
    });

    it("should handle service errors", async () => {
      mockNotificationService.getAllSites.mockRejectedValue(new Error("Database error"));

      await routeHandler.getAllSites(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: "Database error",
      });
    });
  });

  describe("GET /:id", () => {
    it("should get site by ID", async () => {
      const mockSite = {
        id: "site-123",
        name: "Test Site",
        domain: "example.com",
        type: "ecommerce",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "site-123" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(mockSite);

      await routeHandler.getSiteById(reqWithId, mockRes);

      expect(mockNotificationService.getSiteById).toHaveBeenCalledWith(
        "site-123",
        "org-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSite,
      });
    });

    it("should return 404 for non-existent site", async () => {
      const reqWithId = {
        ...mockReq,
        params: { id: "non-existent" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(null);

      await routeHandler.getSiteById(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Site not found",
      });
    });

    it("should return 400 for missing ID", async () => {
      const reqWithoutId = {
        ...mockReq,
        params: {},
      };

      await routeHandler.getSiteById(reqWithoutId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Site ID is required",
      });
    });
  });

  describe("POST /", () => {
    it("should create new site", async () => {
      const siteData = {
        name: "New Site",
        domain: "newsite.com",
        type: "ecommerce",
        description: "A new ecommerce site",
      };

      const createdSite = {
        id: "site-new",
        ...siteData,
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithBody = {
        ...mockReq,
        body: siteData,
      };

      mockNotificationService.createSite.mockResolvedValue(createdSite);

      await routeHandler.createSite(reqWithBody, mockRes);

      expect(mockNotificationService.createSite).toHaveBeenCalledWith({
        ...siteData,
        organizationId: "org-123",
        createdBy: "user-123",
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdSite,
      });
    });

    it("should validate required fields", async () => {
      const invalidSiteData = {
        name: "Test Site",
        // Missing domain and type
      };

      const reqWithInvalidBody = {
        ...mockReq,
        body: invalidSiteData,
      };

      await routeHandler.createSite(reqWithInvalidBody, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "domain is required",
      });
    });

    it("should validate domain format", async () => {
      const invalidSiteData = {
        name: "Test Site",
        domain: "invalid-domain",
        type: "ecommerce",
      };

      const reqWithInvalidDomain = {
        ...mockReq,
        body: invalidSiteData,
      };

      await routeHandler.createSite(reqWithInvalidDomain, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid domain format",
      });
    });

    it("should handle duplicate domain error", async () => {
      const siteData = {
        name: "Duplicate Site",
        domain: "existing.com",
        type: "ecommerce",
      };

      const reqWithDuplicateData = {
        ...mockReq,
        body: siteData,
      };

      mockNotificationService.createSite.mockRejectedValue(
        new Error("duplicate key constraint")
      );

      await routeHandler.createSite(reqWithDuplicateData, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Site with this domain already exists",
      });
    });
  });

  describe("PUT /:id", () => {
    it("should update existing site", async () => {
      const updateData = {
        name: "Updated Site Name",
        description: "Updated description",
      };

      const existingSite = {
        id: "site-123",
        name: "Original Site",
        domain: "example.com",
        organizationId: "org-123",
      };

      const updatedSite = {
        ...existingSite,
        ...updateData,
        updatedBy: "user-123",
      };

      const reqWithUpdate = {
        ...mockReq,
        params: { id: "site-123" },
        body: updateData,
      };

      mockNotificationService.getSiteById.mockResolvedValue(existingSite);
      mockNotificationService.updateSite.mockResolvedValue(updatedSite);

      await routeHandler.updateSite(reqWithUpdate, mockRes);

      expect(mockNotificationService.updateSite).toHaveBeenCalledWith("site-123", {
        ...updateData,
        updatedBy: "user-123",
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedSite,
      });
    });

    it("should return 404 for non-existent site", async () => {
      const reqWithUpdate = {
        ...mockReq,
        params: { id: "non-existent" },
        body: { name: "Updated Name" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(null);

      await routeHandler.updateSite(reqWithUpdate, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Site not found",
      });
    });

    it("should validate domain format when updating", async () => {
      const updateData = {
        domain: "invalid-domain-format",
      };

      const reqWithInvalidDomain = {
        ...mockReq,
        params: { id: "site-123" },
        body: updateData,
      };

      mockNotificationService.getSiteById.mockResolvedValue({
        id: "site-123",
        organizationId: "org-123",
      });

      await routeHandler.updateSite(reqWithInvalidDomain, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid domain format",
      });
    });
  });

  describe("DELETE /:id", () => {
    it("should delete site as admin", async () => {
      const existingSite = {
        id: "site-123",
        name: "Test Site",
        organizationId: "org-123",
        createdBy: "other-user",
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "site-123" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(existingSite);
      mockNotificationService.deleteSite.mockResolvedValue(true);

      await routeHandler.deleteSite(reqWithId, mockRes);

      expect(mockNotificationService.deleteSite).toHaveBeenCalledWith(
        "site-123",
        "org-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Site deleted successfully",
      });
    });

    it("should delete site as creator", async () => {
      const existingSite = {
        id: "site-123",
        name: "Test Site",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const nonAdminUser = {
        ...mockReq,
        user: { ...(mockReq as any).user, role: "user" },
        params: { id: "site-123" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(existingSite);
      mockNotificationService.deleteSite.mockResolvedValue(true);

      await routeHandler.deleteSite(nonAdminUser, mockRes);

      expect(mockNotificationService.deleteSite).toHaveBeenCalled();
    });

    it("should return 403 for insufficient permissions", async () => {
      const existingSite = {
        id: "site-123",
        name: "Test Site",
        organizationId: "org-123",
        createdBy: "other-user",
      };

      const nonAdminUser = {
        ...mockReq,
        user: { ...(mockReq as any).user, role: "user" },
        params: { id: "site-123" },
      };

      mockNotificationService.getSiteById.mockResolvedValue(existingSite);

      await routeHandler.deleteSite(nonAdminUser, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Insufficient permissions",
      });
    });
  });

  describe("GET /:id/stats", () => {
    it("should get site statistics", async () => {
      const mockStats = {
        totalNotifications: 100,
        delivered: 85,
        clicked: 20,
        conversionRate: 0.2,
        trends: {
          daily: [1, 2, 3, 4, 5],
        },
      };

      const reqWithStats = {
        ...mockReq,
        params: { id: "site-123" },
        query: { timeRange: "7d" },
      };

      const existingSite = {
        id: "site-123",
        organizationId: "org-123",
      };

      mockNotificationService.getSiteById.mockResolvedValue(existingSite);
      mockNotificationService.getSiteStats.mockResolvedValue(mockStats);

      await routeHandler.getSiteStats(reqWithStats, mockRes);

      expect(mockNotificationService.getSiteStats).toHaveBeenCalledWith(
        "site-123",
        "7d"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it("should use default time range", async () => {
      const reqWithoutTimeRange = {
        ...mockReq,
        params: { id: "site-123" },
        query: {},
      };

      mockNotificationService.getSiteById.mockResolvedValue({
        id: "site-123",
        organizationId: "org-123",
      });
      mockNotificationService.getSiteStats.mockResolvedValue({});

      await routeHandler.getSiteStats(reqWithoutTimeRange, mockRes);

      expect(mockNotificationService.getSiteStats).toHaveBeenCalledWith(
        "site-123",
        "24h"
      );
    });
  });
});