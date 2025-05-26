import { Router, Request, Response } from "express";
import { AnalyticsService } from "../services/analytics-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const analyticsService = new AnalyticsService();

// Validation schemas
const recordEventSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  eventName: z.string().min(1, "Event name is required"),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  properties: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  medium: z.string().optional(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
});

const batchEventsSchema = z.object({
  events: z
    .array(recordEventSchema)
    .min(1, "At least one event is required")
    .max(100, "Maximum 100 events per batch"),
});

const getEventsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventType: z.string().optional(),
  eventName: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).default("100"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
  orderBy: z.enum(["timestamp", "eventType", "eventName"]).default("timestamp"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

// Record single event
router.post(
  "/",
  authMiddleware,
  validateRequest(recordEventSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        eventType,
        eventName,
        userId,
        sessionId,
        properties,
        timestamp,
        source,
        campaign,
        medium,
        referrer,
        userAgent,
        ipAddress,
        location,
      } = req.body;

      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const event = await analyticsService.recordEvent({
        organizationId,
        eventType,
        eventName,
        userId,
        sessionId,
        properties,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        source,
        campaign,
        medium,
        referrer,
        userAgent: userAgent || req.get("User-Agent"),
        ipAddress: ipAddress || req.ip,
        location,
      });

      res.status(201).json({
        success: true,
        event: {
          id: event.id,
          eventType: event.eventType,
          eventName: event.eventName,
          timestamp: event.timestamp,
          createdAt: event.createdAt,
        },
      });
    } catch (error) {
      console.error("Record event error:", error);
      res.status(500).json({
        error: "Failed to record event",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Record batch events
router.post(
  "/batch",
  authMiddleware,
  validateRequest(batchEventsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { events } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const recordedEvents = await analyticsService.recordBatchEvents(
        organizationId,
        events.map((event: any) => ({
          eventType: event.eventType,
          eventName: event.eventName,
          userId: event.userId,
          sessionId: event.sessionId,
          properties: event.properties,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
          source: event.source,
          campaign: event.campaign,
          medium: event.medium,
          referrer: event.referrer,
          userAgent: event.userAgent || req.get("User-Agent"),
          ipAddress: event.ipAddress || req.ip,
          location: event.location,
        }))
      );

      res.status(201).json({
        success: true,
        events: recordedEvents.map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          eventName: event.eventName,
          timestamp: event.timestamp,
        })),
        total: recordedEvents.length,
      });
    } catch (error) {
      console.error("Record batch events error:", error);
      res.status(500).json({
        error: "Failed to record batch events",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get events
router.get(
  "/",
  authMiddleware,
  validateRequest(getEventsSchema, "query"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        startDate,
        endDate,
        eventType,
        eventName,
        userId,
        sessionId,
        limit,
        offset,
        orderBy,
        orderDirection,
      } = req.query;

      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const eventsOptions: any = {
        limit: Number(limit),
        offset: Number(offset),
        orderBy: orderBy as string,
        orderDirection: orderDirection as string,
      };

      if (startDate) eventsOptions.startDate = new Date(startDate as string);
      if (endDate) eventsOptions.endDate = new Date(endDate as string);
      if (eventType) eventsOptions.eventType = eventType as string;
      if (eventName) eventsOptions.eventName = eventName as string;
      if (userId) eventsOptions.userId = userId as string;
      if (sessionId) eventsOptions.sessionId = sessionId as string;

      const result = await analyticsService.getEvents(organizationId, eventsOptions);

      res.json({
        events: result.events,
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: result.total > Number(offset) + Number(limit),
      });
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({
        error: "Failed to get events",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get event types
router.get("/types", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { limit = 50 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const eventTypes = await analyticsService.getEventTypes(organizationId, {
      limit: Number(limit),
    });

    res.json({
      eventTypes: eventTypes.map((type: any) => ({
        eventType: type.eventType,
        count: type.count,
        lastSeen: type.lastSeen,
      })),
      total: eventTypes.length,
    });
  } catch (error) {
    console.error("Get event types error:", error);
    res.status(500).json({
      error: "Failed to get event types",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get event names for a specific type
router.get("/names/:eventType", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { limit = 50 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!eventType) {
      res.status(400).json({ error: "Event type is required" });
      return;
    }

    const eventNames = await analyticsService.getEventNames(organizationId, eventType, {
      limit: Number(limit),
    });

    res.json({
      eventType,
      eventNames: eventNames.map((name: any) => ({
        eventName: name.eventName,
        count: name.count,
        lastSeen: name.lastSeen,
      })),
      total: eventNames.length,
    });
  } catch (error) {
    console.error("Get event names error:", error);
    res.status(500).json({
      error: "Failed to get event names",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get event properties
router.get("/properties", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType, eventName } = req.query;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const properties = await analyticsService.getEventProperties(organizationId, {
      eventType: eventType as string,
      eventName: eventName as string,
    });

    res.json({
      properties: properties.map((prop: any) => ({
        propertyName: prop.propertyName,
        propertyType: prop.propertyType,
        sampleValues: prop.sampleValues,
        count: prop.count,
      })),
      total: properties.length,
    });
  } catch (error) {
    console.error("Get event properties error:", error);
    res.status(500).json({
      error: "Failed to get event properties",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get real-time events (last 5 minutes)
router.get("/realtime", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { limit = 100 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const realtimeEvents = await analyticsService.getRealtimeEvents(organizationId, {
      limit: Number(limit),
    });

    res.json({
      events: realtimeEvents,
      total: realtimeEvents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get realtime events error:", error);
    res.status(500).json({
      error: "Failed to get realtime events",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Delete events (admin only)
router.delete("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, eventType, confirm } = req.body;
    const organizationId = (req as any).user?.organizationId;
    const userRole = (req as any).user?.role;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (userRole !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    if (!confirm) {
      res.status(400).json({ error: "Confirmation required for event deletion" });
      return;
    }

    const deletedCount = await analyticsService.deleteEvents(organizationId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      eventType,
    });

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} events`,
    });
  } catch (error) {
    console.error("Delete events error:", error);
    res.status(500).json({
      error: "Failed to delete events",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 