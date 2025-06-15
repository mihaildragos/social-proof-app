import type { IHeaders } from "kafkajs";
import { KafkaConsumer } from "../../../shared/kafka/consumer";
import { RedisPublisher } from "../../../shared/redis/publisher";
import { OrderEventHandler } from "../handlers/order-event-handler";
import { NotificationService } from "../services/notification-service";

// Mock dependencies
jest.mock("../../../shared/redis/publisher");
jest.mock("../services/notification-service");

describe("Kafka Consumer Integration", () => {
  let kafkaConsumer: KafkaConsumer;
  let orderEventHandler: OrderEventHandler;
  let redisPublisher: jest.Mocked<RedisPublisher>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mocked instances
    redisPublisher = new RedisPublisher() as unknown as jest.Mocked<RedisPublisher>;
    notificationService = new NotificationService() as unknown as jest.Mocked<NotificationService>;

    // Create actual handler with mocked dependencies
    orderEventHandler = new OrderEventHandler(redisPublisher, notificationService);

    // Create Kafka consumer with mocked handler
    kafkaConsumer = new KafkaConsumer({
      clientId: "test-client",
      brokers: ["localhost:9092"],
      groupId: "test-group",
      topic: "order-events",
    });

    // Mock handler method for testing
    jest.spyOn(orderEventHandler, "handleOrderCreated").mockResolvedValue(undefined);

    // Attach handler to consumer
    kafkaConsumer.setMessageHandler(orderEventHandler.handleMessage.bind(orderEventHandler));
  });

  afterEach(async () => {
    // Clean up
    await kafkaConsumer.disconnect();
  });

  it("should process order.created events correctly", async () => {
    // Create mock message
    const mockMessage = {
      timestamp: "0",
      attributes: 0,
      headers: {} as IHeaders,
      partition: 0,
      offset: "0",
      key: Buffer.from("test-store.myshopify.com"),
      value: Buffer.from(
        JSON.stringify({
          event_type: "order.created",
          source: "shopify",
          shop_domain: "test-store.myshopify.com",
          data: {
            order_id: "1001",
            customer: {
              email: "customer@example.com",
              first_name: "Test",
              last_name: "Customer",
            },
            total: "99.95",
            currency: "USD",
            products: [
              { id: "11111", title: "Test Product 1", price: "49.98" },
              { id: "22222", title: "Test Product 2", price: "49.97" },
            ],
          },
        })
      ),
    };

    // Manually trigger message processing
    await kafkaConsumer.processMessage(mockMessage);

    // Verify handler was called with correct data
    expect(orderEventHandler.handleOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "order.created",
        source: "shopify",
        shop_domain: "test-store.myshopify.com",
        data: expect.objectContaining({
          order_id: "1001",
        }),
      })
    );

    // Verify notification service was called to create notification
    expect(notificationService.createNotification).toHaveBeenCalled();

    // Verify Redis publisher was called
    expect(redisPublisher.publish).toHaveBeenCalled();
  });
});
