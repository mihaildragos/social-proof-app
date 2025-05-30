import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock notification data
const mockNotification = {
  id: "notification-123",
  siteId: "site-123",
  type: "purchase" as const,
  message: "{customer} just purchased {product}",
  metadata: {
    customer: "John Doe",
    product: "Premium Plan",
    amount: 99.99,
    location: "New York",
  },
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockSite = {
  id: "site-123",
  name: "Test Site",
  domain: "example.com",
  organizationId: "org-123",
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockTemplate = {
  id: "template-123",
  name: "Purchase Template",
  type: "purchase" as const,
  message: "{customer} just purchased {product} from {location}",
  organizationId: "org-123",
  isDefault: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// Mock database operations
const mockPrisma = {
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  site: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  template: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaign: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

// Mock event publisher
const mockEventPublisher = {
  publish: jest.fn(),
};

// Mock validation service
const mockValidationService = {
  validateNotificationData: jest.fn(),
  validateTemplateData: jest.fn(),
};

describe("NotificationService", () => {
  // Mock NotificationService class
  class NotificationService {
    constructor(
      private prisma = mockPrisma,
      private eventPublisher = mockEventPublisher,
      private validationService = mockValidationService
    ) {}

    async createNotification(notificationData: {
      siteId: string;
      type: string;
      message: string;
      metadata?: Record<string, any>;
      templateId?: string;
    }) {
      // Validate input data
      if (!notificationData.siteId) {
        throw new Error("Site ID is required");
      }

      if (!notificationData.type) {
        throw new Error("Notification type is required");
      }

      if (!notificationData.message) {
        throw new Error("Message is required");
      }

      // Validate site exists
      const site = await this.prisma.site.findUnique({
        where: { id: notificationData.siteId },
      });

      if (!site) {
        throw new Error("Site not found");
      }

      if (!(site as any).isActive) {
        throw new Error("Site is not active");
      }

      // Validate notification data
      await this.validationService.validateNotificationData(notificationData);

      // Create notification
      const notification = await this.prisma.notification.create({
        data: {
          siteId: notificationData.siteId,
          type: notificationData.type,
          message: notificationData.message,
          metadata: notificationData.metadata || {},
          isActive: true,
        },
      });

      // Publish event
      await this.eventPublisher.publish("notification.created", {
        notificationId: (notification as any).id,
        siteId: (notification as any).siteId,
        type: (notification as any).type,
      });

      return notification;
    }

    async getNotificationById(id: string) {
      if (!id) {
        throw new Error("Notification ID is required");
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id },
        include: {
          site: true,
        },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      return notification;
    }

    async getNotificationsBySite(
      siteId: string,
      options: {
        page?: number;
        limit?: number;
        type?: string;
        isActive?: boolean;
      } = {}
    ) {
      if (!siteId) {
        throw new Error("Site ID is required");
      }

      const { page = 1, limit = 10, type, isActive } = options;
      const offset = (page - 1) * limit;

      const where: any = { siteId };
      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive;

      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { site: true },
        }),
        this.prisma.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil((total as any) / limit),
      };
    }

    async updateNotification(
      id: string,
      updateData: {
        message?: string;
        metadata?: Record<string, any>;
        isActive?: boolean;
      }
    ) {
      if (!id) {
        throw new Error("Notification ID is required");
      }

      // Check if notification exists
      const existingNotification = await this.prisma.notification.findUnique({
        where: { id },
      });

      if (!existingNotification) {
        throw new Error("Notification not found");
      }

      // Validate update data
      if (updateData.message || updateData.metadata) {
        await this.validationService.validateNotificationData({
          ...existingNotification,
          ...updateData,
        });
      }

      const notification = (await this.prisma.notification.update({
        where: { id },
        data: updateData,
      })) as any;

      // Publish event
      await this.eventPublisher.publish("notification.updated", {
        notificationId: (notification as any).id,
        siteId: (notification as any).siteId,
      });

      return notification;
    }

    async deleteNotification(id: string) {
      if (!id) {
        throw new Error("Notification ID is required");
      }

      const notification = await this.prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await this.prisma.notification.delete({
        where: { id },
      });

      // Publish event
      await this.eventPublisher.publish("notification.deleted", {
        notificationId: id,
        siteId: notification.siteId,
      });

      return true;
    }

    async createTemplate(templateData: {
      name: string;
      type: string;
      message: string;
      organizationId: string;
      isDefault?: boolean;
    }) {
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

      // Validate template data
      await this.validationService.validateTemplateData(templateData);

      const template = await this.prisma.template.create({
        data: {
          name: templateData.name,
          type: templateData.type,
          message: templateData.message,
          organizationId: templateData.organizationId,
          isDefault: templateData.isDefault || false,
        },
      });

      return template;
    }

    async getTemplatesByOrganization(organizationId: string, type?: string) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const where: any = { organizationId };
      if (type) where.type = type;

      const templates = await this.prisma.template.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      return templates;
    }

    async updateTemplate(
      id: string,
      updateData: {
        name?: string;
        message?: string;
        isDefault?: boolean;
      }
    ) {
      if (!id) {
        throw new Error("Template ID is required");
      }

      const existingTemplate = await this.prisma.template.findUnique({
        where: { id },
      });

      if (!existingTemplate) {
        throw new Error("Template not found");
      }

      // Validate update data
      if (updateData.message) {
        await this.validationService.validateTemplateData({
          ...existingTemplate,
          ...updateData,
        });
      }

      const template = await this.prisma.template.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
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

      await this.prisma.template.delete({
        where: { id },
      });

      return true;
    }

    async getNotificationStats(
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

      const stats = await this.prisma.notification.findMany({
        where: {
          siteId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          type: true,
          createdAt: true,
        },
      });

      // Group by type
      const typeStats = stats.reduce((acc: Record<string, number>, notification) => {
        acc[notification.type] = (acc[notification.type] || 0) + 1;
        return acc;
      }, {});

      // Group by date
      const dateStats = stats.reduce((acc: Record<string, number>, notification) => {
        const date = notification.createdAt.toISOString().split("T")[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      return {
        total: stats.length,
        byType: typeStats,
        byDate: dateStats,
      };
    }
  }

  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createNotification", () => {
    const validNotificationData = {
      siteId: "site-123",
      type: "purchase",
      message: "{customer} just purchased {product}",
      metadata: {
        customer: "John Doe",
        product: "Premium Plan",
      },
    };

    it("should create notification successfully", async () => {
      mockPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockValidationService.validateNotificationData.mockResolvedValue(true);
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await notificationService.createNotification(validNotificationData);

      expect(result).toEqual(mockNotification);
      expect(mockPrisma.site.findUnique).toHaveBeenCalledWith({
        where: { id: validNotificationData.siteId },
      });
      expect(mockValidationService.validateNotificationData).toHaveBeenCalledWith(
        validNotificationData
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("notification.created", {
        notificationId: mockNotification.id,
        siteId: mockNotification.siteId,
        type: mockNotification.type,
      });
    });

    it("should throw error for missing site ID", async () => {
      const invalidData = { ...validNotificationData, siteId: "" };

      await expect(notificationService.createNotification(invalidData)).rejects.toThrow(
        "Site ID is required"
      );
    });

    it("should throw error for missing type", async () => {
      const invalidData = { ...validNotificationData, type: "" };

      await expect(notificationService.createNotification(invalidData)).rejects.toThrow(
        "Notification type is required"
      );
    });

    it("should throw error for missing message", async () => {
      const invalidData = { ...validNotificationData, message: "" };

      await expect(notificationService.createNotification(invalidData)).rejects.toThrow(
        "Message is required"
      );
    });

    it("should throw error for non-existent site", async () => {
      mockPrisma.site.findUnique.mockResolvedValue(null);

      await expect(notificationService.createNotification(validNotificationData)).rejects.toThrow(
        "Site not found"
      );
    });

    it("should throw error for inactive site", async () => {
      mockPrisma.site.findUnique.mockResolvedValue({ ...mockSite, isActive: false });

      await expect(notificationService.createNotification(validNotificationData)).rejects.toThrow(
        "Site is not active"
      );
    });

    it("should throw error for validation failure", async () => {
      mockPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockValidationService.validateNotificationData.mockRejectedValue(
        new Error("Invalid notification data")
      );

      await expect(notificationService.createNotification(validNotificationData)).rejects.toThrow(
        "Invalid notification data"
      );
    });
  });

  describe("getNotificationById", () => {
    it("should return notification by ID successfully", async () => {
      const notificationWithSite = { ...mockNotification, site: mockSite };
      mockPrisma.notification.findUnique.mockResolvedValue(notificationWithSite);

      const result = await notificationService.getNotificationById("notification-123");

      expect(result).toEqual(notificationWithSite);
      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: "notification-123" },
        include: { site: true },
      });
    });

    it("should throw error for missing notification ID", async () => {
      await expect(notificationService.getNotificationById("")).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for non-existent notification", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(notificationService.getNotificationById("non-existent")).rejects.toThrow(
        "Notification not found"
      );
    });
  });

  describe("getNotificationsBySite", () => {
    const mockNotifications = [mockNotification, { ...mockNotification, id: "notification-456" }];

    it("should return paginated notifications successfully", async () => {
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(15);

      const result = await notificationService.getNotificationsBySite("site-123", {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 15,
        page: 1,
        limit: 10,
        totalPages: Math.ceil((15 as any) / 10),
      });
    });

    it("should filter by type", async () => {
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(5);

      await notificationService.getNotificationsBySite("site-123", {
        type: "purchase",
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { siteId: "site-123", type: "purchase" },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { site: true },
      });
    });

    it("should filter by active status", async () => {
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(5);

      await notificationService.getNotificationsBySite("site-123", {
        isActive: true,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { siteId: "site-123", isActive: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { site: true },
      });
    });

    it("should throw error for missing site ID", async () => {
      await expect(notificationService.getNotificationsBySite("")).rejects.toThrow(
        "Site ID is required"
      );
    });
  });

  describe("updateNotification", () => {
    const updateData = {
      message: "Updated message",
      metadata: { updated: true },
      isActive: false,
    };

    it("should update notification successfully", async () => {
      const updatedNotification = { ...mockNotification, ...updateData };
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockValidationService.validateNotificationData.mockResolvedValue(true);
      mockPrisma.notification.update.mockResolvedValue(updatedNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await notificationService.updateNotification("notification-123", updateData);

      expect(result).toEqual(updatedNotification);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("notification.updated", {
        notificationId: "notification-123",
        siteId: mockNotification.siteId,
      });
    });

    it("should throw error for missing notification ID", async () => {
      await expect(notificationService.updateNotification("", updateData)).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for non-existent notification", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.updateNotification("non-existent", updateData)
      ).rejects.toThrow("Notification not found");
    });
  });

  describe("deleteNotification", () => {
    it("should delete notification successfully", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.notification.delete.mockResolvedValue(mockNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await notificationService.deleteNotification("notification-123");

      expect(result).toBe(true);
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: "notification-123" },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("notification.deleted", {
        notificationId: "notification-123",
        siteId: mockNotification.siteId,
      });
    });

    it("should throw error for missing notification ID", async () => {
      await expect(notificationService.deleteNotification("")).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for non-existent notification", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(notificationService.deleteNotification("non-existent")).rejects.toThrow(
        "Notification not found"
      );
    });
  });

  describe("createTemplate", () => {
    const validTemplateData = {
      name: "Purchase Template",
      type: "purchase",
      message: "{customer} purchased {product}",
      organizationId: "org-123",
    };

    it("should create template successfully", async () => {
      mockValidationService.validateTemplateData.mockResolvedValue(true);
      mockPrisma.template.create.mockResolvedValue(mockTemplate);

      const result = await notificationService.createTemplate(validTemplateData);

      expect(result).toEqual(mockTemplate);
      expect(mockValidationService.validateTemplateData).toHaveBeenCalledWith(validTemplateData);
    });

    it("should throw error for missing name", async () => {
      const invalidData = { ...validTemplateData, name: "" };

      await expect(notificationService.createTemplate(invalidData)).rejects.toThrow(
        "Template name is required"
      );
    });

    it("should throw error for missing type", async () => {
      const invalidData = { ...validTemplateData, type: "" };

      await expect(notificationService.createTemplate(invalidData)).rejects.toThrow(
        "Template type is required"
      );
    });

    it("should throw error for missing message", async () => {
      const invalidData = { ...validTemplateData, message: "" };

      await expect(notificationService.createTemplate(invalidData)).rejects.toThrow(
        "Template message is required"
      );
    });

    it("should throw error for missing organization ID", async () => {
      const invalidData = { ...validTemplateData, organizationId: "" };

      await expect(notificationService.createTemplate(invalidData)).rejects.toThrow(
        "Organization ID is required"
      );
    });
  });

  describe("getNotificationStats", () => {
    const dateRange = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };

    it("should return notification statistics", async () => {
      const mockStats = [
        { type: "purchase", createdAt: new Date("2024-01-01") },
        { type: "purchase", createdAt: new Date("2024-01-02") },
        { type: "signup", createdAt: new Date("2024-01-01") },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockStats);

      const result = await notificationService.getNotificationStats("site-123", dateRange);

      expect(result).toEqual({
        total: 3,
        byType: {
          purchase: 2,
          signup: 1,
        },
        byDate: {
          "2024-01-01": 2,
          "2024-01-02": 1,
        },
      });
    });

    it("should throw error for missing site ID", async () => {
      await expect(notificationService.getNotificationStats("", dateRange)).rejects.toThrow(
        "Site ID is required"
      );
    });
  });
});
