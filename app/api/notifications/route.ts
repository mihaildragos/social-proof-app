import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";
import { SiteStatus } from "@/types/sites";
import MockRedis from "@/lib/mock-redis";

// Create Redis client instance
const getRedisClient = () => {
  // Use mock Redis in development mode if Redis is not available
  if (
    process.env.NODE_ENV === "development" &&
    (process.env.USE_MOCK_REDIS === "true" || !process.env.REDIS_HOST)
  ) {
    console.log("Using mock Redis implementation for development");
    return new MockRedis() as unknown as Redis;
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      return Math.min(times * 500, 3000);
    },
  });

  redis.on("error", (err: Error) => {
    console.error("Redis connection error:", err);
    if (process.env.NODE_ENV === "development") {
      console.warn("Consider using mock Redis for development by setting USE_MOCK_REDIS=true");
    }
  });

  return redis;
};

export async function GET(req: NextRequest) {
  try {
    // Get the site ID from query parameters
    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId parameter" }, { status: 400 });
    }

    // Verify that the site exists and is verified
    const supabase = await createClerkSupabaseClientSsr();
    const { data: site, error } = await supabase
      .from("sites")
      .select("status, domain")
      .eq("id", siteId)
      .single();

    if (error || !site) {
      console.error("Error fetching site for notifications:", error);
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // If site is not verified, don't provide notifications
    if (site.status !== SiteStatus.VERIFIED) {
      return NextResponse.json({ error: "Site not verified" }, { status: 403 });
    }

    // Get Redis client and fetch recent notifications
    const redis = getRedisClient();

    try {
      // Get site-specific notification keys (last 10)
      const notificationKeys = await redis.keys(`notification:*:${siteId}:*`);

      // Sort by most recent (using timestamps in the keys)
      notificationKeys.sort().reverse();

      // Take up to 5 most recent notifications
      const recentKeys = notificationKeys.slice(0, 5);

      const notifications = [];

      // Get each notification content
      for (const key of recentKeys) {
        const notificationData = await redis.get(key);
        if (notificationData) {
          try {
            const notification = JSON.parse(notificationData);
            notifications.push(notification);
          } catch (err) {
            console.error("Error parsing notification data:", err);
          }
        }
      }

      return NextResponse.json(
        {
          siteId,
          notifications,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } finally {
      // Close Redis connection
      redis.quit();
    }
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
