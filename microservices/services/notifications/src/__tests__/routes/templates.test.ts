import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Request, Response } from "express";

describe("Templates Routes", () => {
  // Mock NotificationService
  const mockNotificationService = {
    getAllTemplates: jest.fn() as jest.MockedFunction<any>,
    getTemplatesBySite: jest.fn() as jest.MockedFunction<any>,
    getTemplateById: jest.fn() as jest.MockedFunction<any>,
    createTemplate: jest.fn() as jest.MockedFunction<any>,
    updateTemplate: jest.fn() as jest.MockedFunction<any>,
    deleteTemplate: jest.fn() as jest.MockedFunction<any>,
    duplicateTemplate: jest.fn() as jest.MockedFunction<any>,
  };

  // Mock TemplateService
  const mockTemplateService = {
    validateTemplate: jest.fn() as jest.MockedFunction<any>,
    renderTemplate: jest.fn() as jest.MockedFunction<any>,
    getDefaultTemplates: jest.fn() as jest.MockedFunction<any>,
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

  // Templates route handler implementation
  class TemplatesRouteHandler {
    constructor(
      private notificationService = mockNotificationService,
      private templateService = mockTemplateService
    ) {}

    async getAllTemplates(req: any, res: any) {
      try {
        const { user } = req as any;
        const { page = 1, limit = 20, category, search } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const templates = await this.notificationService.getAllTemplates({
          organizationId: user.organizationId,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          category: category as string,
          search: search as string,
        });

        res.json({
          success: true,
          data: templates.data,
          pagination: templates.pagination,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getTemplatesBySite(req: any, res: any) {
      try {
        const { user } = req as any;
        const { siteId } = req.params;
        const { active } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!siteId) {
          return res.status(400).json({ error: "Site ID is required" });
        }

        const templates = await this.notificationService.getTemplatesBySite({
          siteId,
          organizationId: user.organizationId,
          activeOnly: active === "true",
        });

        res.json({
          success: true,
          data: templates,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async getTemplateById(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Template ID is required" });
        }

        const template = await this.notificationService.getTemplateById(id, user.organizationId);

        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }

        res.json({
          success: true,
          data: template,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async createTemplate(req: any, res: any) {
      try {
        const { user } = req as any;
        const templateData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Validate required fields
        const requiredFields = ["name", "content", "type", "siteId"];
        for (const field of requiredFields) {
          if (!templateData[field]) {
            return res.status(400).json({
              error: `${field} is required`,
            });
          }
        }

        // Validate template content
        const validation = await this.templateService.validateTemplate(templateData.content);
        if (!validation.valid) {
          return res.status(400).json({
            error: "Invalid template content",
            details: validation.errors,
          });
        }

        const template = await this.notificationService.createTemplate({
          ...templateData,
          organizationId: user.organizationId,
          createdBy: user.id,
        });

        res.status(201).json({
          success: true,
          data: template,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Template with this name already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async updateTemplate(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const updateData = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Template ID is required" });
        }

        // Check if template exists
        const existingTemplate = await this.notificationService.getTemplateById(id, user.organizationId);
        if (!existingTemplate) {
          return res.status(404).json({ error: "Template not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingTemplate.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Validate template content if being updated
        if (updateData.content) {
          const validation = await this.templateService.validateTemplate(updateData.content);
          if (!validation.valid) {
            return res.status(400).json({
              error: "Invalid template content",
              details: validation.errors,
            });
          }
        }

        const template = await this.notificationService.updateTemplate(id, {
          ...updateData,
          updatedBy: user.id,
        });

        res.json({
          success: true,
          data: template,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async deleteTemplate(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Template ID is required" });
        }

        // Check if template exists
        const existingTemplate = await this.notificationService.getTemplateById(id, user.organizationId);
        if (!existingTemplate) {
          return res.status(404).json({ error: "Template not found" });
        }

        // Check permissions
        if (user.role !== "admin" && existingTemplate.createdBy !== user.id) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Check if template is in use
        if (existingTemplate.isActive) {
          return res.status(400).json({
            error: "Cannot delete active template. Deactivate it first.",
          });
        }

        await this.notificationService.deleteTemplate(id, user.organizationId);

        res.json({
          success: true,
          message: "Template deleted successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async duplicateTemplate(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const { name } = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Template ID is required" });
        }

        if (!name) {
          return res.status(400).json({ error: "New template name is required" });
        }

        // Check if source template exists
        const sourceTemplate = await this.notificationService.getTemplateById(id, user.organizationId);
        if (!sourceTemplate) {
          return res.status(404).json({ error: "Template not found" });
        }

        const duplicatedTemplate = await this.notificationService.duplicateTemplate(id, {
          name,
          createdBy: user.id,
        });

        res.status(201).json({
          success: true,
          data: duplicatedTemplate,
        });
      } catch (error) {
        if ((error as Error).message.includes("duplicate")) {
          return res.status(409).json({
            error: "Template with this name already exists",
          });
        }

        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }

    async renderTemplate(req: any, res: any) {
      try {
        const { user } = req as any;
        const { id } = req.params;
        const { data, preview = false } = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!id) {
          return res.status(400).json({ error: "Template ID is required" });
        }

        // Check if template exists
        const template = await this.notificationService.getTemplateById(id, user.organizationId);
        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }

        const rendered = await this.templateService.renderTemplate(template.content, data || {});

        res.json({
          success: true,
          data: {
            rendered,
            preview: preview === true,
          },
        });
      } catch (error) {
        res.status(400).json({
          error: "Template rendering failed",
          message: (error as Error).message,
        });
      }
    }

    async getDefaultTemplates(req: any, res: any) {
      try {
        const { user } = req as any;
        const { category } = req.query;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const defaultTemplates = await this.templateService.getDefaultTemplates(category as string);

        res.json({
          success: true,
          data: defaultTemplates,
        });
      } catch (error) {
        res.status(500).json({
          error: "Internal server error",
          message: (error as Error).message,
        });
      }
    }
  }

  let routeHandler: TemplatesRouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock response chain
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
    mockRes.send.mockReturnValue(mockRes);
    
    routeHandler = new TemplatesRouteHandler();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("GET /", () => {
    it("should get all templates for organization", async () => {
      const mockTemplates = {
        data: [
          {
            id: "template-1",
            name: "Purchase Notification",
            type: "purchase",
            category: "ecommerce",
          },
          {
            id: "template-2",
            name: "Sign Up Notification",
            type: "signup",
            category: "user",
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1,
        },
      };

      mockNotificationService.getAllTemplates.mockResolvedValue(mockTemplates);

      await routeHandler.getAllTemplates(mockReq, mockRes);

      expect(mockNotificationService.getAllTemplates).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 1,
        limit: 20,
        category: undefined,
        search: undefined,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates.data,
        pagination: mockTemplates.pagination,
      });
    });

    it("should handle filter parameters", async () => {
      const reqWithFilters = {
        ...mockReq,
        query: { category: "ecommerce", search: "purchase", page: "2", limit: "10" },
      };

      mockNotificationService.getAllTemplates.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 0, pages: 0 },
      });

      await routeHandler.getAllTemplates(reqWithFilters, mockRes);

      expect(mockNotificationService.getAllTemplates).toHaveBeenCalledWith({
        organizationId: "org-123",
        page: 2,
        limit: 10,
        category: "ecommerce",
        search: "purchase",
      });
    });
  });

  describe("GET /site/:siteId", () => {
    it("should get templates for specific site", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          name: "Site Template 1",
          siteId: "site-123",
        },
      ];

      const reqWithSiteId = {
        ...mockReq,
        params: { siteId: "site-123" },
      };

      mockNotificationService.getTemplatesBySite.mockResolvedValue(mockTemplates);

      await routeHandler.getTemplatesBySite(reqWithSiteId, mockRes);

      expect(mockNotificationService.getTemplatesBySite).toHaveBeenCalledWith({
        siteId: "site-123",
        organizationId: "org-123",
        activeOnly: false,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates,
      });
    });

    it("should filter active templates only", async () => {
      const reqWithActiveFilter = {
        ...mockReq,
        params: { siteId: "site-123" },
        query: { active: "true" },
      };

      mockNotificationService.getTemplatesBySite.mockResolvedValue([]);

      await routeHandler.getTemplatesBySite(reqWithActiveFilter, mockRes);

      expect(mockNotificationService.getTemplatesBySite).toHaveBeenCalledWith({
        siteId: "site-123",
        organizationId: "org-123",
        activeOnly: true,
      });
    });

    it("should return 400 for missing site ID", async () => {
      const reqWithoutSiteId = {
        ...mockReq,
        params: {},
      };

      await routeHandler.getTemplatesBySite(reqWithoutSiteId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Site ID is required",
      });
    });
  });

  describe("POST /", () => {
    it("should create new template", async () => {
      const templateData = {
        name: "New Template",
        content: "<div>{{message}}</div>",
        type: "purchase",
        siteId: "site-123",
        category: "ecommerce",
      };

      const createdTemplate = {
        id: "template-new",
        ...templateData,
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithBody = {
        ...mockReq,
        body: templateData,
      };

      mockTemplateService.validateTemplate.mockResolvedValue({ valid: true });
      mockNotificationService.createTemplate.mockResolvedValue(createdTemplate);

      await routeHandler.createTemplate(reqWithBody, mockRes);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith(templateData.content);
      expect(mockNotificationService.createTemplate).toHaveBeenCalledWith({
        ...templateData,
        organizationId: "org-123",
        createdBy: "user-123",
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdTemplate,
      });
    });

    it("should validate required fields", async () => {
      const invalidTemplateData = {
        name: "Test Template",
        // Missing content, type, siteId
      };

      const reqWithInvalidBody = {
        ...mockReq,
        body: invalidTemplateData,
      };

      await routeHandler.createTemplate(reqWithInvalidBody, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "content is required",
      });
    });

    it("should validate template content", async () => {
      const templateData = {
        name: "Invalid Template",
        content: "{{invalid_syntax",
        type: "purchase",
        siteId: "site-123",
      };

      const reqWithInvalidContent = {
        ...mockReq,
        body: templateData,
      };

      mockTemplateService.validateTemplate.mockResolvedValue({
        valid: false,
        errors: ["Unclosed handlebars expression"],
      });

      await routeHandler.createTemplate(reqWithInvalidContent, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid template content",
        details: ["Unclosed handlebars expression"],
      });
    });

    it("should handle duplicate name error", async () => {
      const templateData = {
        name: "Duplicate Template",
        content: "<div>{{message}}</div>",
        type: "purchase",
        siteId: "site-123",
      };

      const reqWithDuplicateData = {
        ...mockReq,
        body: templateData,
      };

      mockTemplateService.validateTemplate.mockResolvedValue({ valid: true });
      mockNotificationService.createTemplate.mockRejectedValue(
        new Error("duplicate key constraint")
      );

      await routeHandler.createTemplate(reqWithDuplicateData, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Template with this name already exists",
      });
    });
  });

  describe("PUT /:id", () => {
    it("should update existing template", async () => {
      const updateData = {
        name: "Updated Template",
        content: "<div>{{updated_message}}</div>",
      };

      const existingTemplate = {
        id: "template-123",
        name: "Original Template",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const updatedTemplate = {
        ...existingTemplate,
        ...updateData,
        updatedBy: "user-123",
      };

      const reqWithUpdate = {
        ...mockReq,
        params: { id: "template-123" },
        body: updateData,
      };

      mockNotificationService.getTemplateById.mockResolvedValue(existingTemplate);
      mockTemplateService.validateTemplate.mockResolvedValue({ valid: true });
      mockNotificationService.updateTemplate.mockResolvedValue(updatedTemplate);

      await routeHandler.updateTemplate(reqWithUpdate, mockRes);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith(updateData.content);
      expect(mockNotificationService.updateTemplate).toHaveBeenCalledWith("template-123", {
        ...updateData,
        updatedBy: "user-123",
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTemplate,
      });
    });

    it("should return 403 for insufficient permissions", async () => {
      const existingTemplate = {
        id: "template-123",
        organizationId: "org-123",
        createdBy: "other-user",
      };

      const nonAdminUser = {
        ...mockReq,
        user: { ...(mockReq as any).user, role: "user" },
        params: { id: "template-123" },
        body: { name: "Updated Name" },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(existingTemplate);

      await routeHandler.updateTemplate(nonAdminUser, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Insufficient permissions",
      });
    });
  });

  describe("DELETE /:id", () => {
    it("should delete inactive template", async () => {
      const existingTemplate = {
        id: "template-123",
        name: "Test Template",
        organizationId: "org-123",
        createdBy: "user-123",
        isActive: false,
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "template-123" },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(existingTemplate);
      mockNotificationService.deleteTemplate.mockResolvedValue(true);

      await routeHandler.deleteTemplate(reqWithId, mockRes);

      expect(mockNotificationService.deleteTemplate).toHaveBeenCalledWith(
        "template-123",
        "org-123"
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Template deleted successfully",
      });
    });

    it("should prevent deletion of active template", async () => {
      const activeTemplate = {
        id: "template-123",
        name: "Active Template",
        organizationId: "org-123",
        createdBy: "user-123",
        isActive: true,
      };

      const reqWithId = {
        ...mockReq,
        params: { id: "template-123" },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(activeTemplate);

      await routeHandler.deleteTemplate(reqWithId, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Cannot delete active template. Deactivate it first.",
      });
    });
  });

  describe("POST /:id/duplicate", () => {
    it("should duplicate template", async () => {
      const sourceTemplate = {
        id: "template-123",
        name: "Source Template",
        organizationId: "org-123",
      };

      const duplicatedTemplate = {
        id: "template-new",
        name: "Duplicated Template",
        organizationId: "org-123",
        createdBy: "user-123",
      };

      const reqWithDuplicate = {
        ...mockReq,
        params: { id: "template-123" },
        body: { name: "Duplicated Template" },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(sourceTemplate);
      mockNotificationService.duplicateTemplate.mockResolvedValue(duplicatedTemplate);

      await routeHandler.duplicateTemplate(reqWithDuplicate, mockRes);

      expect(mockNotificationService.duplicateTemplate).toHaveBeenCalledWith("template-123", {
        name: "Duplicated Template",
        createdBy: "user-123",
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: duplicatedTemplate,
      });
    });

    it("should require new template name", async () => {
      const reqWithoutName = {
        ...mockReq,
        params: { id: "template-123" },
        body: {},
      };

      await routeHandler.duplicateTemplate(reqWithoutName, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "New template name is required",
      });
    });
  });

  describe("POST /:id/render", () => {
    it("should render template with data", async () => {
      const template = {
        id: "template-123",
        content: "<div>Hello {{name}}!</div>",
        organizationId: "org-123",
      };

      const renderData = {
        name: "John",
      };

      const renderedContent = "<div>Hello John!</div>";

      const reqWithRender = {
        ...mockReq,
        params: { id: "template-123" },
        body: { data: renderData },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(template);
      mockTemplateService.renderTemplate.mockResolvedValue(renderedContent);

      await routeHandler.renderTemplate(reqWithRender, mockRes);

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(
        template.content,
        renderData
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          rendered: renderedContent,
          preview: false,
        },
      });
    });

    it("should handle rendering errors", async () => {
      const template = {
        id: "template-123",
        content: "{{invalid.syntax}}",
        organizationId: "org-123",
      };

      const reqWithRender = {
        ...mockReq,
        params: { id: "template-123" },
        body: { data: {} },
      };

      mockNotificationService.getTemplateById.mockResolvedValue(template);
      mockTemplateService.renderTemplate.mockRejectedValue(
        new Error("Invalid template syntax")
      );

      await routeHandler.renderTemplate(reqWithRender, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Template rendering failed",
        message: "Invalid template syntax",
      });
    });
  });

  describe("GET /defaults", () => {
    it("should get default templates", async () => {
      const defaultTemplates = [
        {
          name: "Purchase Notification",
          content: "<div>{{customerName}} just purchased {{productName}}</div>",
          category: "ecommerce",
        },
      ];

      mockTemplateService.getDefaultTemplates.mockResolvedValue(defaultTemplates);

      await routeHandler.getDefaultTemplates(mockReq, mockRes);

      expect(mockTemplateService.getDefaultTemplates).toHaveBeenCalledWith(undefined);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: defaultTemplates,
      });
    });

    it("should filter by category", async () => {
      const reqWithCategory = {
        ...mockReq,
        query: { category: "ecommerce" },
      };

      mockTemplateService.getDefaultTemplates.mockResolvedValue([]);

      await routeHandler.getDefaultTemplates(reqWithCategory, mockRes);

      expect(mockTemplateService.getDefaultTemplates).toHaveBeenCalledWith("ecommerce");
    });
  });
});