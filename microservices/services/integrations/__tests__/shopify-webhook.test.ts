import request from "supertest";
import { createServer } from "../server";
import ShopifyWebhookMock from "../../../shared/test/mocks/shopify-webhooks";
import { KafkaProducer } from "../../../shared/src/events/producer";

// Mock Kafka producer
jest.mock("../../../shared/kafka/producer");

describe("Shopify Webhook Integration", () => {
  // Initialize test server
  const app = createServer();
  const webhookMock = new ShopifyWebhookMock("test_webhook_secret");

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Kafka producer methods
    (KafkaProducer.prototype.connect as jest.Mock).mockResolvedValue(undefined);
    (KafkaProducer.prototype.disconnect as jest.Mock).mockResolvedValue(undefined);
    (KafkaProducer.prototype.produce as jest.Mock).mockResolvedValue({
      topicName: "order-events",
      partition: 0,
      errorCode: 0,
    });
  });

  describe("Order Created Webhook", () => {
    it("should process valid order webhook and produce Kafka message", async () => {
      // Generate mock order webhook payload and headers
      const { payload, headers } = webhookMock.orderCreatedWebhook();

      // Send webhook request
      const response = await request(app)
        .post("/webhooks/shopify/orders/create")
        .set(headers)
        .send(payload);

      // Verify response
      expect(response.status).toBe(200);

      // Verify Kafka producer was called
      expect(KafkaProducer.prototype.connect).toHaveBeenCalled();
      expect(KafkaProducer.prototype.produce).toHaveBeenCalledWith(
        "order-events",
        expect.objectContaining({
          event_type: "order.created",
          source: "shopify",
          shop_domain: "test-store.myshopify.com",
          data: expect.objectContaining({
            order_id: payload.id.toString(),
            customer: expect.objectContaining({
              email: payload.email,
            }),
          }),
        })
      );
      expect(KafkaProducer.prototype.disconnect).toHaveBeenCalled();
    });

    it("should reject webhook with invalid HMAC signature", async () => {
      // Generate mock order webhook
      const { payload } = webhookMock.orderCreatedWebhook();

      // Use invalid headers (wrong signature)
      const invalidHeaders = {
        "X-Shopify-Topic": "orders/create",
        "X-Shopify-Hmac-Sha256": "invalid_signature",
        "X-Shopify-Shop-Domain": "test-store.myshopify.com",
        "Content-Type": "application/json",
      };

      // Send webhook request with invalid signature
      const response = await request(app)
        .post("/webhooks/shopify/orders/create")
        .set(invalidHeaders)
        .send(payload);

      // Verify response
      expect(response.status).toBe(401);

      // Verify Kafka producer was not called
      expect(KafkaProducer.prototype.produce).not.toHaveBeenCalled();
    });
  });
});
