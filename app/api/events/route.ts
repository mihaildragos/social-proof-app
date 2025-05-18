import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";
import { SiteStatus } from "@/types/sites";
import MockRedis from "@/lib/mock-redis";

// Create Redis client instance for event tracking
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

// Define the event interface
interface NotificationEvent {
  site_id: string;
  event_type: "impression" | "click" | "conversion";
  data: {
    notification_id: string;
    [key: string]: any;
  };
  url?: string;
  timestamp: string;
  user_id?: string;
  session_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const event: NotificationEvent = await req.json();

    // Validate the required fields
    if (!event.site_id || !event.event_type || !event.data || !event.data.notification_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify that the site exists and is verified
    const supabase = await createClerkSupabaseClientSsr();
    const { data: site, error } = await supabase
      .from("sites")
      .select("status")
      .eq("id", event.site_id)
      .single();

    if (error || !site) {
      console.error("Error fetching site for event tracking:", error);
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // If site is not verified, don't track events
    if (site.status !== SiteStatus.VERIFIED) {
      return NextResponse.json({ error: "Site not verified" }, { status: 403 });
    }

    // Set up Redis client for tracking the event
    const redis = getRedisClient();

    try {
      // Get some additional browser info
      let userAgent = req.headers.get("user-agent") || "";
      let ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "0.0.0.0";
      if (typeof ip === "string" && ip.includes(",")) {
        ip = ip.split(",")[0].trim();
      }

      // Generate a unique ID for the event
      const eventId = crypto.randomUUID();

      // Add some metadata to the event
      const eventData = {
        ...event,
        id: eventId,
        ip: ip,
        user_agent: userAgent,
        recorded_at: new Date().toISOString(),
      };

      // Update the notification status counters
      if (event.event_type === "impression") {
        await redis.hincrby(
          `notification:status:${event.data.notification_id}`,
          "delivered_count",
          1
        );

        // Set first delivered timestamp if this is the first delivery
        const deliveredCount = await redis.hget(
          `notification:status:${event.data.notification_id}`,
          "delivered_count"
        );
        if (deliveredCount === "1") {
          await redis.hset(
            `notification:status:${event.data.notification_id}`,
            "first_delivered_at",
            eventData.recorded_at
          );
        }
      } else if (event.event_type === "click") {
        await redis.hincrby(
          `notification:status:${event.data.notification_id}`,
          "clicked_count",
          1
        );

        // Set first click timestamp if this is the first click
        const clickedCount = await redis.hget(
          `notification:status:${event.data.notification_id}`,
          "clicked_count"
        );
        if (clickedCount === "1") {
          await redis.hset(
            `notification:status:${event.data.notification_id}`,
            "first_clicked_at",
            eventData.recorded_at
          );
        }
      }

      // Store the event in Redis (will be processed by a background worker for storage in the database)
      const eventKey = `event:${event.site_id}:${eventId}`;
      await redis.set(eventKey, JSON.stringify(eventData));
      await redis.expire(eventKey, 86400); // 24-hour TTL

      // Add to the events queue for processing
      await redis.lpush("events:queue", eventKey);

      // Return success
      return NextResponse.json(
        { success: true, eventId },
        {
          status: 200,
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
    console.error("Error processing event:", error);
    return NextResponse.json({ error: "Failed to process event" }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    }
  );
}
