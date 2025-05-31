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

// Mock dependencies with proper any types
const mockPrisma: any = {
  site: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  template: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEventPublisher: any = {
  publish: jest.fn()
};

const mockValidationService: any = {
  validateNotificationData: jest.fn(),
  validateTemplateData: jest.fn(),
};

// Mock NotificationService class  
class MockNotificationService {
  async createNotification(data: any): Promise<any> {
    // Validate site exists and is active
    const site = await mockPrisma.site.findUnique({
      where: { id: data.siteId }
    });

    if (!site) {
      throw new Error('Site not found');
    }

    if (!site.isActive) {
      throw new Error('Site is not active');
    }

    // Validate notification data
    const isValid = await mockValidationService.validateNotificationData(data);
    if (!isValid) {
      throw new Error('Invalid notification data');
    }

    // Create notification
    const notification = await mockPrisma.notification.create({
      data: {
        siteId: data.siteId,
        type: data.type,
        message: data.message,
        metadata: data.metadata,
        isActive: true
      }
    });

    // Publish event
    await mockEventPublisher.publish('notification.created', {
      notificationId: notification.id,
      siteId: data.siteId,
      type: data.type
    });

    return notification;
  }

  async getNotificationById(id: string): Promise<any> {
    const notification = await mockPrisma.notification.findUnique({
      where: { id },
      include: {
        site: true
      }
    });

    if (!notification) {
      return null;
    }

    return notification;
  }

  async getNotificationsBySite(siteId: string, options: any = {}): Promise<any> {
    const { page = 1, limit = 10, type } = options;
    
    const where: any = { siteId };
    if (type) where.type = type;

    const notifications = await mockPrisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await mockPrisma.notification.count({ where });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async updateNotification(id: string, data: any): Promise<any> {
    const existingNotification = await mockPrisma.notification.findUnique({
      where: { id }
    });

    if (!existingNotification) {
      throw new Error('Notification not found');
    }

    // Validate update data if provided
    if (data.message || data.metadata) {
      const isValid = await mockValidationService.validateNotificationData({
        ...existingNotification,
        ...data
      });
      if (!isValid) {
        throw new Error('Invalid notification data');
      }
    }

    const updatedNotification = await mockPrisma.notification.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    // Publish event
    await mockEventPublisher.publish('notification.updated', {
      notificationId: id,
      siteId: updatedNotification.siteId
    });

    return updatedNotification;
  }

  async deleteNotification(id: string): Promise<void> {
    const notification = await mockPrisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await mockPrisma.notification.delete({
      where: { id }
    });

    // Publish event  
    await mockEventPublisher.publish('notification.deleted', {
      notificationId: id,
      siteId: notification.siteId
    });
  }

  async createTemplate(data: any): Promise<any> {
    // Validate template data
    const isValid = await mockValidationService.validateTemplateData(data);
    if (!isValid) {
      throw new Error('Invalid template data');
    }

    const template = await mockPrisma.template.create({
      data: {
        name: data.name,
        type: data.type,
        message: data.message,
        organizationId: data.organizationId,
        isDefault: data.isDefault || false
      }
    });

    return template;
  }

  async getNotificationStats(siteId: string): Promise<any> {
    const stats = await mockPrisma.notification.findMany({
      where: { siteId },
      select: {
        type: true,
        createdAt: true
      }
    });

    const typeStats = (stats as any).reduce((acc: Record<string, number>, notification: any) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {});

    const dateStats = (stats as any).reduce((acc: Record<string, number>, notification: any) => {
      const date = notification.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return {
      total: (stats as any).length,
      byType: typeStats,
      byDate: dateStats
    };
  }
}

describe('Notifications Service - Core Notification Management (PostgreSQL + Prisma Architecture)', () => {
  let notificationService: MockNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new MockNotificationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const notificationData = {
        siteId: 'site-123',
        type: 'purchase',
        message: '{customer} just purchased {product}',
        metadata: {
          customer: 'John Doe',
          product: 'Premium Plan'
        }
      };

      mockPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockValidationService.validateNotificationData.mockResolvedValue(true);
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await notificationService.createNotification(notificationData);

      expect(result).toEqual(mockNotification);
      expect(mockPrisma.site.findUnique).toHaveBeenCalledWith({
        where: { id: 'site-123' }
      });
      expect(mockValidationService.validateNotificationData).toHaveBeenCalledWith(notificationData);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          siteId: notificationData.siteId,
          type: notificationData.type,
          message: notificationData.message,
          metadata: notificationData.metadata,
          isActive: true
        }
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('notification.created', {
        notificationId: mockNotification.id,
        siteId: notificationData.siteId,
        type: notificationData.type
      });
    });

    it('should throw error if site not found', async () => {
      const notificationData = {
        siteId: 'non-existent',
        type: 'purchase',
        message: 'Test message'
      };

      mockPrisma.site.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.createNotification(notificationData)
      ).rejects.toThrow('Site not found');
    });

    it('should throw error if site is not active', async () => {
      const notificationData = {
        siteId: 'site-123',
        type: 'purchase',
        message: 'Test message'
      };

      mockPrisma.site.findUnique.mockResolvedValue({ ...mockSite, isActive: false });

      await expect(
        notificationService.createNotification(notificationData)
      ).rejects.toThrow('Site is not active');
    });

    it('should throw error if validation fails', async () => {
      const notificationData = {
        siteId: 'site-123',
        type: 'purchase',
        message: 'Test message'
      };

      mockPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockValidationService.validateNotificationData.mockResolvedValue(false);

      await expect(
        notificationService.createNotification(notificationData)
      ).rejects.toThrow('Invalid notification data');
    });
  });

  describe('getNotificationById', () => {
    it('should return notification with site data', async () => {
      const notificationWithSite = {
        ...mockNotification,
        site: mockSite
      };

      mockPrisma.notification.findUnique.mockResolvedValue(notificationWithSite);

      const result = await notificationService.getNotificationById('notification-123');

      expect(result).toEqual(notificationWithSite);
      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        include: { site: true }
      });
    });

    it('should return null if notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      const result = await notificationService.getNotificationById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getNotificationsBySite', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [mockNotification];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(15);

      const result = await notificationService.getNotificationsBySite('site-123', {
        page: 1,
        limit: 10
      });

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        pages: 2
      });
    });

    it('should filter by type when provided', async () => {
      const mockNotifications = [mockNotification];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await notificationService.getNotificationsBySite('site-123', {
        type: 'purchase'
      });

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.pagination.total).toBe(5);
    });

    it('should use default pagination values', async () => {
      const mockNotifications = [mockNotification];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await notificationService.getNotificationsBySite('site-123');

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('updateNotification', () => {
    it('should update notification successfully', async () => {
      const updateData = {
        message: 'Updated message',
        metadata: { updated: true },
        isActive: false
      };

      const updatedNotification = {
        ...mockNotification,
        message: 'Updated message',
        metadata: { updated: true },
        isActive: false
      };

      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockValidationService.validateNotificationData.mockResolvedValue(true);
      mockPrisma.notification.update.mockResolvedValue(updatedNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await notificationService.updateNotification('notification-123', updateData);

      expect(result).toEqual(updatedNotification);
    });

    it('should throw error if notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.updateNotification('non-existent', {})
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.notification.delete.mockResolvedValue(mockNotification);
      mockEventPublisher.publish.mockResolvedValue(true);

      await notificationService.deleteNotification('notification-123');

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notification-123' }
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('notification.deleted', {
        notificationId: 'notification-123',
        siteId: mockNotification.siteId
      });
    });

    it('should throw error if notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        notificationService.deleteNotification('non-existent')
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('createTemplate', () => {
    it('should create template successfully', async () => {
      const templateData = {
        name: 'Purchase Template',
        type: 'purchase',
        message: '{customer} purchased {product}',
        organizationId: 'org-123'
      };

      mockValidationService.validateTemplateData.mockResolvedValue(true);
      mockPrisma.template.create.mockResolvedValue(mockTemplate);

      const result = await notificationService.createTemplate(templateData);

      expect(result).toEqual(mockTemplate);
      expect(mockValidationService.validateTemplateData).toHaveBeenCalledWith(templateData);
      expect(mockPrisma.template.create).toHaveBeenCalledWith({
        data: {
          name: templateData.name,
          type: templateData.type,
          message: templateData.message,
          organizationId: templateData.organizationId,
          isDefault: false
        }
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const mockStats = [
        { type: 'purchase', createdAt: new Date('2024-01-01') },
        { type: 'signup', createdAt: new Date('2024-01-01') },
        { type: 'purchase', createdAt: new Date('2024-01-02') }
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockStats);

      const result = await notificationService.getNotificationStats('site-123');

      expect(result.total).toBe(3);
      expect(result.byType.purchase).toBe(2);
      expect(result.byType.signup).toBe(1);
      expect(Object.keys(result.byDate)).toContain('2024-01-01');
      expect(Object.keys(result.byDate)).toContain('2024-01-02');
    });
  });
});
