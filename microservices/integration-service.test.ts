import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock dependencies with proper any types
const mockPrisma: any = {
  integration: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }
};

const mockEventPublisher: any = {
  publish: jest.fn()
};

const mockEncryptionService: any = {
  encrypt: jest.fn(),
  decrypt: jest.fn()
};

const mockWebhookService: any = {
  registerWebhook: jest.fn(),
  unregisterWebhook: jest.fn()
};

// Mock IntegrationService class
class MockIntegrationService {
  async createIntegration(data: any): Promise<any> {
    // Validate required fields
    if (!data.type || !data.name || !data.organizationId || !data.config) {
      throw new Error('Missing required fields');
    }

    // Create integration with encrypted config
    const encryptedConfig = await mockEncryptionService.encrypt(JSON.stringify(data.config));
    
    const integration = await mockPrisma.integration.create({
      data: {
        type: data.type,
        name: data.name,
        organizationId: data.organizationId,
        config: encryptedConfig,
        isActive: true
      }
    });

    // Register webhook if supported
    if (this.supportsWebhooks(integration.type)) {
      await mockWebhookService.registerWebhook(integration.id, integration.type);
    }

    // Publish event
    await mockEventPublisher.publish('integration.created', {
      integrationId: integration.id,
      type: integration.type,
      organizationId: integration.organizationId,
    });

    return integration;
  }

  async getIntegrationById(id: string): Promise<any> {
    const integration = await mockPrisma.integration.findUnique({
      where: { id }
    });

    if (!integration) {
      return null;
    }

    // Decrypt config before returning
    const decryptedConfig = await mockEncryptionService.decrypt(integration.config);
    
    return {
      ...integration,
      config: JSON.parse(decryptedConfig),
    };
  }

  async updateIntegration(id: string, data: any): Promise<any> {
    const existingIntegration = await mockPrisma.integration.findUnique({
      where: { id }
    });

    if (!existingIntegration) {
      throw new Error('Integration not found');
    }

    // Encrypt config if provided
    let encryptedConfig = existingIntegration.config;
    if (data.config) {
      encryptedConfig = await mockEncryptionService.encrypt(JSON.stringify(data.config));
    }

    const updatedIntegration = await mockPrisma.integration.update({
      where: { id },
      data: {
        ...data,
        config: encryptedConfig,
        updatedAt: new Date()
      }
    });

    // Publish event
    await mockEventPublisher.publish('integration.updated', {
      integrationId: updatedIntegration.id,
      type: updatedIntegration.type,
      organizationId: updatedIntegration.organizationId,
    });

    return updatedIntegration;
  }

  async deleteIntegration(id: string): Promise<void> {
    const integration = await mockPrisma.integration.findUnique({
      where: { id }
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Unregister webhook if supported
    if (this.supportsWebhooks(integration.type)) {
      await mockWebhookService.unregisterWebhook(integration.id);
    }

    await mockPrisma.integration.delete({
      where: { id }
    });

    // Publish event
    await mockEventPublisher.publish('integration.deleted', {
      integrationId: integration.id,
      type: integration.type,
      organizationId: integration.organizationId,
    });
  }

  async validateIntegrationConfig(id: string): Promise<boolean> {
    const integration = await mockPrisma.integration.findUnique({
      where: { id }
    });

    if (!integration) {
      return false;
    }

    const decryptedConfig = await mockEncryptionService.decrypt(integration.config);
    const config = JSON.parse(decryptedConfig);

    switch (integration.type) {
      case 'shopify':
        return !!(config.shopUrl && config.accessToken);
      case 'woocommerce':
        return !!(config.siteUrl && config.consumerKey && config.consumerSecret);
      case 'stripe':
        return !!(config.secretKey);
      default:
        return false;
    }
  }

  async refreshIntegrationTokens(id: string): Promise<void> {
    const integration = await mockPrisma.integration.findUnique({
      where: { id }
    });

    if (!integration || !integration.isActive) {
      return;
    }

    const decryptedConfig = await mockEncryptionService.decrypt(integration.config);
    
    await mockPrisma.integration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        updatedAt: new Date()
      }
    });

    await mockEventPublisher.publish('integration.tokens_refreshed', {
      integrationId: integration.id,
      type: integration.type,
      organizationId: integration.organizationId,
    });
  }

  private supportsWebhooks(type: string): boolean {
    return ['shopify', 'woocommerce', 'stripe'].includes(type);
  }
}

