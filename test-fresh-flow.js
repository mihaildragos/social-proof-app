#!/usr/bin/env node
/**
 * Fresh Flow Test - Create site and immediately test webhook
 */

const fetch = require("node-fetch");

async function testFreshFlow() {
  console.log("🧪 Testing Fresh Site → Webhook Flow\n");

  try {
    // Step 1: Create a completely fresh test site
    console.log("📝 Creating fresh test site...");
    const timestamp = Date.now();
    const userId = `fresh-user-${timestamp}`;

    const siteResponse = await fetch(
      "http://localhost:3000/api/test-control-panel/test-site-debug",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName: "Fresh Test User" }),
      }
    );

    const siteData = await siteResponse.json();
    console.log("✅ Fresh site created:");
    console.log("   Site ID:", siteData.site.id);
    console.log("   Shop Domain:", siteData.site.shop_domain);

    const { id: siteId, shop_domain: shopDomain } = siteData.site;

    // Step 2: Wait a moment for database write
    console.log("\n⏳ Waiting for database write...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 3: Verify the site exists in database
    console.log("\n🔍 Verifying site in database...");
    const dbResponse = await fetch("http://localhost:3000/api/debug/db-check");
    const dbData = await dbResponse.json();

    const targetIntegration = dbData.integrations.data.find(
      (int) => int.settings?.shop_domain === shopDomain
    );

    if (!targetIntegration) {
      console.error("❌ Integration not found in database!");
      console.log("Looking for shop domain:", shopDomain);
      console.log("Available integrations:");
      dbData.integrations.data.forEach((int) => {
        console.log(`  - ${int.id}: ${int.settings?.shop_domain}`);
      });
      throw new Error("Integration not found");
    }

    console.log("✅ Integration found in database:");
    console.log("   Integration ID:", targetIntegration.id);
    console.log("   Site ID:", targetIntegration.site_id);
    console.log("   Shop Domain:", targetIntegration.settings.shop_domain);

    // Step 4: Test webhook immediately
    console.log("\n🔗 Testing webhook with fresh site...");
    const webhookPayload = {
      id: timestamp,
      customer: { first_name: "Fresh", last_name: "User" },
      line_items: [{ title: "Fresh Product", price: "19.99" }],
      total_price: "19.99",
      currency: "USD",
      shipping_address: { city: "Fresh City", country: "Fresh Country" },
    };

    console.log("Webhook request:");
    console.log("  URL: http://localhost:3000/api/webhooks/shopify/orders/create");
    console.log("  Shop Domain Header:", shopDomain);
    console.log("  Payload:", JSON.stringify(webhookPayload, null, 2));

    const webhookResponse = await fetch(
      "http://localhost:3000/api/webhooks/shopify/orders/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shopify-shop-domain": shopDomain,
        },
        body: JSON.stringify(webhookPayload),
      }
    );

    console.log("\nWebhook response:");
    console.log("  Status:", webhookResponse.status);

    const webhookData = await webhookResponse.json();
    console.log("  Data:", JSON.stringify(webhookData, null, 2));

    if (webhookResponse.ok) {
      console.log("\n🎉 SUCCESS! Fresh flow test passed!");
      console.log("✅ Site creation works");
      console.log("✅ Database storage works");
      console.log("✅ Webhook processing works");
      console.log("✅ Notification created:", webhookData.notificationId);
    } else {
      console.log("\n❌ FAILED! Webhook processing failed");
      throw new Error(`Webhook failed: ${webhookData.error}`);
    }
  } catch (error) {
    console.error("\n💥 Fresh flow test failed:", error.message);
    process.exit(1);
  }
}

testFreshFlow();
