import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import * as crypto from "crypto";
import { ShopifyService, SHOPIFY_WEBHOOK_TOPICS } from "../services/shopify-service";

// Mock dependencies
jest.mock("../models/shopify", () => ({
  ShopifyIntegration: {
    registerWebhook: jest.fn(),
    findByDomain: jest.fn(),
    update: jest.fn(),
  },
  ShopifyStore: {},
  ShopifyWebhook: {},
}));

jest.mock("../utils/kafka", () => ({
  kafkaProducer: {
    sendMessage: jest.fn(),
  },
}));

jest.mock("@social-proof/shared", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper function to create proper Response objects
const createMockResponse = (data: any, options: Partial<Response> = {}): Response => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: {} as any,
  redirected: false,
  type: 'basic' as ResponseType,
  url: '',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  json: jest.fn().mockResolvedValue(data as never),
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
  text: jest.fn(),
  ...options,
} as Response);

import { ShopifyIntegration } from "../models/shopify";
import { kafkaProducer } from "../utils/kafka";
import { logger } from "@social-proof/shared";

describe("ShopifyService", () => {
  let shopifyService: ShopifyService;
  let mockShopifyIntegration: jest.Mocked<typeof ShopifyIntegration>;
  let mockKafkaProducer: jest.Mocked<typeof kafkaProducer>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    shopifyService = new ShopifyService();
    mockShopifyIntegration = ShopifyIntegration as jest.Mocked<typeof ShopifyIntegration>;
    mockKafkaProducer = kafkaProducer as jest.Mocked<typeof kafkaProducer>;
    mockLogger = logger as jest.Mocked<typeof logger>;

    // Set up environment variables
    process.env.SHOPIFY_API_KEY = "test_api_key";
    process.env.SHOPIFY_API_SECRET = "test_api_secret";
    process.env.API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateAuthUrl", () => {
    it("should generate OAuth authorization URL with default scopes", async () => {
      const shop = "test-shop";
      
      const authUrl = await shopifyService.generateAuthUrl(shop);
      
      expect(authUrl).toContain(`https://${shop}/admin/oauth/authorize`);
      expect(authUrl).toContain("client_id=test_api_key");
      expect(authUrl).toContain("scope=read_orders%2Cread_products%2Cwrite_script_tags");
      expect(authUrl).toContain("redirect_uri=https%3A//api.example.com/api/integrations/shopify/callback");
      expect(authUrl).toContain("state=");
    });

    it("should generate OAuth authorization URL with custom scopes", async () => {
      const shop = "test-shop";
      const customScopes = ["read_orders", "read_customers"];
      
      const authUrl = await shopifyService.generateAuthUrl(shop, customScopes);
      
      expect(authUrl).toContain("scope=read_orders%2Cread_customers");
    });

    it("should generate unique state parameter for each request", async () => {
      const shop = "test-shop";
      
      const authUrl1 = await shopifyService.generateAuthUrl(shop);
      const authUrl2 = await shopifyService.generateAuthUrl(shop);
      
      const state1 = new URL(authUrl1).searchParams.get("state");
      const state2 = new URL(authUrl2).searchParams.get("state");
      
      expect(state1).not.toEqual(state2);
      expect(state1).toHaveLength(32); // 16 bytes * 2 (hex)
      expect(state2).toHaveLength(32);
    });
  });

  describe("validateConnection", () => {
    const mockShopData = {
      shop: {
        id: 12345,
        name: "Test Shop",
        domain: "test-shop.myshopify.com",
        email: "test@shop.com",
        currency: "USD",
        timezone: "America/New_York",
      },
    };

    it("should validate Shopify connection successfully", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockShopData));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      const result = await shopifyService.validateConnection(shop, accessToken);
      
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/api/2023-10/shop.json",
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );
      
      expect(result).toEqual(mockShopData.shop);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }));

      const shop = "test-shop.myshopify.com";
      const accessToken = "invalid_token";
      
      await expect(shopifyService.validateConnection(shop, accessToken))
        .rejects.toThrow("Shopify API error: 401 Unauthorized");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to validate Shopify connection",
        { shop, error: expect.any(Error) }
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValueOnce(networkError);

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      await expect(shopifyService.validateConnection(shop, accessToken))
        .rejects.toThrow(networkError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to validate Shopify connection",
        { shop, error: networkError }
      );
    });
  });

  describe("setupWebhooks", () => {
    it("should setup webhooks successfully", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ webhook: { id: 123 } }));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      await shopifyService.setupWebhooks(shop, accessToken);

      const expectedTopics = [
        SHOPIFY_WEBHOOK_TOPICS.ORDERS_CREATE,
        SHOPIFY_WEBHOOK_TOPICS.ORDERS_UPDATED,
        SHOPIFY_WEBHOOK_TOPICS.APP_UNINSTALLED,
      ];

      expect(mockFetch).toHaveBeenCalledTimes(expectedTopics.length);

      for (const topic of expectedTopics) {
        expect(mockFetch).toHaveBeenCalledWith(
          "https://test-shop.myshopify.com/admin/api/2023-10/webhooks.json",
          {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              webhook: {
                topic,
                address: `https://api.example.com/api/integrations/webhooks/shopify/${topic.replace("/", "-")}`,
                format: "json",
              },
            }),
          }
        );
      }

      expect(mockLogger.info).toHaveBeenCalledTimes(expectedTopics.length);
    });

    it("should handle individual webhook creation failures", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ webhook: { id: 123 } }))
        .mockResolvedValueOnce(createMockResponse({ errors: "Webhook already exists" }, { ok: false }))
        .mockResolvedValueOnce(createMockResponse({ webhook: { id: 456 } }));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      await shopifyService.setupWebhooks(shop, accessToken);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to create webhook for orders/updated",
        { shop, error: { errors: "Webhook already exists" } }
      );
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Only successful webhooks
    });

    it("should handle complete webhook setup failure", async () => {
      const setupError = new Error("Setup failed");
      mockFetch.mockRejectedValueOnce(setupError);

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      await expect(shopifyService.setupWebhooks(shop, accessToken))
        .rejects.toThrow(setupError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to setup webhooks",
        { shop, error: setupError }
      );
    });
  });

  describe("exchangeCodeForToken", () => {
    const mockTokenResponse = {
      access_token: "new_access_token",
      scope: "read_orders,read_products",
    };

    it("should exchange OAuth code for access token", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockTokenResponse));

      const shop = "test-shop.myshopify.com";
      const code = "auth_code_123";
      
      const result = await shopifyService.exchangeCodeForToken(shop, code);
      
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: "test_api_key",
            client_secret: "test_api_secret",
            code,
          }),
        }
      );
      
      expect(result).toEqual(mockTokenResponse);
    });

    it("should handle token exchange failure", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, {
        ok: false,
        status: 400,
        statusText: "Bad Request",
      }));

      const shop = "test-shop.myshopify.com";
      const code = "invalid_code";
      
      await expect(shopifyService.exchangeCodeForToken(shop, code))
        .rejects.toThrow("Token exchange failed: 400 Bad Request");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to exchange code for token",
        { shop, error: expect.any(Error) }
      );
    });
  });

  describe("getStoreInfo", () => {
    const mockShopData = {
      shop: {
        id: 12345,
        name: "Test Shop",
        domain: "test-shop.myshopify.com",
      },
    };

    it("should get store information", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockShopData));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      const result = await shopifyService.getStoreInfo(shop, accessToken);
      
      expect(result).toEqual(mockShopData.shop);
    });

    it("should handle store info retrieval failure", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      }));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      
      await expect(shopifyService.getStoreInfo(shop, accessToken))
        .rejects.toThrow("Failed to get store info: 403 Forbidden");
    });
  });

  describe("syncStoreData", () => {
    const mockOrdersResponse = {
      orders: [
        { id: 1, total_price: "100.00" },
        { id: 2, total_price: "150.00" },
      ],
    };

    const mockProductsResponse = {
      products: [
        { id: 1, title: "Product 1" },
        { id: 2, title: "Product 2" },
        { id: 3, title: "Product 3" },
      ],
    };

    it("should sync store data successfully", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockOrdersResponse))
        .mockResolvedValueOnce(createMockResponse(mockProductsResponse));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      const userId = "user123";
      
      await shopifyService.syncStoreData(shop, accessToken, userId);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/api/2023-10/orders.json?limit=50&status=any",
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/api/2023-10/products.json?limit=50",
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Synced 2 orders",
        { shop, userId }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Synced 3 products",
        { shop, userId }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Store data sync completed",
        { shop, userId }
      );
    });

    it("should handle partial sync failures gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null, {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        }))
        .mockResolvedValueOnce(createMockResponse(mockProductsResponse));

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      const userId = "user123";
      
      await shopifyService.syncStoreData(shop, accessToken, userId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Synced 3 products",
        { shop, userId }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Store data sync completed",
        { shop, userId }
      );
    });

    it("should handle complete sync failure", async () => {
      const syncError = new Error("Sync failed");
      mockFetch.mockRejectedValueOnce(syncError);

      const shop = "test-shop.myshopify.com";
      const accessToken = "test_access_token";
      const userId = "user123";
      
      await expect(shopifyService.syncStoreData(shop, accessToken, userId))
        .rejects.toThrow(syncError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to sync store data",
        { shop, userId, error: syncError }
      );
    });
  });

  describe("registerWebhooks (static method)", () => {
    const mockShopifyStore = {
      id: "store_123",
      shop_domain: "test-shop.myshopify.com",
      access_token: "test_access_token",
      site_id: "site_456",
      status: "active" as const,
    };

    const mockWebhook = {
      id: "webhook_123",
      store_id: "store_123",
      topic: "orders/create",
      endpoint: "https://api.example.com/webhooks/orders-create",
    };

    it("should register webhooks successfully", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ webhook: { id: 123 } }));

      mockShopifyIntegration.registerWebhook.mockResolvedValue(mockWebhook as any);

      const webhookUrl = "https://api.example.com/webhooks";
      const topics = [SHOPIFY_WEBHOOK_TOPICS.ORDERS_CREATE];
      
      const result = await ShopifyService.registerWebhooks(
        mockShopifyStore as any,
        webhookUrl,
        topics
      );

      expect(result).toEqual([mockWebhook]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/api/2023-10/webhooks.json",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "test_access_token",
          },
          body: JSON.stringify({
            webhook: {
              topic: "orders/create",
              address: "https://api.example.com/webhooks/orders-create",
              format: "json",
            },
          }),
        }
      );

      expect(mockShopifyIntegration.registerWebhook).toHaveBeenCalledWith(
        "store_123",
        "orders/create",
        "https://api.example.com/webhooks/orders-create"
      );
    });

    it("should handle missing access token", async () => {
      const storeWithoutToken = { ...mockShopifyStore, access_token: null };
      
      await expect(
        ShopifyService.registerWebhooks(storeWithoutToken as any, "https://api.example.com/webhooks")
      ).rejects.toThrow("Shopify access token not available");
    });

    it("should handle webhook registration failure", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, {
        ok: false,
        json: () => Promise.resolve({ errors: "Webhook creation failed" }),
      }));

      await expect(
        ShopifyService.registerWebhooks(
          mockShopifyStore as any,
          "https://api.example.com/webhooks"
        )
      ).rejects.toThrow('Shopify webhook registration failed: {"errors":"Webhook creation failed"}');
    });
  });

  describe("verifyWebhookSignature (static method)", () => {
    it("should verify valid webhook signature", () => {
      const hmac = "test_hmac";
      const body = JSON.stringify({ test: "data" });
      const secret = "test_secret";

      const generatedHash = crypto
        .createHmac("sha256", secret)
        .update(body, "utf8")
        .digest("base64");

      // Mock crypto.timingSafeEqual to return true for matching signatures
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      jest.spyOn(crypto, 'timingSafeEqual').mockReturnValue(true);

      const isValid = ShopifyService.verifyWebhookSignature(generatedHash, body, secret);
      
      expect(isValid).toBe(true);
      expect(crypto.timingSafeEqual).toHaveBeenCalledWith(
        Buffer.from(generatedHash),
        Buffer.from(generatedHash)
      );

      jest.restoreAllMocks();
    });

    it("should reject invalid webhook signature", () => {
      const hmac = "invalid_hmac";
      const body = JSON.stringify({ test: "data" });
      const secret = "test_secret";

      const isValid = ShopifyService.verifyWebhookSignature(hmac, body, secret);
      
      expect(isValid).toBe(false);
    });
  });

  describe("processOrderWebhook (static method)", () => {
    const mockShopifyStore = {
      id: "store_123",
      shop_domain: "test-shop.myshopify.com",
      site_id: "site_456",
      status: "active" as const,
    };

    const mockOrderData = {
      id: 12345,
      order_number: 1001,
      total_price: "150.00",
      currency: "USD",
      financial_status: "paid",
      fulfillment_status: null,
      created_at: "2023-01-01T00:00:00Z",
      customer: {
        id: 67890,
        email: "customer@example.com",
        first_name: "John",
        last_name: "Doe",
        orders_count: 3,
      },
      shipping_address: {
        city: "New York",
        province: "NY",
        country: "United States",
      },
      line_items: [
        {
          product_id: 111,
          title: "Test Product",
          variant_title: "Red / Large",
          quantity: 2,
          price: "75.00",
          handle: "test-product",
        },
      ],
    };

    it("should process order webhook successfully", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(mockShopifyStore);
      mockKafkaProducer.sendMessage.mockResolvedValue(undefined);

      const shopDomain = "test-shop.myshopify.com";
      
      await ShopifyService.processOrderWebhook(shopDomain, mockOrderData);

      expect(mockShopifyIntegration.findByDomain).toHaveBeenCalledWith(shopDomain);
      expect(mockKafkaProducer.sendMessage).toHaveBeenCalledWith(
        "events.orders",
        expect.objectContaining({
          event_type: "order.created",
          platform: "shopify",
          site_id: "site_456",
          integration_id: "store_123",
          order: expect.objectContaining({
            id: 12345,
            order_number: 1001,
            total_price: "150.00",
            currency: "USD",
          }),
          customer: expect.objectContaining({
            id: 67890,
            email: "customer@example.com",
            first_name: "John",
            last_name: "Doe",
          }),
          item: expect.objectContaining({
            id: 111,
            title: "Test Product",
            variant_title: "Red / Large",
            quantity: 2,
            price: "75.00",
          }),
        }),
        "site_456-12345"
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Processed Shopify order event",
        {
          shopDomain,
          orderId: 12345,
          kafkaTopic: "events.orders",
        }
      );
    });

    it("should handle missing store", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(null);

      const shopDomain = "nonexistent-shop.myshopify.com";
      
      await expect(
        ShopifyService.processOrderWebhook(shopDomain, mockOrderData)
      ).rejects.toThrow("Shopify store not found: nonexistent-shop.myshopify.com");
    });

    it("should handle processing errors", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(mockShopifyStore);
      mockKafkaProducer.sendMessage.mockRejectedValue(new Error("Kafka error"));

      const shopDomain = "test-shop.myshopify.com";
      
      await expect(
        ShopifyService.processOrderWebhook(shopDomain, mockOrderData)
      ).rejects.toThrow("Kafka error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error processing Shopify order webhook",
        { error: expect.any(Error), shopDomain }
      );
    });
  });

  describe("transformOrderData (static method)", () => {
    const mockShopifyStore = {
      id: "store_123",
      shop_domain: "test-shop.myshopify.com",
      site_id: "site_456",
      status: "active" as const,
    };

    const mockOrderData = {
      id: 12345,
      order_number: 1001,
      total_price: "150.00",
      currency: "USD",
      financial_status: "paid",
      fulfillment_status: null,
      created_at: "2023-01-01T00:00:00Z",
      customer: {
        id: 67890,
        email: "customer@example.com",
        first_name: "John",
        last_name: "Doe",
        orders_count: 3,
      },
      shipping_address: {
        city: "New York",
        province: "NY",
        country: "United States",
      },
      line_items: [
        {
          product_id: 111,
          title: "Test Product",
          variant_title: "Red / Large",
          quantity: 2,
          price: "75.00",
          handle: "test-product",
        },
        {
          product_id: 222,
          title: "Another Product",
          quantity: 1,
          price: "75.00",
        },
      ],
    };

    it("should transform order data correctly", () => {
      const result = ShopifyService.transformOrderData(mockOrderData, mockShopifyStore as any);

      expect(result).toMatchObject({
        event_type: "order.created",
        platform: "shopify",
        site_id: "site_456",
        integration_id: "store_123",
        timestamp: expect.any(String),
        source_created_at: "2023-01-01T00:00:00Z",
        order: {
          id: 12345,
          order_number: 1001,
          total_price: "150.00",
          currency: "USD",
          financial_status: "paid",
          fulfillment_status: null,
          total_items: 3,
        },
        customer: {
          id: 67890,
          email: "customer@example.com",
          first_name: "John",
          last_name: "Doe",
          orders_count: 3,
          city: "New York",
          province: "NY",
          country: "United States",
        },
        item: {
          id: 111,
          title: "Test Product",
          variant_title: "Red / Large",
          quantity: 2,
          price: "75.00",
          image_url: null,
          product_url: "https://test-shop.myshopify.com/products/test-product",
        },
        items: [
          {
            id: 111,
            title: "Test Product",
            variant_title: "Red / Large",
            quantity: 2,
            price: "75.00",
          },
          {
            id: 222,
            title: "Another Product",
            variant_title: undefined,
            quantity: 1,
            price: "75.00",
          },
        ],
        raw_data: mockOrderData,
      });
    });

    it("should handle missing customer data", () => {
      const orderWithoutCustomer = { ...mockOrderData, customer: null };
      
      const result = ShopifyService.transformOrderData(orderWithoutCustomer, mockShopifyStore as any);

      expect(result.customer).toEqual({
        id: undefined,
        email: undefined,
        first_name: undefined,
        last_name: undefined,
        orders_count: undefined,
        city: undefined,
        province: undefined,
        country: undefined,
      });
    });

    it("should handle missing line items", () => {
      const orderWithoutItems = { ...mockOrderData, line_items: null };
      
      const result = ShopifyService.transformOrderData(orderWithoutItems, mockShopifyStore as any);

      expect(result.order.total_items).toBe(0);
      expect(result.item).toBeNull();
      expect(result.items).toEqual([]);
    });

    it("should use billing address when shipping address is missing", () => {
      const orderWithBillingOnly = {
        ...mockOrderData,
        shipping_address: null,
        billing_address: {
          city: "Los Angeles",
          province: "CA",
          country: "United States",
        },
      };
      
      const result = ShopifyService.transformOrderData(orderWithBillingOnly, mockShopifyStore as any);

      expect(result.customer.city).toBe("Los Angeles");
      expect(result.customer.province).toBe("CA");
      expect(result.customer.country).toBe("United States");
    });
  });

  describe("processAppUninstalledWebhook (static method)", () => {
    const mockShopifyStore = {
      id: "store_123",
      shop_domain: "test-shop.myshopify.com",
      site_id: "site_456",
      status: "active" as const,
    };

    it("should process app uninstalled webhook successfully", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(mockShopifyStore);
      mockShopifyIntegration.update.mockResolvedValue(undefined as any);

      const shopDomain = "test-shop.myshopify.com";
      
      await ShopifyService.processAppUninstalledWebhook(shopDomain);

      expect(mockShopifyIntegration.findByDomain).toHaveBeenCalledWith(shopDomain);
      expect(mockShopifyIntegration.update).toHaveBeenCalledWith(
        "store_123",
        {
          status: "inactive",
          uninstalled_at: expect.any(Date),
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Processed Shopify app uninstalled webhook",
        { shopDomain }
      );
    });

    it("should handle missing store gracefully", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(null);

      const shopDomain = "nonexistent-shop.myshopify.com";
      
      await ShopifyService.processAppUninstalledWebhook(shopDomain);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Shopify store not found for uninstall: ${shopDomain}`
      );
      expect(mockShopifyIntegration.update).not.toHaveBeenCalled();
    });

    it("should handle processing errors", async () => {
      mockShopifyIntegration.findByDomain.mockResolvedValue(mockShopifyStore);
      mockShopifyIntegration.update.mockRejectedValue(new Error("Database error"));

      const shopDomain = "test-shop.myshopify.com";
      
      await expect(
        ShopifyService.processAppUninstalledWebhook(shopDomain)
      ).rejects.toThrow("Database error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error processing Shopify app uninstalled webhook",
        { error: expect.any(Error), shopDomain }
      );
    });
  });

  describe("createScriptTag (static method)", () => {
    const mockShopifyStore = {
      id: "store_123",
      shop_domain: "test-shop.myshopify.com",
      access_token: "test_access_token",
      site_id: "site_456",
      status: "active" as const,
    };

    const mockScriptTagResponse = {
      script_tag: {
        id: 789,
        src: "https://api.example.com/widget.js",
        event: "onload",
      },
    };

    it("should create script tag successfully", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(mockScriptTagResponse));

      const scriptUrl = "https://api.example.com/widget.js";
      
      const result = await ShopifyService.createScriptTag(mockShopifyStore as any, scriptUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/api/2023-10/script_tags.json",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "test_access_token",
          },
          body: JSON.stringify({
            script_tag: {
              event: "onload",
              src: scriptUrl,
            },
          }),
        }
      );

      expect(result).toEqual(mockScriptTagResponse.script_tag);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Created Shopify script tag",
        {
          shopDomain: "test-shop.myshopify.com",
          scriptTagId: 789,
        }
      );
    });

    it("should handle missing access token", async () => {
      const storeWithoutToken = { ...mockShopifyStore, access_token: null };
      
      await expect(
        ShopifyService.createScriptTag(storeWithoutToken as any, "https://api.example.com/widget.js")
      ).rejects.toThrow("Shopify access token not available");
    });

    it("should handle script tag creation failure", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, {
        ok: false,
        json: () => Promise.resolve({ errors: "Script tag creation failed" }),
      }));

      await expect(
        ShopifyService.createScriptTag(
          mockShopifyStore as any,
          "https://api.example.com/widget.js"
        )
      ).rejects.toThrow('Shopify script tag creation failed: {"errors":"Script tag creation failed"}');

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error creating Shopify script tag",
        {
          error: expect.any(Error),
          shopDomain: "test-shop.myshopify.com",
        }
      );
    });
  });

  describe("Constants", () => {
    it("should have correct webhook topics", () => {
      expect(SHOPIFY_WEBHOOK_TOPICS).toEqual({
        ORDERS_CREATE: "orders/create",
        ORDERS_UPDATED: "orders/updated",
        ORDERS_PAID: "orders/paid",
        PRODUCTS_CREATE: "products/create",
        PRODUCTS_UPDATE: "products/update",
        APP_UNINSTALLED: "app/uninstalled",
      });
    });
  });
});