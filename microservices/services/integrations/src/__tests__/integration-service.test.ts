import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("IntegrationService", () => {
  // Mock data
  const mockIntegration = {
    id: "integration-123",
    type: "shopify",
    name: "Shopify Store",
    organizationId: "org-123",
    config: {
      shopUrl: "test-store.myshopify.com",
      accessToken: "encrypted-token",
    },
    isActive: true,
    lastSyncAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  // Mock dependencies
  const mockPrisma = {
    integration: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockWebhookService = {
    registerWebhook: jest.fn(),
    unregisterWebhook: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  // Mock IntegrationService class
  class IntegrationService {
    constructor(
      private prisma = mockPrisma,
      private encryptionService = mockEncryptionService,
      private webhookService = mockWebhookService,
      private eventPublisher = mockEventPublisher
    ) {}

    async createIntegration(integrationData: {
      type: string;
      name: string;
      organizationId: string;
      config: Record<string, any>;
    }) {
      if (!integrationData.type) {
        throw new Error("Integration type is required");
      }

      if (!integrationData.name) {
        throw new Error("Integration name is required");
      }

      if (!integrationData.organizationId) {
        throw new Error("Organization ID is required");
      }

      if (!integrationData.config) {
        throw new Error("Integration config is required");
      }

      // Encrypt sensitive config data
      const encryptedConfig = await this.encryptionService.encrypt(
        JSON.stringify(integrationData.config)
      );

      const integration = await this.prisma.integration.create({
        data: {
          type: integrationData.type,
          name: integrationData.name,
          organizationId: integrationData.organizationId,
          config: encryptedConfig,
          isActive: true,
        },
      });

      // Register webhook if supported
      if (this.supportsWebhooks(integrationData.type)) {
        await this.webhookService.registerWebhook(integration.id, integrationData.type);
      }

      // Publish event
      await this.eventPublisher.publish("integration.created", {
        integrationId: integration.id,
        type: integration.type,
        organizationId: integration.organizationId,
      });

      return integration;
    }

    async getIntegrationById(id: string) {
      if (!id) {
        throw new Error("Integration ID is required");
      }

      const integration = await this.prisma.integration.findUnique({
        where: { id },
      });

      if (!integration) {
        throw new Error("Integration not found");
      }

      // Decrypt config for response
      const decryptedConfig = await this.encryptionService.decrypt(integration.config);

      return {
        ...integration,
        config: JSON.parse(decryptedConfig),
      };
    }

    async getIntegrationsByOrganization(organizationId: string, type?: string) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const where: any = { organizationId };
      if (type) where.type = type;

      const integrations = await this.prisma.integration.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      // Decrypt configs for response
      const decryptedIntegrations = await Promise.all(
        integrations.map(async (integration: any) => {
          const decryptedConfig = await this.encryptionService.decrypt(integration.config);
          return {
            ...integration,
            config: JSON.parse(decryptedConfig),
          };
        })
      );

      return decryptedIntegrations;
    }

    async updateIntegration(
      id: string,
      updateData: {
        name?: string;
        config?: Record<string, any>;
        isActive?: boolean;
      }
    ) {
      if (!id) {
        throw new Error("Integration ID is required");
      }

      const existingIntegration = await this.prisma.integration.findUnique({
        where: { id },
      });

      if (!existingIntegration) {
        throw new Error("Integration not found");
      }

      let encryptedConfig = existingIntegration.config;
      if (updateData.config) {
        encryptedConfig = await this.encryptionService.encrypt(JSON.stringify(updateData.config));
      }

      const integration = await this.prisma.integration.update({
        where: { id },
        data: {
          name: updateData.name,
          config: encryptedConfig,
          isActive: updateData.isActive,
          updatedAt: new Date(),
        },
      });

      // Publish event
      await this.eventPublisher.publish("integration.updated", {
        integrationId: integration.id,
        changes: updateData,
      });

      return integration;
    }

    async deleteIntegration(id: string) {
      if (!id) {
        throw new Error("Integration ID is required");
      }

      const integration = await this.prisma.integration.findUnique({
        where: { id },
      });

      if (!integration) {
        throw new Error("Integration not found");
      }

      // Unregister webhook if supported
      if (this.supportsWebhooks(integration.type)) {
        await this.webhookService.unregisterWebhook(integration.id);
      }

      await this.prisma.integration.delete({
        where: { id },
      });

      // Publish event
      await this.eventPublisher.publish("integration.deleted", {
        integrationId: id,
        type: integration.type,
      });

      return true;
    }

    async testConnection(id: string) {
      if (!id) {
        throw new Error("Integration ID is required");
      }

      const integration = await this.getIntegrationById(id);

      // Test connection based on integration type
      switch (integration.type) {
        case "shopify":
          return this.testShopifyConnection(integration.config);
        case "woocommerce":
          return this.testWooCommerceConnection(integration.config);
        case "stripe":
          return this.testStripeConnection(integration.config);
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }
    }

    private async testShopifyConnection(config: any) {
      // Mock Shopify API test
      if (!config.shopUrl || !config.accessToken) {
        throw new Error("Invalid Shopify configuration");
      }
      return { status: "connected", message: "Shopify connection successful" };
    }

    private async testWooCommerceConnection(config: any) {
      // Mock WooCommerce API test
      if (!config.siteUrl || !config.consumerKey || !config.consumerSecret) {
        throw new Error("Invalid WooCommerce configuration");
      }
      return { status: "connected", message: "WooCommerce connection successful" };
    }

    private async testStripeConnection(config: any) {
      // Mock Stripe API test
      if (!config.secretKey) {
        throw new Error("Invalid Stripe configuration");
      }
      return { status: "connected", message: "Stripe connection successful" };
    }

    private supportsWebhooks(type: string): boolean {
      return ["shopify", "woocommerce", "stripe"].includes(type);
    }

    async syncIntegrationData(id: string) {
      if (!id) {
        throw new Error("Integration ID is required");
      }

      const integration = await this.getIntegrationById(id);

      if (!integration.isActive) {
        throw new Error("Integration is not active");
      }

      // Update last sync time
      await this.prisma.integration.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
        },
      });

      // Publish sync event
      await this.eventPublisher.publish("integration.sync.started", {
        integrationId: id,
        type: integration.type,
      });

      return { status: "sync_started", message: "Data sync initiated" };
    }
  }

  let integrationService: IntegrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    integrationService = new IntegrationService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createIntegration", () => {
    const validIntegrationData = {
      type: "shopify",
      name: "My Shopify Store",
      organizationId: "org-123",
      config: {
        shopUrl: "test-store.myshopify.com",
        accessToken: "test-token",
      },
    };

    it("should create integration successfully", async () => {
      mockEncryptionService.encrypt.mockResolvedValue("encrypted-config");
      mockPrisma.integration.create.mockResolvedValue(mockIntegration);
      mockWebhookService.registerWebhook.mockResolvedValue(true);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.createIntegration(validIntegrationData);

      expect(result).toEqual(mockIntegration);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(validIntegrationData.config)
      );
      expect(mockWebhookService.registerWebhook).toHaveBeenCalledWith(
        mockIntegration.id,
        validIntegrationData.type
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("integration.created", {
        integrationId: mockIntegration.id,
        type: mockIntegration.type,
        organizationId: mockIntegration.organizationId,
      });
    });

    it("should throw error for missing type", async () => {
      const invalidData = { ...validIntegrationData, type: "" };

      await expect(integrationService.createIntegration(invalidData)).rejects.toThrow(
        "Integration type is required"
      );
    });

    it("should throw error for missing name", async () => {
      const invalidData = { ...validIntegrationData, name: "" };

      await expect(integrationService.createIntegration(invalidData)).rejects.toThrow(
        "Integration name is required"
      );
    });

    it("should throw error for missing organization ID", async () => {
      const invalidData = { ...validIntegrationData, organizationId: "" };

      await expect(integrationService.createIntegration(invalidData)).rejects.toThrow(
        "Organization ID is required"
      );
    });

    it("should throw error for missing config", async () => {
      const invalidData = { ...validIntegrationData, config: null as any };

      await expect(integrationService.createIntegration(invalidData)).rejects.toThrow(
        "Integration config is required"
      );
    });
  });

  describe("getIntegrationById", () => {
    it("should return integration by ID successfully", async () => {
      const decryptedConfig = { shopUrl: "test-store.myshopify.com" };
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(decryptedConfig));

      const result = await integrationService.getIntegrationById("integration-123");

      expect(result).toEqual({
        ...mockIntegration,
        config: decryptedConfig,
      });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(mockIntegration.config);
    });

    it("should throw error for missing integration ID", async () => {
      await expect(integrationService.getIntegrationById("")).rejects.toThrow(
        "Integration ID is required"
      );
    });

    it("should throw error for non-existent integration", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(integrationService.getIntegrationById("non-existent")).rejects.toThrow(
        "Integration not found"
      );
    });
  });

  describe("updateIntegration", () => {
    const updateData = {
      name: "Updated Store",
      config: { shopUrl: "updated-store.myshopify.com" },
      isActive: false,
    };

    it("should update integration successfully", async () => {
      const updatedIntegration = { ...mockIntegration, ...updateData };
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.encrypt.mockResolvedValue("encrypted-updated-config");
      mockPrisma.integration.update.mockResolvedValue(updatedIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.updateIntegration("integration-123", updateData);

      expect(result).toEqual(updatedIntegration);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(JSON.stringify(updateData.config));
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("integration.updated", {
        integrationId: "integration-123",
        changes: updateData,
      });
    });

    it("should throw error for missing integration ID", async () => {
      await expect(integrationService.updateIntegration("", updateData)).rejects.toThrow(
        "Integration ID is required"
      );
    });

    it("should throw error for non-existent integration", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(
        integrationService.updateIntegration("non-existent", updateData)
      ).rejects.toThrow("Integration not found");
    });
  });

  describe("deleteIntegration", () => {
    it("should delete integration successfully", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockWebhookService.unregisterWebhook.mockResolvedValue(true);
      mockPrisma.integration.delete.mockResolvedValue(mockIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.deleteIntegration("integration-123");

      expect(result).toBe(true);
      expect(mockWebhookService.unregisterWebhook).toHaveBeenCalledWith("integration-123");
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("integration.deleted", {
        integrationId: "integration-123",
        type: mockIntegration.type,
      });
    });

    it("should throw error for missing integration ID", async () => {
      await expect(integrationService.deleteIntegration("")).rejects.toThrow(
        "Integration ID is required"
      );
    });

    it("should throw error for non-existent integration", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(integrationService.deleteIntegration("non-existent")).rejects.toThrow(
        "Integration not found"
      );
    });
  });

  describe("testConnection", () => {
    it("should test Shopify connection successfully", async () => {
      const shopifyIntegration = {
        ...mockIntegration,
        type: "shopify",
        config: {
          shopUrl: "test-store.myshopify.com",
          accessToken: "test-token",
        },
      };

      mockPrisma.integration.findUnique.mockResolvedValue(shopifyIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(shopifyIntegration.config));

      const result = await integrationService.testConnection("integration-123");

      expect(result).toEqual({
        status: "connected",
        message: "Shopify connection successful",
      });
    });

    it("should test WooCommerce connection successfully", async () => {
      const wooCommerceIntegration = {
        ...mockIntegration,
        type: "woocommerce",
        config: {
          siteUrl: "https://example.com",
          consumerKey: "test-key",
          consumerSecret: "test-secret",
        },
      };

      mockPrisma.integration.findUnique.mockResolvedValue(wooCommerceIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(
        JSON.stringify(wooCommerceIntegration.config)
      );

      const result = await integrationService.testConnection("integration-123");

      expect(result).toEqual({
        status: "connected",
        message: "WooCommerce connection successful",
      });
    });

    it("should test Stripe connection successfully", async () => {
      const stripeIntegration = {
        ...mockIntegration,
        type: "stripe",
        config: {
          secretKey: "sk_test_123",
        },
      };

      mockPrisma.integration.findUnique.mockResolvedValue(stripeIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(stripeIntegration.config));

      const result = await integrationService.testConnection("integration-123");

      expect(result).toEqual({
        status: "connected",
        message: "Stripe connection successful",
      });
    });

    it("should throw error for unsupported integration type", async () => {
      const unsupportedIntegration = {
        ...mockIntegration,
        type: "unsupported",
      };

      mockPrisma.integration.findUnique.mockResolvedValue(unsupportedIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify({}));

      await expect(integrationService.testConnection("integration-123")).rejects.toThrow(
        "Unsupported integration type: unsupported"
      );
    });

    it("should throw error for invalid Shopify config", async () => {
      const invalidShopifyIntegration = {
        ...mockIntegration,
        type: "shopify",
        config: { shopUrl: "" }, // Missing accessToken
      };

      mockPrisma.integration.findUnique.mockResolvedValue(invalidShopifyIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(
        JSON.stringify(invalidShopifyIntegration.config)
      );

      await expect(integrationService.testConnection("integration-123")).rejects.toThrow(
        "Invalid Shopify configuration"
      );
    });
  });

  describe("syncIntegrationData", () => {
    it("should sync integration data successfully", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(mockIntegration.config));
      mockPrisma.integration.update.mockResolvedValue(mockIntegration);
      mockEventPublisher.publish.mockResolvedValue(true);

      const result = await integrationService.syncIntegrationData("integration-123");

      expect(result).toEqual({
        status: "sync_started",
        message: "Data sync initiated",
      });

      expect(mockPrisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-123" },
        data: {
          lastSyncAt: expect.any(Date),
        },
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith("integration.sync.started", {
        integrationId: "integration-123",
        type: mockIntegration.type,
      });
    });

    it("should throw error for inactive integration", async () => {
      const inactiveIntegration = { ...mockIntegration, isActive: false };
      mockPrisma.integration.findUnique.mockResolvedValue(inactiveIntegration);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(inactiveIntegration.config));

      await expect(integrationService.syncIntegrationData("integration-123")).rejects.toThrow(
        "Integration is not active"
      );
    });

    it("should throw error for missing integration ID", async () => {
      await expect(integrationService.syncIntegrationData("")).rejects.toThrow(
        "Integration ID is required"
      );
    });
  });
});
