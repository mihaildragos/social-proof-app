import { Router, Request, Response } from "express";
import { UsageService } from "../services/usage-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const usageService = new UsageService();

// Validation schemas
const recordUsageSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  quantity: z.number().positive("Quantity must be positive").default(1),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.string()).optional(),
  properties: z.record(z.any()).optional(),
});

const batchUsageSchema = z.object({
  events: z
    .array(recordUsageSchema)
    .min(1, "At least one event is required")
    .max(100, "Maximum 100 events per batch"),
});

const getUsageSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventType: z.string().optional(),
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
});

// Record usage event
router.post(
  "/",
  authMiddleware,
  validateRequest(recordUsageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventType, quantity, timestamp, metadata, properties } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const usageEvent = await usageService.recordUsage({
        userId,
        eventType,
        quantity,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata,
        properties,
      });

      res.status(201).json({
        success: true,
        event: {
          id: usageEvent.id,
          eventType: usageEvent.eventType,
          quantity: usageEvent.quantity,
          timestamp: usageEvent.timestamp,
          createdAt: usageEvent.createdAt,
        },
      });
    } catch (error) {
      console.error("Record usage error:", error);
      res.status(500).json({
        error: "Failed to record usage",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Record batch usage events
router.post(
  "/batch",
  authMiddleware,
  validateRequest(batchUsageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { events } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const usageEvents = await usageService.recordBatchUsage(
        userId,
        events.map((event: any) => ({
          eventType: event.eventType,
          quantity: event.quantity,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
          metadata: event.metadata,
          properties: event.properties,
        }))
      );

      res.status(201).json({
        success: true,
        events: usageEvents.map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          quantity: event.quantity,
          timestamp: event.timestamp,
        })),
        total: usageEvents.length,
      });
    } catch (error) {
      console.error("Record batch usage error:", error);
      res.status(500).json({
        error: "Failed to record batch usage",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get usage data
router.get(
  "/",
  authMiddleware,
  validateRequest(getUsageSchema, "query"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, eventType, granularity } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const usageOptions: {
        startDate?: Date;
        endDate?: Date;
        eventType?: string;
        granularity?: "hour" | "day" | "week" | "month";
      } = {
        granularity: granularity as "hour" | "day" | "week" | "month",
      };

      if (startDate) usageOptions.startDate = new Date(startDate as string);
      if (endDate) usageOptions.endDate = new Date(endDate as string);
      if (eventType) usageOptions.eventType = eventType as string;

      const usage = await usageService.getUsage(userId, usageOptions);

      res.json(usage);
    } catch (error) {
      console.error("Get usage error:", error);
      res.status(500).json({
        error: "Failed to get usage data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get current period usage summary
router.get("/current", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const currentUsage = await usageService.getCurrentPeriodUsage(userId);

    res.json({
      period: currentUsage.period,
      usage: currentUsage.usage,
      limits: currentUsage.limits,
      percentageUsed: currentUsage.percentageUsed,
      resetDate: currentUsage.resetDate,
    });
  } catch (error) {
    console.error("Get current usage error:", error);
    res.status(500).json({
      error: "Failed to get current usage",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get usage by event type
router.get("/by-event", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { startDate, endDate, limit = 10 } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const eventOptions: { startDate?: Date; endDate?: Date; limit?: number } = {
      limit: Number(limit),
    };

    if (startDate) eventOptions.startDate = new Date(startDate as string);
    if (endDate) eventOptions.endDate = new Date(endDate as string);

    const usageByEvent = await usageService.getUsageByEventType(userId, eventOptions);

    res.json({
      eventTypes: usageByEvent,
      total: usageByEvent.length,
    });
  } catch (error) {
    console.error("Get usage by event error:", error);
    res.status(500).json({
      error: "Failed to get usage by event type",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get usage quotas
router.get("/quotas", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const quotas = await usageService.getUserQuotas(userId);

    res.json({
      quotas: quotas.map((quota: any) => ({
        eventType: quota.eventType,
        limit: quota.limit,
        period: quota.period,
        currentUsage: quota.currentUsage,
        remainingUsage: quota.remainingUsage,
        resetDate: quota.resetDate,
        isExceeded: quota.isExceeded,
      })),
      total: quotas.length,
    });
  } catch (error) {
    console.error("Get usage quotas error:", error);
    res.status(500).json({
      error: "Failed to get usage quotas",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Check if usage limit is exceeded
router.get(
  "/check/:eventType",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventType } = req.params;
      const { quantity = 1 } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!eventType) {
        res.status(400).json({ error: "Event type is required" });
        return;
      }

      const check = await usageService.checkUsageLimit(userId, eventType, Number(quantity));

      res.json({
        allowed: check.allowed,
        currentUsage: check.currentUsage,
        limit: check.limit,
        remainingUsage: check.remainingUsage,
        resetDate: check.resetDate,
        message: check.message,
      });
    } catch (error) {
      console.error("Check usage limit error:", error);
      res.status(500).json({
        error: "Failed to check usage limit",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get usage analytics
router.get("/analytics", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { period = "month", eventType } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const analytics = await usageService.getUsageAnalytics(userId, {
      period: period as string,
      eventType: eventType as string,
    });

    res.json(analytics);
  } catch (error) {
    console.error("Get usage analytics error:", error);
    res.status(500).json({
      error: "Failed to get usage analytics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Export usage data
router.get("/export", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { startDate, endDate, format = "csv" } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const exportData = await usageService.exportUsageData(userId, {
      startDate: startDate ? new Date(startDate as string) : new Date(),
      endDate: endDate ? new Date(endDate as string) : new Date(),
      format: format as string,
    });

    // Set appropriate headers for file download
    const filename = `usage-export-${new Date().toISOString().split("T")[0]}.${format}`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/json");

    res.send(exportData);
  } catch (error) {
    console.error("Export usage data error:", error);
    res.status(500).json({
      error: "Failed to export usage data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Reset usage for testing (development only)
if (process.env.NODE_ENV === "development") {
  router.post("/reset", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { eventType } = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      await usageService.resetUsage(userId, eventType);

      res.json({
        success: true,
        message: eventType ? `Usage reset for ${eventType}` : "All usage reset",
      });
    } catch (error) {
      console.error("Reset usage error:", error);
      res.status(500).json({
        error: "Failed to reset usage",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

export default router;
