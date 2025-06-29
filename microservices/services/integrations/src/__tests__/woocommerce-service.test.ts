import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import axios, { AxiosInstance } from "axios";
import { WooCommerceService, WooCommerceConfig, WooCommerceStoreInfo, WooCommerceProduct, WooCommerceOrder } from "../services/woocommerce-service";
import * as crypto from "crypto";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("WooCommerceService", () => {
  let wooCommerceService: WooCommerceService;
  let mockEventListener: jest.Mock;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const testConfig: WooCommerceConfig = {
    storeUrl: "https://test-store.com",
    consumerKey: "test_consumer_key",
    consumerSecret: "test_consumer_secret",
    version: "wc/v3",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    wooCommerceService = new WooCommerceService();
    mockEventListener = jest.fn();

    // Setup mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Set up environment variables
    process.env.API_BASE_URL = "https://api.example.com";
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = "test_webhook_secret";
  });

  afterEach(async () => {
    await wooCommerceService.cleanup();
    jest.restoreAllMocks();
  });

  describe("Client Creation and Management", () => {
    it("should create WooCommerce API client with correct configuration", () => {
      // Access private method through any
      const createClient = (wooCommerceService as any).createClient.bind(wooCommerceService);
      
      const client = createClient(testConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://test-store.com/wp-json/wc/v3",
        auth: {
          username: "test_consumer_key",
          password: "test_consumer_secret",
        },
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SocialProofApp/1.0",
        },
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it("should reuse existing client for same store configuration", () => {
      // Access private method through any
      const getClient = (wooCommerceService as any).getClient.bind(wooCommerceService);
      
      const client1 = getClient(testConfig);
      const client2 = getClient(testConfig);

      expect(client1).toBe(client2);
      expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    });

    it("should create different clients for different store configurations", () => {
      const testConfig2: WooCommerceConfig = {
        ...testConfig,
        storeUrl: "https://another-store.com",
      };

      // Access private method through any
      const getClient = (wooCommerceService as any).getClient.bind(wooCommerceService);
      
      const client1 = getClient(testConfig);
      const client2 = getClient(testConfig2);

      expect(client1).not.toBe(client2);
      expect(mockedAxios.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("Connection Validation", () => {
    const mockSystemStatus = {
      environment: {
        version: "7.0.0",
        wp_version: "6.3.0",
        server_info: {
          timezone: "America/New_York",
        },
      },
    };

    const mockSettings = [
      { id: "woocommerce_store_name", value: "Test WooCommerce Store" },
      { id: "woocommerce_store_description", value: "A test store for WooCommerce" },
      { id: "woocommerce_currency", value: "USD" },
      { id: "woocommerce_currency_symbol", value: "$" },
    ];

    beforeEach(() => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockSystemStatus } as any)
        .mockResolvedValueOnce({ data: mockSettings } as any);
    });

    it("should validate WooCommerce connection successfully", async () => {
      wooCommerceService.on("connection:validated", mockEventListener);

      const storeInfo = await wooCommerceService.validateConnection(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/system_status");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/settings/general");

      expect(storeInfo).toEqual({
        id: "https://test-store.com",
        name: "Test WooCommerce Store",
        description: "A test store for WooCommerce",
        url: "https://test-store.com",
        wc_version: "7.0.0",
        version: "6.3.0",
        currency: "USD",
        currency_symbol: "$",
        timezone: "America/New_York",
        gmt_offset: 0,
      });

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        storeInfo,
      });
    });

    it("should handle connection validation failure", async () => {
      wooCommerceService.on("connection:failed", mockEventListener);
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(
        wooCommerceService.validateConnection(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).rejects.toThrow("Failed to validate WooCommerce connection: Connection failed");

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        error: expect.any(Error),
      });
    });

    it("should use default values when settings are missing", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { environment: {} } } as any)
        .mockResolvedValueOnce({ data: [] } as any);

      const storeInfo = await wooCommerceService.validateConnection(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(storeInfo).toEqual({
        id: "https://test-store.com",
        name: "WooCommerce Store",
        description: "",
        url: "https://test-store.com",
        wc_version: "unknown",
        version: "unknown",
        currency: "USD",
        currency_symbol: "$",
        timezone: "UTC",
        gmt_offset: 0,
      });
    });
  });

  describe("Connection Testing", () => {
    it("should return true for successful connection test", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: {} } as any)
        .mockResolvedValueOnce({ data: [] } as any);

      const result = await wooCommerceService.testConnection(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(result).toBe(true);
    });

    it("should return false for failed connection test", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Connection failed"));

      const result = await wooCommerceService.testConnection(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(result).toBe(false);
    });
  });

  describe("Webhook Setup", () => {
    it("should setup webhooks successfully", async () => {
      wooCommerceService.on("webhooks:setup", mockEventListener);
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 123 } } as any);

      await wooCommerceService.setupWebhooks(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      const expectedEvents = [
        "order.created",
        "order.updated",
        "order.deleted",
        "product.created",
        "product.updated",
        "product.deleted",
        "customer.created",
        "customer.updated",
        "customer.deleted",
      ];

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(expectedEvents.length);

      for (const event of expectedEvents) {
        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/webhooks", {
          name: `Social Proof App - ${event}`,
          topic: event,
          delivery_url: "https://api.example.com/api/integrations/webhooks/woocommerce",
          secret: "test_webhook_secret",
          status: "active",
        });
      }

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        events: expectedEvents,
      });
    });

    it("should handle webhook setup failures gracefully", async () => {
      wooCommerceService.on("webhooks:failed", mockEventListener);
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { id: 123 } } as any) // First webhook succeeds
        .mockRejectedValueOnce(new Error("Webhook creation failed")); // Second webhook fails

      await wooCommerceService.setupWebhooks(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create webhook for"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle complete webhook setup failure", async () => {
      wooCommerceService.on("webhooks:failed", mockEventListener);
      mockAxiosInstance.post.mockRejectedValue(new Error("Complete failure"));

      await expect(
        wooCommerceService.setupWebhooks(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).rejects.toThrow("Failed to setup webhooks: Complete failure");

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        error: expect.any(Error),
      });
    });
  });

  describe("Store Data Sync", () => {
    const mockProducts: WooCommerceProduct[] = [
      {
        id: 1,
        name: "Test Product 1",
        price: "19.99",
      } as WooCommerceProduct,
      {
        id: 2,
        name: "Test Product 2",
        price: "29.99",
      } as WooCommerceProduct,
    ];

    const mockOrders: WooCommerceOrder[] = [
      {
        id: 1,
        total: "49.98",
        status: "completed",
      } as WooCommerceOrder,
      {
        id: 2,
        total: "19.99",
        status: "processing",
      } as WooCommerceOrder,
    ];

    it("should sync store data successfully", async () => {
      wooCommerceService.on("data:synced", mockEventListener);
      
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockProducts } as any)
        .mockResolvedValueOnce({ data: mockOrders } as any);

      await wooCommerceService.syncStoreData(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret,
        "user123"
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/products", {
        params: { per_page: 100 },
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/orders", {
        params: { per_page: 100 },
      });

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        userId: "user123",
        products: 2,
        orders: 2,
      });
    });

    it("should handle sync failure", async () => {
      wooCommerceService.on("sync:failed", mockEventListener);
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Sync failed"));

      await expect(
        wooCommerceService.syncStoreData(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret,
          "user123"
        )
      ).rejects.toThrow("Failed to sync store data: Sync failed");

      expect(mockEventListener).toHaveBeenCalledWith({
        storeUrl: "https://test-store.com",
        userId: "user123",
        error: expect.any(Error),
      });
    });
  });

  describe("Products", () => {
    const mockProducts: WooCommerceProduct[] = [
      {
        id: 1,
        name: "Test Product 1",
        price: "19.99",
        status: "publish",
      } as WooCommerceProduct,
      {
        id: 2,
        name: "Test Product 2",
        price: "29.99",
        status: "publish",
      } as WooCommerceProduct,
    ];

    it("should get products with default parameters", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockProducts } as any);

      const products = await wooCommerceService.getProducts(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/products", { params: {} });
      expect(products).toEqual(mockProducts);
    });

    it("should get products with custom parameters", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockProducts } as any);

      const params = {
        page: 2,
        per_page: 50,
        search: "test",
        category: "electronics",
        status: "publish",
      };

      const products = await wooCommerceService.getProducts(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret,
        params
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/products", { params });
      expect(products).toEqual(mockProducts);
    });

    it("should handle get products error", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("API Error"));

      await expect(
        wooCommerceService.getProducts(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).rejects.toThrow("Failed to get products: API Error");
    });
  });

  describe("Orders", () => {
    const mockOrders: WooCommerceOrder[] = [
      {
        id: 1,
        total: "49.98",
        status: "completed",
        customer_id: 1,
      } as WooCommerceOrder,
      {
        id: 2,
        total: "19.99",
        status: "processing",
        customer_id: 2,
      } as WooCommerceOrder,
    ];

    it("should get orders with default parameters", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockOrders } as any);

      const orders = await wooCommerceService.getOrders(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/orders", { params: {} });
      expect(orders).toEqual(mockOrders);
    });

    it("should get orders with custom parameters", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockOrders } as any);

      const params = {
        page: 1,
        per_page: 25,
        status: "completed",
        customer: 123,
        after: "2023-01-01T00:00:00",
        before: "2023-12-31T23:59:59",
      };

      const orders = await wooCommerceService.getOrders(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret,
        params
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/orders", { params });
      expect(orders).toEqual(mockOrders);
    });

    it("should handle get orders error", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("API Error"));

      await expect(
        wooCommerceService.getOrders(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).rejects.toThrow("Failed to get orders: API Error");
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({ id: 123, status: "completed" });
      const secret = "test_webhook_secret";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("base64");

      const isValid = wooCommerceService.verifyWebhookSignature(payload, signature, secret);
      
      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({ id: 123, status: "completed" });
      const secret = "test_webhook_secret";
      const invalidSignature = "invalid_signature";

      const isValid = wooCommerceService.verifyWebhookSignature(payload, invalidSignature, secret);
      
      expect(isValid).toBe(false);
    });

    it("should handle signature verification errors", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      
      const payload = "invalid json";
      const secret = "test_webhook_secret";
      const signature = "invalid_base64!@#";

      const isValid = wooCommerceService.verifyWebhookSignature(payload, signature, secret);
      
      expect(isValid).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Webhook signature verification failed:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Webhook Event Processing", () => {
    beforeEach(() => {
      wooCommerceService.on("webhook:received", mockEventListener);
    });

    it("should process webhook event successfully", async () => {
      const mockData = { id: 123, name: "Test Product" };
      
      await wooCommerceService.processWebhookEvent(
        "created",
        "product",
        mockData,
        "https://test-store.com"
      );

      expect(mockEventListener).toHaveBeenCalledWith({
        event: "created",
        resource: "product",
        storeUrl: "https://test-store.com",
        data: mockData,
        timestamp: expect.any(Date),
      });
    });

    it("should handle different event types", async () => {
      const mockData = { id: 456, status: "updated" };
      const events = ["created", "updated", "deleted"];

      for (const event of events) {
        await wooCommerceService.processWebhookEvent(
          event,
          "order",
          mockData,
          "https://test-store.com"
        );
      }

      expect(mockEventListener).toHaveBeenCalledTimes(events.length);
    });

    it("should warn about unhandled events", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      
      await wooCommerceService.processWebhookEvent(
        "unknown_event",
        "product",
        {},
        "https://test-store.com"
      );

      expect(consoleSpy).toHaveBeenCalledWith("Unhandled WooCommerce webhook event: unknown_event");
      consoleSpy.mockRestore();
    });

    it("should emit error events when processing fails", async () => {
      wooCommerceService.on("webhook:error", mockEventListener);
      
      // Mock an error in event handling
      const originalEmit = wooCommerceService.emit;
      wooCommerceService.emit = jest.fn().mockImplementation((event, ...args) => {
        if (event === "product:created") {
          throw new Error("Processing failed");
        }
        return originalEmit.call(wooCommerceService, event, ...args);
      }) as any;

      await expect(
        wooCommerceService.processWebhookEvent(
          "created",
          "product",
          {},
          "https://test-store.com"
        )
      ).rejects.toThrow("Processing failed");

      expect(mockEventListener).toHaveBeenCalledWith({
        event: "created",
        resource: "product",
        storeUrl: "https://test-store.com",
        error: expect.any(Error),
      });
    });
  });

  describe("Resource Event Handling", () => {
    it("should handle resource created events", async () => {
      wooCommerceService.on("product:created", mockEventListener);
      
      const mockData = { id: 123, name: "New Product" };
      
      // Access private method through any
      const handleResourceCreated = (wooCommerceService as any).handleResourceCreated.bind(wooCommerceService);
      
      await handleResourceCreated("product", mockData, "https://test-store.com");

      expect(mockEventListener).toHaveBeenCalledWith({
        data: mockData,
        storeUrl: "https://test-store.com",
      });
    });

    it("should handle resource updated events", async () => {
      wooCommerceService.on("order:updated", mockEventListener);
      
      const mockData = { id: 456, status: "completed" };
      
      // Access private method through any
      const handleResourceUpdated = (wooCommerceService as any).handleResourceUpdated.bind(wooCommerceService);
      
      await handleResourceUpdated("order", mockData, "https://test-store.com");

      expect(mockEventListener).toHaveBeenCalledWith({
        data: mockData,
        storeUrl: "https://test-store.com",
      });
    });

    it("should handle resource deleted events", async () => {
      wooCommerceService.on("customer:deleted", mockEventListener);
      
      const mockData = { id: 789 };
      
      // Access private method through any
      const handleResourceDeleted = (wooCommerceService as any).handleResourceDeleted.bind(wooCommerceService);
      
      await handleResourceDeleted("customer", mockData, "https://test-store.com");

      expect(mockEventListener).toHaveBeenCalledWith({
        data: mockData,
        storeUrl: "https://test-store.com",
      });
    });
  });

  describe("Store Information", () => {
    it("should get store information", async () => {
      const mockStoreInfo: WooCommerceStoreInfo = {
        id: "test-store",
        name: "Test Store",
        description: "A test store",
        url: "https://test-store.com",
        wc_version: "7.0.0",
        version: "6.3.0",
        currency: "USD",
        currency_symbol: "$",
        timezone: "UTC",
        gmt_offset: 0,
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: {} } as any)
        .mockResolvedValueOnce({ data: [] } as any);

      // Mock validateConnection to return our test data
      jest.spyOn(wooCommerceService, "validateConnection").mockResolvedValue(mockStoreInfo);

      const storeInfo = await wooCommerceService.getStoreInfo(
        testConfig.storeUrl,
        testConfig.consumerKey,
        testConfig.consumerSecret
      );

      expect(storeInfo).toEqual(mockStoreInfo);
    });
  });

  describe("Resource Cleanup", () => {
    it("should cleanup resources", async () => {
      // Create some clients first
      const getClient = (wooCommerceService as any).getClient.bind(wooCommerceService);
      getClient(testConfig);
      getClient({ ...testConfig, storeUrl: "https://another-store.com" });

      await wooCommerceService.cleanup();

      // Check that clients map is cleared
      const clients = (wooCommerceService as any).clients;
      expect(clients.size).toBe(0);

      // Check that event listeners are removed
      expect(wooCommerceService.listenerCount("webhook:received")).toBe(0);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle network timeouts", async () => {
      const timeoutError = new Error("Network timeout");
      timeoutError.name = "ECONNRESET";
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(
        wooCommerceService.getProducts(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).rejects.toThrow("Failed to get products: Network timeout");
    });

    it("should handle authentication errors", async () => {
      const authError = new Error("Unauthorized");
      mockAxiosInstance.get.mockRejectedValue(authError);

      await expect(
        wooCommerceService.validateConnection(
          testConfig.storeUrl,
          "invalid_key",
          "invalid_secret"
        )
      ).rejects.toThrow("Failed to validate WooCommerce connection: Unauthorized");
    });

    it("should handle malformed API responses", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: null } as any);

      await expect(
        wooCommerceService.getProducts(
          testConfig.storeUrl,
          testConfig.consumerKey,
          testConfig.consumerSecret
        )
      ).resolves.toBeNull();
    });
  });
});