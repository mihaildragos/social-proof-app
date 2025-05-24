#!/usr/bin/env node

/**
 * Test SSE Redis connection by checking subscribers
 */

const Redis = require("ioredis");

async function testSSERedis() {
  console.log("🔍 Testing SSE Redis Connection\n");

  const SITE_ID = "test-1748097455230";
  const CHANNEL = `notifications:site:${SITE_ID}`;

  try {
    // Connect to Redis to monitor
    const redis = new Redis({
      host: "localhost",
      port: 6379,
    });

    console.log("1️⃣ Connected to Redis for monitoring");

    // Check current subscribers
    const subscribers = await redis.pubsub("channels", CHANNEL);
    console.log(`2️⃣ Current subscribers to ${CHANNEL}:`, subscribers);

    // Check all active channels with subscribers
    const allChannels = await redis.pubsub("channels");
    console.log("3️⃣ All active Redis channels:", allChannels);

    if (allChannels.length > 0) {
      for (const channel of allChannels) {
        const numSubs = await redis.pubsub("numsub", channel);
        console.log(`   - ${channel}: ${numSubs[1]} subscribers`);
      }
    } else {
      console.log("   - No active channels found");
    }

    await redis.quit();

    console.log("\n📋 Analysis:");
    console.log("============");
    if (subscribers.length === 0 && allChannels.length === 0) {
      console.log("❌ No Redis subscriptions found");
      console.log("   - SSE endpoint might not be connecting to Redis");
      console.log("   - Check SSE endpoint logs for Redis connection errors");
      console.log("   - The test page needs to be open with active SSE connection");
    } else {
      console.log("✅ Redis subscriptions are working");
    }

    console.log("\n🎯 Instructions:");
    console.log("================");
    console.log(
      "1. Open your test page: http://localhost:3000/test-client.html?siteId=test-1748097455230"
    );
    console.log("2. Keep it open and wait for SSE connection");
    console.log("3. Run this test again while the page is open");
    console.log("4. If still 0 subscribers, there's an SSE Redis connection issue");
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Run the test
testSSERedis().catch(console.error);
