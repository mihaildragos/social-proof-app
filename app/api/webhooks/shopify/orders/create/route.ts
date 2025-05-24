import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import MockRedis from "@/app/lib/mock-redis";

// Create Redis client for publishing notifications
const getRedisClient = () => {
  console.log("Webhook Redis config - NODE_ENV:", process.env.NODE_ENV);
  console.log("Webhook Redis config - REDIS_HOST:", process.env.REDIS_HOST);
  console.log("Webhook Redis config - USE_MOCK_REDIS:", process.env.USE_MOCK_REDIS);

  // Always use real Redis for testing
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      return Math.min(times * 500, 3000);
    },
  });

  redis.on("error", (err: Error) => {
    console.error("Webhook Redis connection error:", err);
  });

  redis.on("connect", () => {
    console.log("Webhook: Connected to Redis successfully");
  });

  return redis;
};

export async function POST(req: NextRequest) {
  try {
    console.log("=== Shopify Webhook Received ===");

    // Parse the webhook payload
    const orderData = await req.json();
    console.log("Order ID:", orderData.id);
    console.log("Shop Domain:", req.headers.get("x-shopify-shop-domain"));

    // Extract shop domain from headers or order data
    const shopDomain = req.headers.get("x-shopify-shop-domain") || orderData.shop_domain;

    if (!shopDomain) {
      console.error("No shop domain found in webhook");
      return NextResponse.json({ error: "Shop domain required" }, { status: 400 });
    }

    // For testing, we'll map shop domain to site ID
    // In production, you'd look this up in the database
    const siteId = await getSiteIdFromShopDomain(shopDomain);

    if (!siteId) {
      console.error("No site ID found for shop domain:", shopDomain);
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    console.log("Mapped to site ID:", siteId);

    // Create notification data
    const notification = {
      id: `notif_${Date.now()}`,
      type: "order.created",
      siteId: siteId,
      shopDomain: shopDomain,
      title: "New Order! 🎉",
      message: "Someone just purchased a product",
      content: {
        title: "New Order! 🎉",
        message: `${orderData.customer?.first_name || "Someone"} just purchased ${orderData.line_items?.[0]?.title || "a product"}`,
        customer_name:
          `${orderData.customer?.first_name || ""} ${orderData.customer?.last_name || ""}`.trim() ||
          "Anonymous",
        product_name: orderData.line_items?.[0]?.title || "Unknown Product",
        amount: orderData.total_price || "0.00",
        currency: orderData.currency || "USD",
        location:
          orderData.shipping_address ?
            `${orderData.shipping_address.city}, ${orderData.shipping_address.country}`
          : "Unknown Location",
        url:
          orderData.line_items?.[0]?.product_id ?
            `https://${shopDomain}/products/${orderData.line_items[0].product_id}`
          : undefined,
      },
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log("Created notification:", JSON.stringify(notification, null, 2));

    // Publish to Redis channel for SSE
    const redis = getRedisClient();
    const channel = `notifications:site:${siteId}`;

    try {
      console.log(`Publishing notification to channel: ${channel}`);
      await redis.publish(channel, JSON.stringify(notification));
      console.log("✅ Notification published successfully");

      return NextResponse.json({
        success: true,
        message: "Webhook processed successfully",
        notificationId: notification.id,
        siteId: siteId,
      });
    } catch (error) {
      console.error("Error publishing notification:", error);
      return NextResponse.json({ error: "Failed to publish notification" }, { status: 500 });
    } finally {
      redis.quit();
    }
  } catch (error) {
    console.error("Error processing Shopify webhook:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

// Helper function to get site ID from shop domain
async function getSiteIdFromShopDomain(shopDomain: string): Promise<string | null> {
  try {
    console.log(`🔍 WEBHOOK: Looking up site ID for shop domain: ${shopDomain}`);
    
    // Try database lookup for both test and real shop domains
    const { createClerkSupabaseClientSsr } = await import("@/utils/supabase/server");
    const supabase = await createClerkSupabaseClientSsr();

    console.log(`🔍 WEBHOOK: Supabase client created, type: ${typeof supabase}`);
    console.log(`🔍 WEBHOOK: Supabase client from method: ${supabase.from ? 'has from method' : 'no from method'}`);

    // Debug: Let's see what integrations exist
    console.log(`🔍 WEBHOOK: Querying all Shopify integrations...`);
    const { data: allIntegrations, error: debugError } = await supabase
      .from("integrations")
      .select("site_id, provider, settings")
      .eq("provider", "shopify");

    // Debug: Let's also see what sites exist
    console.log(`🔍 WEBHOOK: Querying all sites...`);
    const { data: allSites, error: sitesDebugError } = await supabase
      .from("sites")
      .select("id, name, domain, settings")
      .limit(5);

    console.log("🔍 WEBHOOK: All Shopify integrations in database:", JSON.stringify(allIntegrations, null, 2));
    console.log("🔍 WEBHOOK: All sites in database (first 5):", JSON.stringify(allSites, null, 2));
    console.log("🔍 WEBHOOK: Looking for shop domain:", shopDomain);

    if (shopDomain.includes("test-store")) {
      // For test sites, search in the integrations table where shop domain is stored
      console.log("🔍 WEBHOOK: Searching for test site integration...");
      console.log("🔍 WEBHOOK: Query: integrations.provider = 'shopify' AND settings->shop_domain = '" + shopDomain + "'");
      
      const { data: integrations, error } = await supabase
        .from("integrations")
        .select("site_id, settings")
        .eq("provider", "shopify")
        .eq("settings->shop_domain", shopDomain);

      console.log("🔍 WEBHOOK: Query result - integrations:", JSON.stringify(integrations, null, 2));
      console.log("🔍 WEBHOOK: Query error:", error);

      if (error) {
        console.error("Database error looking up test integration:", error);
        return null;
      }

      if (!integrations || integrations.length === 0) {
        console.error("No test integration found for shop domain:", shopDomain);
        console.log("Trying fallback lookup in sites table...");
        
        // Fallback: try sites table
        const { data: sites, error: sitesError } = await supabase
          .from("sites")
          .select("id, settings")
          .eq("settings->test_shop_domain", shopDomain);

        console.log("DEBUG: Sites table query result:", sites);
        console.log("DEBUG: Sites table query error:", sitesError);

        if (sitesError || !sites || sites.length === 0) {
          console.error("No test site found in fallback lookup:", sitesError);
          return null;
        }

        const site = sites[0];
        console.log(`Found test site ID ${site.id} for shop domain ${shopDomain} (fallback)`);
        return site.id;
      }

      const integration = integrations[0];
      console.log(`Found test site ID ${integration.site_id} for shop domain ${shopDomain}`);
      return integration.site_id;
    } else {
      // For real sites, search in the integrations table  
      const { data: integrations, error } = await supabase
        .from("integrations")
        .select("site_id")
        .eq("provider", "shopify")
        .eq("settings->shop_domain", shopDomain);

      if (error || !integrations || integrations.length === 0) {
        console.error("No real integration found for shop domain:", shopDomain, error);
        return null;
      }

      const integration = integrations[0];
      console.log(`Found real site ID ${integration.site_id} for shop domain ${shopDomain}`);
      return integration.site_id;
    }

  } catch (error) {
    console.error("Error looking up site:", error);
    return null;
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, X-Shopify-Shop-Domain, X-Shopify-Hmac-Sha256",
      },
    }
  );
}
