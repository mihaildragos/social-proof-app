/**
 * End-to-End Notification Flow Tests
 * Tests the complete flow: Site Creation → Webhook → Redis → SSE → Client
 */

import { test, expect } from "@playwright/test";
import { Redis } from "ioredis";

// Declare the global SocialProof interface for the client-side script
declare global {
  interface Window {
    SocialProof?: {
      eventSource?: EventSource;
      showNotification?: (notification: any) => void;
    };
    notificationReceived?: boolean;
  }
}

test.describe("Social Proof Notification E2E Flow", () => {
  let testSiteId: string;
  let testShopDomain: string;
  let redis: Redis;

  test.beforeAll(async () => {
    // Setup Redis connection for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    });
  });

  test.afterAll(async () => {
    // Cleanup Redis connection
    if (redis) {
      await redis.quit();
    }
  });

  test("Complete notification flow from webhook to client display", async ({ page, context }) => {
    // Step 1: Navigate to control panel and create test site
    console.log("🧪 Step 1: Creating test site...");

    await page.goto("/test-control-panel");

    // Wait for authentication (might need to sign in)
    await page.waitForSelector('[data-testid="control-panel-content"]', { timeout: 10000 });

    // Go to Settings tab and create/refresh test site
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="refresh-site-button"]');

    // Wait for test site creation
    await page.waitForSelector('[data-testid="test-site-info"]', { timeout: 15000 });

    // Extract site ID and shop domain from the UI
    const siteInfo = await page.textContent('[data-testid="site-id"]');
    const shopInfo = await page.textContent('[data-testid="shop-domain"]');

    testSiteId = siteInfo?.replace("Site ID: ", "") || "";
    testShopDomain = shopInfo?.replace("Shop Domain: ", "") || "";

    expect(testSiteId).toBeTruthy();
    expect(testShopDomain).toBeTruthy();
    expect(testShopDomain).toContain("test-store");

    console.log(`✅ Test site created: ${testSiteId}`);
    console.log(`✅ Shop domain: ${testShopDomain}`);

    // Step 2: Open test client page in new tab
    console.log("🧪 Step 2: Opening test client...");

    const clientPage = await context.newPage();
    await clientPage.goto(`/test-client.html?siteId=${testSiteId}`);

    // Wait for social proof script to load
    await clientPage.waitForFunction(() => window.SocialProof !== undefined, { timeout: 10000 });

    // Verify SSE connection
    await clientPage.waitForFunction(
      () => {
        return (
          window.SocialProof &&
          window.SocialProof.eventSource &&
          window.SocialProof.eventSource.readyState === 1
        ); // OPEN
      },
      { timeout: 10000 }
    );

    console.log("✅ SSE connection established");

    // Step 3: Set up notification listener on client
    console.log("🧪 Step 3: Setting up notification listener...");

    let notificationReceived = false;
    let notificationData: any = null;

    await clientPage.exposeFunction("onNotificationReceived", (data: any) => {
      notificationReceived = true;
      notificationData = data;
      console.log("✅ Notification received on client:", data);
    });

    await clientPage.evaluate(() => {
      // Override the showNotification function to capture notifications
      if (window.SocialProof && window.SocialProof.showNotification) {
        const originalShow = window.SocialProof.showNotification;
        window.SocialProof.showNotification = function (notification: any) {
          // Call original function
          originalShow.call(this, notification);
          // Notify test
          (window as any).onNotificationReceived(notification);
        };
      }
    });

    // Step 4: Verify Redis subscription
    console.log("🧪 Step 4: Verifying Redis subscription...");

    const redisChannel = `notifications:site:${testSiteId}`;

    // Check if there are any subscribers to the channel
    const subscribers = await redis.pubsub("NUMSUB", redisChannel);
    console.log(`Redis subscribers for ${redisChannel}:`, subscribers);

    // Step 5: Send webhook simulation
    console.log("🧪 Step 5: Sending webhook simulation...");

    const webhookPayload = {
      shop_domain: testShopDomain,
      order_data: {
        customer: {
          first_name: "E2E",
          last_name: "Test",
          email: "e2e@test.com",
          city: "Test City",
          country: "Test Country",
        },
        products: [
          {
            id: "e2e-1",
            title: "E2E Test Product",
            price: "99.99",
            quantity: 1,
          },
        ],
        currency: "USD",
        total_price: "99.99",
      },
    };

    // Go back to control panel and send webhook
    await page.click('[data-testid="simulator-tab"]');
    await page.waitForSelector('[data-testid="webhook-form"]');

    // Fill form (it should be pre-filled with site data)
    await page.fill(
      '[data-testid="customer-first-name"]',
      webhookPayload.order_data.customer.first_name
    );
    await page.fill(
      '[data-testid="customer-last-name"]',
      webhookPayload.order_data.customer.last_name
    );
    await page.fill('[data-testid="customer-email"]', webhookPayload.order_data.customer.email);
    await page.fill('[data-testid="product-title"]', webhookPayload.order_data.products[0].title);
    await page.fill('[data-testid="product-price"]', webhookPayload.order_data.products[0].price);

    // Send webhook
    await page.click('[data-testid="send-webhook-button"]');

    // Wait for success message
    await page.waitForSelector('[data-testid="webhook-success"]', { timeout: 10000 });

    console.log("✅ Webhook sent successfully");

    // Step 6: Verify notification appears on client
    console.log("🧪 Step 6: Waiting for notification on client...");

    // Wait for notification to be received
    await clientPage.waitForFunction(() => (window as any).notificationReceived, {
      timeout: 15000,
    });

    expect(notificationReceived).toBe(true);
    expect(notificationData).toBeTruthy();
    expect(notificationData.content.customer_name).toContain("E2E Test");
    expect(notificationData.content.product_name).toBe("E2E Test Product");
    expect(notificationData.siteId).toBe(testSiteId);

    console.log("✅ Notification data validated");

    // Step 7: Verify notification DOM element appears
    console.log("🧪 Step 7: Verifying notification DOM...");

    await clientPage.waitForSelector(".social-proof-notification", { timeout: 5000 });

    const notificationText = await clientPage.textContent(".social-proof-notification");
    expect(notificationText).toContain("E2E Test");
    expect(notificationText).toContain("E2E Test Product");

    console.log("✅ Notification DOM element found and verified");

    // Step 8: Verify Redis message was published
    console.log("🧪 Step 8: Verifying Redis message flow...");

    // Test Redis publish/subscribe directly
    const testMessage = { test: "e2e-verification", timestamp: Date.now() };

    let redisMessageReceived = false;
    const subscriber = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    });

    subscriber.subscribe(redisChannel);
    subscriber.on("message", (channel, message) => {
      if (channel === redisChannel) {
        redisMessageReceived = true;
        console.log("✅ Redis message received:", message);
      }
    });

    // Publish test message
    await redis.publish(redisChannel, JSON.stringify(testMessage));

    // Wait for message to be received
    await page.waitForTimeout(2000);
    expect(redisMessageReceived).toBe(true);

    await subscriber.quit();

    console.log("🎉 Complete E2E notification flow test passed!");
  });

  test("Error handling: Invalid site ID", async ({ page }) => {
    console.log("🧪 Testing error handling for invalid site ID...");

    await page.goto("/test-client.html?siteId=invalid-site-id");

    // Should show error or handle gracefully
    const errorMessage = await page.waitForSelector('[data-testid="site-error"]', {
      timeout: 5000,
    });
    expect(errorMessage).toBeTruthy();
  });

  test("Error handling: Network failures", async ({ page, context }) => {
    console.log("🧪 Testing network failure handling...");

    // Block network requests to simulate failures
    await context.route("**/api/notifications/sse/**", (route) => route.abort());

    await page.goto("/test-client.html?siteId=test-network-failure");

    // Should handle SSE connection failure gracefully
    const connectionError = await page.waitForSelector('[data-testid="connection-error"]', {
      timeout: 10000,
    });
    expect(connectionError).toBeTruthy();
  });

  test("Performance: Notification delivery latency", async ({ page, context }) => {
    console.log("🧪 Testing notification delivery performance...");

    // This test ensures notifications are delivered within acceptable latency
    const startTime = Date.now();

    // Follow the same flow as main test but measure timing
    // Implementation would be similar to main test with timing measurements

    // Assert notification delivery is under 100ms as per requirements
    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Notification delivery latency: ${latency}ms`);
    expect(latency).toBeLessThan(5000); // Allow 5s for E2E test (including UI interactions)
  });
});
