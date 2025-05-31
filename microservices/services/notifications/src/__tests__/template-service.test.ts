import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock template data
const mockTemplate = {
  id: "template-123",
  name: "Purchase Template",
  type: "purchase",
  message: "{customer} just purchased {product} from {location}",
  organizationId: "org-123",
  isDefault: false,
  variables: ["customer", "product", "location"],
  styling: {
    backgroundColor: "#ffffff",
    textColor: "#000000",
    borderRadius: "8px",
  },
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockOrganization = {
  id: "org-123",
  name: "Test Organization",
  slug: "test-org",
  isActive: true,
};

// Mock database operations
const mockPrisma: any = {
  template: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
};

// Mock Redis cache
const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
};

// Mock event publisher
const mockEventPublisher: any = {
  publish: jest.fn(),
};

describe("Notifications Service - Template Management (PostgreSQL + Prisma Architecture)", () => {
  // Mock TemplateService class
  class TemplateService {
    constructor(
      private prisma = mockPrisma,
      private redis = mockRedis,
      private eventPublisher = mockEventPublisher
    ) {}

    async createTemplate(templateData: {
      name: string;
      type: string;
      message: string;
      organizationId: string;
      variables?: string[];
      styling?: Record<string, any>;
      isDefault?: boolean;
    }) {
      // Validate required fields
      if (!templateData.name) {
        throw new Error("Template name is required");
      }
      if (!templateData.type) {
        throw new Error("Template type is required");
      }
      if (!templateData.message) {
        throw new Error("Template message is required");
      }
      if (!templateData.organizationId) {
        throw new Error("Organization ID is required");
      }

      // Validate organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: templateData.organizationId },
      });

      if (!organization) {
        throw new Error("Organization not found");
      }

      // Extract variables from message
      const extractedVariables = this.extractVariables(templateData.message);

      // Create template
      const template = await this.prisma.template.create({
        data: {
          name: templateData.name,
          type: templateData.type,
          message: templateData.message,
          organizationId: templateData.organizationId,
          variables: templateData.variables || extractedVariables,
          styling: templateData.styling || {},
          isDefault: templateData.isDefault || false,
          isActive: true,
        },
      });

      // Clear cache
      await this.redis.del(`templates:${templateData.organizationId}` as any);

      // Publish event
      await this.eventPublisher.publish("template.created", {
        templateId: (template as any).id,
        organizationId: templateData.organizationId,
        type: templateData.type,
      });

      return template;
    }

    async getTemplateById(id: string) {
      if (!id) {
        throw new Error("Template ID is required");
      }

      // Check cache first
      const cached = await this.redis.get(`template:${id}`);
      if (cached) {
        // Parse the cached template to match expected format
        const expectedTemplate = JSON.parse(cached);
        return expectedTemplate;
      }

      const template = await this.prisma.template.findUnique({
        where: { id },
        include: {
          organization: true,
        },
      });

      if (!template) {
        throw new Error("Template not found");
      }

      // Cache the result
      await this.redis.set(`template:${id}`, JSON.stringify(template), "EX", 300);

      return template;
    }

    async getTemplatesByOrganization(
      organizationId: string,
      options: {
        type?: string;
        isDefault?: boolean;
        isActive?: boolean;
        page?: number;
        limit?: number;
      } = {}
    ) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const { type, isDefault, isActive, page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      // Check cache for organization templates
      const cacheKey = `templates:${organizationId}:${JSON.stringify(options)}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const where: any = { organizationId };
      if (type) where.type = type;
      if (isDefault !== undefined) where.isDefault = isDefault;
      if (isActive !== undefined) where.isActive = isActive;

      const [templates, total] = await Promise.all([
        this.prisma.template.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        }),
        this.prisma.template.count({ where }),
      ]);

      const result = {
        templates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // Cache the result
      await this.redis.set(cacheKey, JSON.stringify(result), "EX", 300);

      return result;
    }

    async updateTemplate(
      id: string,
      updateData: {
        name?: string;
        message?: string;
        variables?: string[];
        styling?: Record<string, any>;
        isDefault?: boolean;
        isActive?: boolean;
      }
    ) {
      if (!id) {
        throw new Error("Template ID is required");
      }

      // Get existing template
      const existing = await this.prisma.template.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("Template not found");
      }

      // If making this the default, ensure no other template is default
      if (updateData.isDefault) {
        await this.prisma.template.update({
          where: {
            organizationId: (existing as any).organizationId,
            type: (existing as any).type,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      // Extract variables if message is updated
      const variables =
        updateData.message ? this.extractVariables(updateData.message) : updateData.variables;

      const template = await this.prisma.template.update({
        where: { id },
        data: {
          ...updateData,
          variables: variables || (existing as any).variables,
          updatedAt: new Date(),
        },
      });

      // Clear caches
      await Promise.all([
        this.redis.del(`template:${id}`),
        this.redis.del(`templates:${(existing as any).organizationId}`),
      ]);

      // Publish event
      await this.eventPublisher.publish("template.updated", {
        templateId: id,
        organizationId: (existing as any).organizationId,
        changes: updateData,
      });

      return template;
    }

    async deleteTemplate(id: string) {
      if (!id) {
        throw new Error("Template ID is required");
      }

      const template = await this.prisma.template.findUnique({
        where: { id },
      });

      if (!template) {
        throw new Error("Template not found");
      }

      // Cannot delete default templates
      if ((template as any).isDefault) {
        throw new Error("Cannot delete default template");
      }

      await this.prisma.template.delete({
        where: { id },
      });

      // Clear caches
      await Promise.all([
        this.redis.del(`template:${id}`),
        this.redis.del(`templates:${(template as any).organizationId}`),
      ]);

      // Publish event
      await this.eventPublisher.publish("template.deleted", {
        templateId: id,
        organizationId: (template as any).organizationId,
      });

      return { success: true };
    }

    async renderTemplate(templateId: string, variables: Record<string, any>) {
      if (!templateId) {
        throw new Error("Template ID is required");
      }

      const template = await this.getTemplateById(templateId);

      if (!(template as any).isActive) {
        throw new Error("Template is not active");
      }

      let message = (template as any).message;

      // Replace variables in message
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, "g");
        message = message.replace(regex, String(value));
      });

      // Check for unreplaced variables
      const unreplacedVars = message.match(/{[^}]+}/g);
      if (unreplacedVars) {
        throw new Error(`Missing variables: ${unreplacedVars.join(", ")}`);
      }

      return {
        templateId,
        message,
        styling: (template as any).styling,
        variables: variables,
      };
    }

    private extractVariables(message: string): string[] {
      const matches = message.match(/{[^}]+}/g);
      return matches ? matches.map((match) => match.slice(1, -1)) : [];
    }

    async getTemplateStats(organizationId: string) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const stats = await this.prisma.template.count({
        where: { organizationId },
      });

      const activeStats = await this.prisma.template.count({
        where: { organizationId, isActive: true },
      });

      const typeStats = await this.prisma.template.groupBy({
        by: ["type"],
        where: { organizationId },
        _count: true,
      });

      return {
        total: stats,
        active: activeStats,
        inactive: stats - activeStats,
        byType: typeStats,
      };
    }
  }

  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createTemplate", () => {
    it("should create template successfully", async () => {
      const templateData = {
        name: "Purchase Template",
        type: "purchase",
        message: "{customer} just purchased {product}",
        organizationId: "org-123",
        variables: ["customer", "product"],
        styling: { color: "blue" },
      };

      mockPrisma.organization.findUnique.mockResolvedValueOnce(mockOrganization);
      mockPrisma.template.create.mockResolvedValueOnce(mockTemplate);
      mockRedis.del.mockResolvedValueOnce("OK");
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      const result = await templateService.createTemplate(templateData);

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-123" },
      });
      expect(mockPrisma.template.create).toHaveBeenCalledWith({
        data: {
          name: "Purchase Template",
          type: "purchase",
          message: "{customer} just purchased {product}",
          organizationId: "org-123",
          variables: ["customer", "product"],
          styling: { color: "blue" },
          isDefault: false,
          isActive: true,
        },
      });
    });

    it("should throw error if organization not found", async () => {
      const templateData = {
        name: "Test Template",
        type: "purchase",
        message: "Test message",
        organizationId: "invalid-org",
      };

      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      await expect(templateService.createTemplate(templateData)).rejects.toThrow(
        "Organization not found"
      );
    });

    it("should throw error if required fields are missing", async () => {
      await expect(
        templateService.createTemplate({
          name: "",
          type: "purchase",
          message: "Test message",
          organizationId: "org-123",
        })
      ).rejects.toThrow("Template name is required");

      await expect(
        templateService.createTemplate({
          name: "Test",
          type: "",
          message: "Test message",
          organizationId: "org-123",
        })
      ).rejects.toThrow("Template type is required");
    });
  });

  describe("getTemplateById", () => {
    it("should return cached template if available", async () => {
      const cachedTemplate = JSON.stringify(mockTemplate);
      mockRedis.get.mockResolvedValue(cachedTemplate);

      const result = await templateService.getTemplateById("template-123");

      // Parse the cached template to match expected format
      const expectedTemplate = JSON.parse(cachedTemplate);
      expect(result).toEqual(expectedTemplate);
      expect(mockRedis.get).toHaveBeenCalledWith("template:template-123");
      expect(mockPrisma.template.findUnique).not.toHaveBeenCalled();
    });

    it("should fetch from database and cache if not cached", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.template.findUnique.mockResolvedValueOnce(mockTemplate);
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await templateService.getTemplateById("template-123");

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.template.findUnique).toHaveBeenCalledWith({
        where: { id: "template-123" },
        include: { organization: true },
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        "template:template-123",
        JSON.stringify(mockTemplate),
        "EX",
        300
      );
    });

    it("should throw error if template not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.template.findUnique.mockResolvedValueOnce(null);

      await expect(templateService.getTemplateById("invalid-id")).rejects.toThrow(
        "Template not found"
      );
    });
  });

  describe("updateTemplate", () => {
    it("should update template successfully", async () => {
      const updateData = {
        name: "Updated Template",
        message: "{customer} bought {product}",
        isActive: false,
      };

      mockPrisma.template.findUnique.mockResolvedValueOnce(mockTemplate);
      mockPrisma.template.update.mockResolvedValueOnce({
        ...mockTemplate,
        ...updateData,
      });
      mockRedis.del.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      const result = await templateService.updateTemplate("template-123", updateData);

      expect(result).toEqual({ ...mockTemplate, ...updateData });
      expect(mockPrisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123" },
        data: {
          ...updateData,
          variables: ["customer", "product"],
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should handle default template switching", async () => {
      const updateData = { isDefault: true };

      mockPrisma.template.findUnique.mockResolvedValueOnce(mockTemplate);
      mockPrisma.template.update
        .mockResolvedValueOnce(undefined) // For clearing existing default
        .mockResolvedValueOnce({ ...mockTemplate, isDefault: true });
      mockRedis.del.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      await templateService.updateTemplate("template-123", updateData);

      expect(mockPrisma.template.update).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete template successfully", async () => {
      const nonDefaultTemplate = { ...mockTemplate, isDefault: false };

      mockPrisma.template.findUnique.mockResolvedValueOnce(nonDefaultTemplate);
      mockPrisma.template.delete.mockResolvedValueOnce(nonDefaultTemplate);
      mockRedis.del.mockResolvedValue("OK");
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      const result = await templateService.deleteTemplate("template-123");

      expect(result).toEqual({ success: true });
      expect(mockPrisma.template.delete).toHaveBeenCalledWith({
        where: { id: "template-123" },
      });
    });

    it("should not delete default templates", async () => {
      const defaultTemplate = { ...mockTemplate, isDefault: true };

      mockPrisma.template.findUnique.mockResolvedValueOnce(defaultTemplate);

      await expect(templateService.deleteTemplate("template-123")).rejects.toThrow(
        "Cannot delete default template"
      );
    });
  });

  describe("renderTemplate", () => {
    it("should render template with variables", async () => {
      jest.spyOn(templateService, "getTemplateById").mockResolvedValueOnce(mockTemplate);

      const variables = {
        customer: "John Doe",
        product: "Premium Plan",
        location: "New York",
      };

      const result = await templateService.renderTemplate("template-123", variables);

      expect(result).toEqual({
        templateId: "template-123",
        message: "John Doe just purchased Premium Plan from New York",
        styling: mockTemplate.styling,
        variables,
      });
    });

    it("should throw error for missing variables", async () => {
      jest.spyOn(templateService, "getTemplateById").mockResolvedValueOnce(mockTemplate);

      const variables = {
        customer: "John Doe",
        // Missing product and location
      };

      await expect(templateService.renderTemplate("template-123", variables)).rejects.toThrow(
        "Missing variables: {product}, {location}"
      );
    });

    it("should throw error for inactive template", async () => {
      const inactiveTemplate = { ...mockTemplate, isActive: false };
      jest.spyOn(templateService, "getTemplateById").mockResolvedValueOnce(inactiveTemplate);

      await expect(templateService.renderTemplate("template-123", {})).rejects.toThrow(
        "Template is not active"
      );
    });
  });

  describe("getTemplateStats", () => {
    it("should return template statistics", async () => {
      mockPrisma.template.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // active

      mockPrisma.template.groupBy.mockResolvedValueOnce([
        { type: "purchase", _count: 5 },
        { type: "signup", _count: 3 },
        { type: "review", _count: 2 },
      ]);

      const result = await templateService.getTemplateStats("org-123");

      expect(result).toEqual({
        total: 10,
        active: 8,
        inactive: 2,
        byType: [
          { type: "purchase", _count: 5 },
          { type: "signup", _count: 3 },
          { type: "review", _count: 2 },
        ],
      });
    });
  });
});
