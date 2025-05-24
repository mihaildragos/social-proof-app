import request from "supertest";
import { createServer } from "../server";
import { RedisSubscriber } from "../../../shared/redis/subscriber";

// Mock Redis subscriber
jest.mock("../../../shared/redis/subscriber");

describe("SSE Endpoint Integration", () => {
  const app = createServer();
  let redisSubscriber: jest.Mocked<RedisSubscriber>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis subscriber methods
    redisSubscriber = new RedisSubscriber() as jest.Mocked<RedisSubscriber>;
    (RedisSubscriber as jest.Mock).mockImplementation(() => redisSubscriber);

    // Mock subscribe method with proper types
    redisSubscriber.subscribe.mockImplementation(
      (channel: string, callback: (message: string) => void) => {
        // Store callback for triggering events in tests
        (redisSubscriber as any).callback = callback;
        return Promise.resolve();
      }
    );

    // Mock unsubscribe method
    redisSubscriber.unsubscribe.mockResolvedValue(undefined);
  });

  it("should establish SSE connection and receive notifications", async () => {
    // Start SSE request - this will keep the connection open
    const res = request(app)
      .get("/api/notifications/sse")
      .set("Accept", "text/event-stream")
      .set("Connection", "keep-alive")
      .query({ shopDomain: "test-store.myshopify.com" });

    // Wait a short time to ensure connection is established
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the Redis subscriber was called with correct channel
    expect(redisSubscriber.subscribe).toHaveBeenCalledWith(
      "notifications:test-store.myshopify.com",
      expect.any(Function)
    );

    // Manually trigger a message on the Redis channel
    const testNotification = {
      id: "12345",
      type: "order.created",
      title: "New Order",
      message: "Someone just purchased Test Product",
      timestamp: new Date().toISOString(),
    };

    // Use the stored callback to simulate a Redis message
    (redisSubscriber as any).callback(JSON.stringify(testNotification));

    // Complete the request
    const response = await res;

    // Verify the response has the correct headers for SSE
    expect(response.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(response.headers["cache-control"]).toMatch(/no-cache/);
    expect(response.headers["connection"]).toMatch(/keep-alive/);

    // Verify the response body contains the event data
    // Note: Testing SSE responses is tricky since they're streaming
    // In a real test, you might use a custom SSE client
    expect(response.text).toContain(`data: ${JSON.stringify(testNotification)}`);
  });

  it("should return 400 if shopDomain is missing", async () => {
    const response = await request(app)
      .get("/api/notifications/sse")
      .set("Accept", "text/event-stream");

    expect(response.status).toBe(400);
    expect(redisSubscriber.subscribe).not.toHaveBeenCalled();
  });
});
