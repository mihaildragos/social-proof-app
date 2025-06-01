import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Pool } from "pg";
import { WebhookService, WebhookEvent, ShopifyWebhookData, WooCommerceWebhookData, CustomWebhookData } from "../services/webhook-service";
import * as crypto from "crypto";

// Mock pg
jest.mock("pg");
const MockPool = Pool as jest.MockedClass<typeof Pool>;

// Mock IntegrationService
jest.mock("../services/integration-service", () => ({
  IntegrationService: jest.fn().mockImplementation(() => ({
    // Mock methods as needed
  }))
}));

describe("WebhookService", () => {
  let webhookService: WebhookService;
  let mockDb: jest.Mocked<Pool>;
  let mockEventListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock database client
    mockDb = {
      query: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock Pool constructor to return our mock
    MockPool.mockImplementation(() => mockDb);

    webhookService = new WebhookService();
    mockEventListener = jest.fn();

    // Set up environment variables
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.STRIPE_WEBHOOK_SECRET = "test_stripe_secret";
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "test_woocommerce_secret";
    process.env.SHOPIFY_WEBHOOK_SECRET = "test_shopify_secret";
    process.env.API_BASE_URL = "https://api.example.com";
  });

  afterEach(async () => {
    await webhookService.close();
    jest.restoreAllMocks();
  });

  describe("Shopify Webhook Verification", () => {
    it("should verify valid Shopify webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const secret = "test_shopify_secret";
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      const isValid = await webhookService.verifyShopifyWebhook(rawBody, hmac, "test-shop.myshopify.com");
      
      expect(isValid).toBe(true);
    });

    it("should reject invalid Shopify webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const invalidHmac = "invalid_signature";

      const isValid = await webhookService.verifyShopifyWebhook(rawBody, invalidHmac, "test-shop.myshopify.com");
      
      expect(isValid).toBe(false);
    });

    it("should handle missing Shopify webhook secret", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const hmac = "some_hmac";

      // Mock environment to return null secret
      process.env.SHOPIFY_WEBHOOK_SECRET = "";

      const isValid = await webhookService.verifyShopifyWebhook(rawBody, hmac, "test-shop.myshopify.com");
      
      expect(isValid).toBe(false);
    });

    it("should handle verification errors gracefully", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const hmac = "invalid_base64!@#";

      const isValid = await webhookService.verifyShopifyWebhook(rawBody, hmac, "test-shop.myshopify.com");
      
      expect(isValid).toBe(false);
    });
  });

  describe("WooCommerce Webhook Verification", () => {
    it("should verify valid WooCommerce webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const secret = "test_woocommerce_secret";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      const isValid = await webhookService.verifyWooCommerceWebhook(rawBody, signature, "test-store.com");
      
      expect(isValid).toBe(true);
    });

    it("should reject invalid WooCommerce webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const invalidSignature = "invalid_signature";

      const isValid = await webhookService.verifyWooCommerceWebhook(rawBody, invalidSignature, "test-store.com");
      
      expect(isValid).toBe(false);
    });

    it("should handle missing WooCommerce webhook secret", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const signature = "some_signature";

      process.env.WOOCOMMERCE_WEBHOOK_SECRET = "";

      const isValid = await webhookService.verifyWooCommerceWebhook(rawBody, signature, "test-store.com");
      
      expect(isValid).toBe(false);
    });
  });

  describe("Stripe Webhook Verification", () => {
    it("should verify valid Stripe webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "event" });
      const secret = "test_stripe_secret";
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");
      const signature = `t=${timestamp},v1=${expectedSignature}`;

      const result = await webhookService.verifyStripeWebhook(rawBody, signature);
      
      expect(result).toEqual({ test: "event" });
    });

    it("should reject Stripe webhook with old timestamp", async () => {
      const rawBody = JSON.stringify({ test: "event" });
      const secret = "test_stripe_secret";
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      const payload = `${oldTimestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");
      const signature = `t=${oldTimestamp},v1=${expectedSignature}`;

      const result = await webhookService.verifyStripeWebhook(rawBody, signature);
      
      expect(result).toBeNull();
    });

    it("should reject invalid Stripe webhook signature format", async () => {
      const rawBody = JSON.stringify({ test: "event" });
      const invalidSignature = "invalid_format";

      const result = await webhookService.verifyStripeWebhook(rawBody, invalidSignature);
      
      expect(result).toBeNull();
    });

    it("should reject Stripe webhook with wrong signature", async () => {
      const rawBody = JSON.stringify({ test: "event" });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const wrongSignature = "wrong_signature";
      const signature = `t=${timestamp},v1=${wrongSignature}`;

      const result = await webhookService.verifyStripeWebhook(rawBody, signature);
      
      expect(result).toBeNull();
    });

    it("should handle missing Stripe webhook secret", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "";
      const rawBody = JSON.stringify({ test: "event" });
      const signature = "t=123,v1=abc";

      const result = await webhookService.verifyStripeWebhook(rawBody, signature);
      
      expect(result).toBeNull();
    });
  });

  describe("Custom Webhook Verification", () => {
    it("should verify valid custom webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const timestamp = Date.now().toString();
      const provider = "custom_provider";
      const secret = "CUSTOM_PROVIDER_WEBHOOK_SECRET";
      process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] = secret;
      
      const payload = `${timestamp}.${rawBody}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      const isValid = await webhookService.verifyCustomWebhook(rawBody, signature, timestamp, provider);
      
      expect(isValid).toBe(true);
    });

    it("should reject invalid custom webhook signature", async () => {
      const rawBody = JSON.stringify({ test: "data" });
      const timestamp = Date.now().toString();
      const provider = "custom_provider";
      const invalidSignature = "invalid_signature";

      const isValid = await webhookService.verifyCustomWebhook(rawBody, invalidSignature, timestamp, provider);
      
      expect(isValid).toBe(false);
    });
  });

  describe("Shopify Webhook Processing", () => {
    const mockWebhookEvent = {
      id: "webhook_123",
      provider: "shopify",
      topic: "orders/create",
      payload: {},
      headers: {},
      signature: "test_signature",
      timestamp: new Date(),
      status: "pending" as const,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvent] } as never);
    });

    it("should process Shopify order created webhook successfully", async () => {
      webhookService.on("webhook:processed", mockEventListener);

      const webhookData: ShopifyWebhookData = {
        topic: "orders/create",
        shopDomain: "test-shop.myshopify.com",
        payload: { id: 12345, total_price: "100.00" },
        headers: { "x-shopify-hmac-sha256": "test_signature" },
      };

      await webhookService.processShopifyWebhook(webhookData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO webhook_events"),
        expect.arrayContaining(["shopify", "orders/create"])
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE webhook_events SET status"),
        expect.arrayContaining(["processed"])
      );

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "shopify",
        topic: "orders/create",
        webhookId: "webhook_123",
      });
    });

    it("should handle unrecognized Shopify webhook topics", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      const webhookData: ShopifyWebhookData = {
        topic: "unknown/topic",
        shopDomain: "test-shop.myshopify.com",
        payload: { id: 12345 },
        headers: {},
      };

      await webhookService.processShopifyWebhook(webhookData);

      expect(consoleSpy).toHaveBeenCalledWith("Unhandled Shopify webhook topic:", "unknown/topic");
      consoleSpy.mockRestore();
    });

    it("should handle Shopify webhook processing errors", async () => {
      webhookService.on("webhook:failed", mockEventListener);
      
      // Mock database error
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockWebhookEvent] } as never) // For logWebhookEvent
        .mockRejectedValueOnce(new Error("Database error") as never); // For updateWebhookEventStatus

      const webhookData: ShopifyWebhookData = {
        topic: "orders/create",
        shopDomain: "test-shop.myshopify.com",
        payload: { id: 12345 },
        headers: {},
      };

      await webhookService.processShopifyWebhook(webhookData);

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "shopify",
        topic: "orders/create",
        webhookId: "webhook_123",
        error: expect.any(String),
      });
    });
  });

  describe("WooCommerce Webhook Processing", () => {
    const mockWebhookEvent = {
      id: "webhook_456",
      provider: "woocommerce",
      topic: "order.created",
      payload: {},
      headers: {},
      signature: "test_signature",
      timestamp: new Date(),
      status: "pending" as const,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvent] } as never);
    });

    it("should process WooCommerce order created webhook successfully", async () => {
      webhookService.on("webhook:processed", mockEventListener);

      const webhookData: WooCommerceWebhookData = {
        event: "created",
        resource: "order",
        source: "test-store.com",
        payload: { id: 67890, total: "150.00" },
        headers: { "x-wc-webhook-signature": "test_signature" },
      };

      await webhookService.processWooCommerceWebhook(webhookData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO webhook_events"),
        expect.arrayContaining(["woocommerce", "order.created"])
      );

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "woocommerce",
        topic: "order.created",
        webhookId: "webhook_456",
      });
    });

    it("should handle unrecognized WooCommerce webhook events", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      const webhookData: WooCommerceWebhookData = {
        event: "unknown",
        resource: "unknown",
        source: "test-store.com",
        payload: { id: 67890 },
        headers: {},
      };

      await webhookService.processWooCommerceWebhook(webhookData);

      expect(consoleSpy).toHaveBeenCalledWith("Unhandled WooCommerce webhook event:", "unknown.unknown");
      consoleSpy.mockRestore();
    });
  });

  describe("Stripe Webhook Processing", () => {
    const mockWebhookEvent = {
      id: "webhook_789",
      provider: "stripe",
      topic: "payment_intent.succeeded",
      payload: {},
      headers: {},
      signature: "evt_123",
      timestamp: new Date(),
      status: "pending" as const,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvent] } as never);
    });

    it("should process Stripe payment succeeded webhook successfully", async () => {
      webhookService.on("webhook:processed", mockEventListener);

      const stripeEvent = {
        id: "evt_123",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      };

      await webhookService.processStripeWebhook(stripeEvent);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO webhook_events"),
        expect.arrayContaining(["stripe", "payment_intent.succeeded"])
      );

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "stripe",
        topic: "payment_intent.succeeded",
        webhookId: "webhook_789",
      });
    });

    it("should handle unrecognized Stripe webhook events", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      const stripeEvent = {
        id: "evt_456",
        type: "unknown.event",
        data: { object: { id: "obj_123" } },
      };

      await webhookService.processStripeWebhook(stripeEvent);

      expect(consoleSpy).toHaveBeenCalledWith("Unhandled Stripe webhook event:", "unknown.event");
      consoleSpy.mockRestore();
    });
  });

  describe("Custom Webhook Processing", () => {
    const mockWebhookEvent = {
      id: "webhook_custom",
      provider: "custom_provider",
      topic: "custom",
      payload: {},
      headers: {},
      signature: "custom_signature",
      timestamp: new Date(),
      status: "pending" as const,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvent] } as never);
    });

    it("should process custom webhook successfully", async () => {
      webhookService.on("webhook:custom", mockEventListener);

      const customData: CustomWebhookData = {
        provider: "custom_provider",
        payload: { custom: "data" },
        headers: { "x-webhook-signature": "custom_signature" },
        timestamp: new Date().toISOString(),
      };

      await webhookService.processCustomWebhook(customData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO webhook_events"),
        expect.arrayContaining(["custom_provider", "custom"])
      );

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "custom_provider",
        payload: { custom: "data" },
        headers: { "x-webhook-signature": "custom_signature" },
        webhookId: "webhook_custom",
      });
    });
  });

  describe("Webhook Logs", () => {
    const mockWebhookEvents = [
      {
        id: "webhook_1",
        provider: "shopify",
        topic: "orders/create",
        payload: JSON.stringify({ id: 1 }),
        headers: JSON.stringify({}),
        signature: "sig1",
        status: "processed",
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "webhook_2",
        provider: "stripe",
        topic: "payment_intent.succeeded",
        payload: JSON.stringify({ id: 2 }),
        headers: JSON.stringify({}),
        signature: "sig2",
        status: "failed",
        retry_count: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    it("should get webhook logs with no filters", async () => {
      mockDb.query.mockResolvedValue({ rows: mockWebhookEvents } as never);

      const logs = await webhookService.getWebhookLogs({
        limit: 10,
        offset: 0,
      });

      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({
        id: "webhook_1",
        provider: "shopify",
        topic: "orders/create",
        status: "processed",
      });
    });

    it("should get webhook logs filtered by provider", async () => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvents[0]] } as never);

      const logs = await webhookService.getWebhookLogs({
        provider: "shopify",
        limit: 10,
        offset: 0,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("provider = $1"),
        expect.arrayContaining(["shopify", 10, 0])
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].provider).toBe("shopify");
    });

    it("should get webhook logs filtered by status", async () => {
      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvents[1]] } as never);

      const logs = await webhookService.getWebhookLogs({
        status: "failed",
        limit: 10,
        offset: 0,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $1"),
        expect.arrayContaining(["failed", 10, 0])
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe("failed");
    });

    it("should get webhook logs with both provider and status filters", async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as never);

      await webhookService.getWebhookLogs({
        provider: "shopify",
        status: "processed",
        limit: 5,
        offset: 10,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("provider = $1 AND status = $2"),
        expect.arrayContaining(["shopify", "processed", 5, 10])
      );
    });
  });

  describe("Webhook Retry", () => {
    it("should retry failed webhook successfully", async () => {
      const mockWebhook: WebhookEvent = {
        id: "webhook_retry",
        provider: "shopify",
        topic: "orders/create",
        payload: { id: 123 },
        headers: { "x-shopify-shop-domain": "test-shop.myshopify.com" },
        signature: "test_sig",
        timestamp: new Date(),
        status: "failed",
        retryCount: 1,
        lastError: "Previous error",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getWebhookEvent
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockWebhook] } as never) // getWebhookEvent
        .mockResolvedValueOnce({ rows: [] } as never) // updateWebhookEventRetry
        .mockResolvedValueOnce({ rows: [{ ...mockWebhook, status: "pending" }] } as never) // logWebhookEvent for retry
        .mockResolvedValueOnce({ rows: [] } as never); // updateWebhookEventStatus

      const success = await webhookService.retryWebhook("webhook_retry");

      expect(success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE webhook_events SET retry_count = $1, status = $2, updated_at = $3 WHERE id = $4",
        ["retrying", 2, expect.any(Date), "webhook_retry"]
      );
    });

    it("should fail to retry webhook that doesn't exist", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as never); // getWebhookEvent returns empty

      await expect(webhookService.retryWebhook("nonexistent")).rejects.toThrow("Webhook event not found");
    });

    it("should fail to retry webhook that exceeded max retries", async () => {
      const mockWebhook: WebhookEvent = {
        id: "webhook_max_retry",
        provider: "shopify",
        topic: "orders/create",
        payload: { id: 123 },
        headers: {},
        signature: "test_sig",
        timestamp: new Date(),
        status: "failed",
        retryCount: 3, // Max retries reached
        lastError: "Max retries exceeded",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockWebhook] } as never); // getWebhookEvent

      await expect(webhookService.retryWebhook("webhook_max_retry")).rejects.toThrow("Maximum retry attempts exceeded");
    });

    it("should handle different provider types during retry", async () => {
      const testCases = [
        {
          provider: "woocommerce",
          topic: "order.created",
          headers: { "x-wc-webhook-source": "test-store.com" },
        },
        {
          provider: "stripe",
          topic: "payment_intent.succeeded",
          headers: {},
        },
        {
          provider: "custom_provider",
          topic: "custom.event",
          headers: {},
        },
      ];

      for (const testCase of testCases) {
        const mockWebhook: WebhookEvent = {
          id: `webhook_${testCase.provider}`,
          provider: testCase.provider,
          topic: testCase.topic,
          payload: { id: 123 },
          headers: testCase.headers as Record<string, string>,
          signature: "test_sig",
          timestamp: new Date(),
          status: "failed",
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockWebhook] } as never) // getWebhookEvent
          .mockResolvedValueOnce({ rows: [] } as never) // updateWebhookEventRetry
          .mockResolvedValueOnce({ rows: [{ ...mockWebhook, status: "pending" }] } as never) // logWebhookEvent
          .mockResolvedValueOnce({ rows: [] } as never); // updateWebhookEventStatus

        const success = await webhookService.retryWebhook(`webhook_${testCase.provider}`);
        expect(success).toBe(true);
      }
    });
  });

  describe("Database Operations", () => {
    it("should log webhook events correctly", async () => {
      const mockResult = {
        rows: [{
          id: "webhook_logged",
          provider: "test_provider",
          topic: "test_topic",
          payload: JSON.stringify({ test: "data" }),
          headers: JSON.stringify({ "content-type": "application/json" }),
          signature: "test_signature",
          status: "pending",
          retry_count: 0,
          timestamp: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        }]
      };

      mockDb.query.mockResolvedValue(mockResult as never);

      // Access private method through any
      const logWebhookEvent = (webhookService as any).logWebhookEvent.bind(webhookService);
      
      const result = await logWebhookEvent({
        provider: "test_provider",
        topic: "test_topic",
        payload: { test: "data" },
        headers: { "content-type": "application/json" },
        signature: "test_signature",
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO webhook_events"),
        expect.arrayContaining([
          "test_provider",
          "test_topic",
          JSON.stringify({ test: "data" }),
          JSON.stringify({ "content-type": "application/json" }),
          "test_signature",
          "pending",
          0,
        ])
      );

      expect(result).toMatchObject({
        id: "webhook_logged",
        provider: "test_provider",
        topic: "test_topic",
        status: "pending",
      });
    });

    it("should update webhook event status correctly", async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as never);

      // Access private method through any
      const updateWebhookEventStatus = (webhookService as any).updateWebhookEventStatus.bind(webhookService);
      
      await updateWebhookEventStatus("webhook_123", "processed", "Success");

      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE webhook_events SET status = $1, last_error = $2, updated_at = $3 WHERE id = $4",
        ["processed", "Success", expect.any(Date), "webhook_123"]
      );
    });

    it("should map database rows to webhook events correctly", async () => {
      const mockRow = {
        id: "webhook_map_test",
        provider: "test_provider",
        topic: "test_topic",
        payload: '{"test": "data"}',
        headers: '{"content-type": "application/json"}',
        signature: "test_signature",
        timestamp: "2023-01-01T00:00:00Z",
        status: "processed",
        retry_count: 2,
        last_error: "Some error",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
      };

      // Access private method through any
      const mapRowToWebhookEvent = (webhookService as any).mapRowToWebhookEvent.bind(webhookService);
      
      const result = mapRowToWebhookEvent(mockRow);

      expect(result).toMatchObject({
        id: "webhook_map_test",
        provider: "test_provider",
        topic: "test_topic",
        payload: { test: "data" },
        headers: { "content-type": "application/json" },
        signature: "test_signature",
        status: "processed",
        retryCount: 2,
        lastError: "Some error",
      });
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Resource Cleanup", () => {
    it("should close database connection", async () => {
      await webhookService.close();
      expect(mockDb.end).toHaveBeenCalled();
    });
  });

  describe("Event Emission", () => {
    it("should emit events during webhook processing", async () => {
      const mockWebhookEvent = {
        id: "webhook_emit_test",
        provider: "shopify",
        topic: "orders/create",
        payload: {},
        headers: {},
        signature: "test_signature",
        timestamp: new Date(),
        status: "pending" as const,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockWebhookEvent] } as never);

      webhookService.on("webhook:processed", mockEventListener);

      const webhookData: ShopifyWebhookData = {
        topic: "orders/create",
        shopDomain: "test-shop.myshopify.com",
        payload: { id: 12345 },
        headers: {},
      };

      await webhookService.processShopifyWebhook(webhookData);

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "shopify",
        topic: "orders/create",
        webhookId: "webhook_emit_test",
      });
    });

    it("should emit error events when webhook processing fails", async () => {
      const mockWebhookEvent = {
        id: "webhook_error_test",
        provider: "shopify",
        topic: "orders/create",
        payload: {},
        headers: {},
        signature: "test_signature",
        timestamp: new Date(),
        status: "pending" as const,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock successful webhook event creation but failed status update
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockWebhookEvent] } as never) // logWebhookEvent
        .mockRejectedValueOnce(new Error("Database connection failed") as never); // updateWebhookEventStatus

      webhookService.on("webhook:failed", mockEventListener);

      const webhookData: ShopifyWebhookData = {
        topic: "orders/create",
        shopDomain: "test-shop.myshopify.com",
        payload: { id: 12345 },
        headers: {},
      };

      await webhookService.processShopifyWebhook(webhookData);

      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "shopify",
        topic: "orders/create",
        webhookId: "webhook_error_test",
        error: expect.any(String),
      });
    });
  });
});