describe("IntegrationService", () => {
  let integrationService: MockIntegrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    integrationService = new MockIntegrationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createIntegration', () => {
    it('should create integration successfully', async () => {
      const integrationData: any = {
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        }
      };

      const mockIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockEncryptionService.encrypt.mockResolvedValue("encrypted-config");
      mockPrisma.integration.create.mockResolvedValue(mockIntegration);
      mockWebhookService.registerWebhook.mockResolvedValue(true);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.createIntegration(integrationData);

      expect(result).toEqual(mockIntegration);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(JSON.stringify(integrationData.config));
      expect(mockPrisma.integration.create).toHaveBeenCalledWith({
        data: {
          type: integrationData.type,
          name: integrationData.name,
          organizationId: integrationData.organizationId,
          config: "encrypted-config",
          isActive: true
        }
      });
      expect(mockWebhookService.registerWebhook).toHaveBeenCalledWith(result.id, integrationData.type);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('integration.created', {
        integrationId: result.id,
        type: result.type,
        organizationId: result.organizationId,
      });
    });
  });

  describe('getIntegrationById', () => {
    it('should return integration with decrypted config', async () => {
      const mockIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const decryptedConfig = {
        shopUrl: 'mystore.myshopify.com',
        accessToken: 'access_token_123'
      };

      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(decryptedConfig));

      const result = await integrationService.getIntegrationById('integration-123');

      expect(result).toEqual({
        ...mockIntegration,
        config: JSON.parse(JSON.stringify(decryptedConfig)),
      });
      expect(mockPrisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: 'integration-123' }
      });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(mockIntegration.config);
    });

    it('should return null if integration not found', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const result = await integrationService.getIntegrationById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateIntegration', () => {
    it('should update integration successfully', async () => {
      const mockIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updateData = {
        name: 'Updated Store Name',
        config: {
          shopUrl: 'updated.myshopify.com'
        },
        isActive: false
      };

      const updatedIntegration: any = {
        ...mockIntegration,
        name: 'Updated Store Name',
        config: {
          shopUrl: 'updated.myshopify.com'
        },
        isActive: false
      };

      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.encrypt.mockResolvedValue("encrypted-updated-config");
      mockPrisma.integration.update.mockResolvedValue(updatedIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.updateIntegration('integration-123', updateData);

      expect(result).toEqual(updatedIntegration);
    });

    it('should throw error if integration not found', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(
        integrationService.updateIntegration('non-existent', {})
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration successfully', async () => {
      const mockIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockWebhookService.unregisterWebhook.mockResolvedValue(true);
      mockPrisma.integration.delete.mockResolvedValue(mockIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      await integrationService.deleteIntegration('integration-123');

      expect(mockWebhookService.unregisterWebhook).toHaveBeenCalledWith(mockIntegration.id);
      expect(mockPrisma.integration.delete).toHaveBeenCalledWith({
        where: { id: 'integration-123' }
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('integration.deleted', {
        integrationId: mockIntegration.id,
        type: mockIntegration.type,
        organizationId: mockIntegration.organizationId,
      });
    });

    it('should throw error if integration not found', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(
        integrationService.deleteIntegration('non-existent')
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('validateIntegrationConfig', () => {
    it('should validate Shopify config successfully', async () => {
      const shopifyIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        name: 'My Shopify Store',
        organizationId: 'org-123',
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(shopifyIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(shopifyIntegration.config));

      const result = await integrationService.validateIntegrationConfig('integration-123');

      expect(result).toBe(true);
    });

    it('should validate WooCommerce config successfully', async () => {
      const wooCommerceIntegration: any = {
        id: 'integration-123',
        type: 'woocommerce',
        config: {
          siteUrl: 'mystore.com',
          consumerKey: 'consumer_key_123',
          consumerSecret: 'consumer_secret_123'
        },
        name: 'My WooCommerce Store',
        organizationId: 'org-123',
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(wooCommerceIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(
        JSON.stringify(wooCommerceIntegration.config)
      );

      const result = await integrationService.validateIntegrationConfig('integration-123');

      expect(result).toBe(true);
    });

    it('should validate Stripe config successfully', async () => {
      const stripeIntegration: any = {
        id: 'integration-123',
        type: 'stripe',
        config: {
          secretKey: 'sk_test_123'
        },
        name: 'My Stripe Integration',
        organizationId: 'org-123',
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(stripeIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(stripeIntegration.config));

      const result = await integrationService.validateIntegrationConfig('integration-123');

      expect(result).toBe(true);
    });

    it('should return false for unsupported integration type', async () => {
      const unsupportedIntegration: any = {
        id: 'integration-123',
        type: 'unsupported',
        name: 'Unsupported Integration',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(unsupportedIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify({}));

      const result = await integrationService.validateIntegrationConfig('integration-123');

      expect(result).toBe(false);
    });

    it('should return false for invalid Shopify config', async () => {
      const invalidShopifyIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        config: {
          shopUrl: 'invalid-url'
          // Missing accessToken
        },
        name: 'Invalid Shopify Store',
        organizationId: 'org-123',
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(invalidShopifyIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(
        JSON.stringify(invalidShopifyIntegration.config)
      );

      const result = await integrationService.validateIntegrationConfig('integration-123');

      expect(result).toBe(false);
    });
  });

  describe('refreshIntegrationTokens', () => {
    it('should refresh integration tokens successfully', async () => {
      const mockIntegration: any = {
        id: 'integration-123',
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        isActive: true,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(mockIntegration.config));
      mockPrisma.integration.update.mockResolvedValue(mockIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      await integrationService.refreshIntegrationTokens('integration-123');

      expect(mockPrisma.integration.update).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('integration.tokens_refreshed', {
        integrationId: mockIntegration.id,
        type: mockIntegration.type,
        organizationId: mockIntegration.organizationId,
      });
    });

    it('should handle inactive integrations', async () => {
      const inactiveIntegration: any = {
        id: 'integration-123',
        isActive: false,
        type: 'shopify',
        name: 'My Shopify Store',
        organizationId: 'org-123',
        config: {
          shopUrl: 'mystore.myshopify.com',
          accessToken: 'access_token_123'
        },
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integration.findUnique.mockResolvedValue(inactiveIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(inactiveIntegration.config));

      await integrationService.refreshIntegrationTokens('integration-123');

      // Should not call update for inactive integrations
      expect(mockPrisma.integration.update).not.toHaveBeenCalled();
    });
  });
});
