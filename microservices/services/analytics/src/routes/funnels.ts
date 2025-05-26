import { Router, Request, Response } from "express";
import { AnalyticsService } from "../services/analytics-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const analyticsService = new AnalyticsService();

// Validation schemas
const createFunnelSchema = z.object({
  name: z.string().min(1, "Funnel name is required"),
  description: z.string().optional(),
  steps: z
    .array(
      z.object({
        name: z.string().min(1, "Step name is required"),
        eventType: z.string().min(1, "Event type is required"),
        eventName: z.string().min(1, "Event name is required"),
        filters: z.record(z.any()).optional(),
        order: z.number().min(0),
      })
    )
    .min(2, "At least 2 steps are required"),
  conversionWindow: z.number().min(1).max(30).default(7), // days
  isActive: z.boolean().default(true),
});

const updateFunnelSchema = createFunnelSchema.partial().omit({ steps: true }).extend({
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, "Step name is required"),
        eventType: z.string().min(1, "Event type is required"),
        eventName: z.string().min(1, "Event name is required"),
        filters: z.record(z.any()).optional(),
        order: z.number().min(0),
      })
    )
    .min(2, "At least 2 steps are required")
    .optional(),
});

const funnelAnalysisSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timeRange: z.enum(["1h", "24h", "7d", "30d", "90d"]).optional(),
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  segmentBy: z.array(z.string()).optional(),
  compareWith: z.enum(["previous", "none"]).default("none"),
});

// Create funnel
router.post(
  "/",
  authMiddleware,
  validateRequest(createFunnelSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, steps, conversionWindow, isActive } = req.body;
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const funnel = await analyticsService.createFunnel({
        organizationId,
        name,
        description,
        steps,
        conversionWindow,
        isActive,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        funnel: {
          id: funnel.id,
          name: funnel.name,
          description: funnel.description,
          steps: funnel.steps,
          conversionWindow: funnel.conversionWindow,
          isActive: funnel.isActive,
          createdAt: funnel.createdAt,
        },
      });
    } catch (error) {
      console.error("Create funnel error:", error);
      res.status(500).json({
        error: "Failed to create funnel",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get all funnels
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { limit = 50, offset = 0, isActive } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const funnels = await analyticsService.getFunnels(organizationId, {
      limit: Number(limit),
      offset: Number(offset),
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    res.json({
      funnels: funnels.map((funnel: any) => ({
        id: funnel.id,
        name: funnel.name,
        description: funnel.description,
        stepsCount: funnel.steps.length,
        conversionWindow: funnel.conversionWindow,
        isActive: funnel.isActive,
        createdAt: funnel.createdAt,
        updatedAt: funnel.updatedAt,
      })),
      total: funnels.length,
    });
  } catch (error) {
    console.error("Get funnels error:", error);
    res.status(500).json({
      error: "Failed to get funnels",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get funnel by ID
router.get("/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const funnel = await analyticsService.getFunnelById(organizationId, id);

    if (!funnel) {
      res.status(404).json({ error: "Funnel not found" });
      return;
    }

    res.json({
      funnel: {
        id: funnel.id,
        name: funnel.name,
        description: funnel.description,
        steps: funnel.steps,
        conversionWindow: funnel.conversionWindow,
        isActive: funnel.isActive,
        createdAt: funnel.createdAt,
        updatedAt: funnel.updatedAt,
        createdBy: funnel.createdBy,
      },
    });
  } catch (error) {
    console.error("Get funnel by ID error:", error);
    res.status(500).json({
      error: "Failed to get funnel",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update funnel
router.put(
  "/:id",
  authMiddleware,
  validateRequest(updateFunnelSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const updatedFunnel = await analyticsService.updateFunnel(organizationId, id, {
        ...req.body,
        updatedBy: userId,
      });

      if (!updatedFunnel) {
        res.status(404).json({ error: "Funnel not found" });
        return;
      }

      res.json({
        success: true,
        funnel: {
          id: updatedFunnel.id,
          name: updatedFunnel.name,
          description: updatedFunnel.description,
          steps: updatedFunnel.steps,
          conversionWindow: updatedFunnel.conversionWindow,
          isActive: updatedFunnel.isActive,
          updatedAt: updatedFunnel.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update funnel error:", error);
      res.status(500).json({
        error: "Failed to update funnel",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Delete funnel
router.delete("/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const deleted = await analyticsService.deleteFunnel(organizationId, id);

    if (!deleted) {
      res.status(404).json({ error: "Funnel not found" });
      return;
    }

    res.json({
      success: true,
      message: "Funnel deleted successfully",
    });
  } catch (error) {
    console.error("Delete funnel error:", error);
    res.status(500).json({
      error: "Failed to delete funnel",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get funnel analysis
router.post(
  "/:id/analysis",
  authMiddleware,
  validateRequest(funnelAnalysisSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { startDate, endDate, timeRange, granularity, segmentBy, compareWith } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const analysis = await analyticsService.getFunnelAnalysis(organizationId, id, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        timeRange,
        granularity,
        segmentBy,
        compareWith,
      });

      res.json({
        success: true,
        analysis: {
          funnelId: id,
          overview: analysis.overview,
          steps: analysis.steps,
          conversions: analysis.conversions,
          dropoffs: analysis.dropoffs,
          segments: analysis.segments,
          trends: analysis.trends,
          comparison: analysis.comparison,
        },
        period: {
          startDate: analysis.period.startDate,
          endDate: analysis.period.endDate,
          granularity,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get funnel analysis error:", error);
      res.status(500).json({
        error: "Failed to get funnel analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get funnel conversion rates over time
router.get("/:id/trends", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "30d", granularity = "day" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const trends = await analyticsService.getFunnelTrends(organizationId, id, {
      timeRange: timeRange as string,
      granularity: granularity as string,
    });

    res.json({
      success: true,
      funnelId: id,
      trends: trends.map((trend: any) => ({
        date: trend.date,
        totalUsers: trend.totalUsers,
        conversions: trend.conversions,
        conversionRate: trend.conversionRate,
        stepConversions: trend.stepConversions,
      })),
      timeRange,
      granularity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get funnel trends error:", error);
    res.status(500).json({
      error: "Failed to get funnel trends",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get funnel segments
router.get("/:id/segments", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { segmentBy, timeRange = "30d" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!segmentBy) {
      res.status(400).json({ error: "segmentBy parameter is required" });
      return;
    }

    const segments = await analyticsService.getFunnelSegments(organizationId, id, {
      segmentBy: segmentBy as string,
      timeRange: timeRange as string,
    });

    res.json({
      success: true,
      funnelId: id,
      segmentBy,
      segments: segments.map((segment: any) => ({
        segmentValue: segment.segmentValue,
        totalUsers: segment.totalUsers,
        conversions: segment.conversions,
        conversionRate: segment.conversionRate,
        stepConversions: segment.stepConversions,
      })),
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get funnel segments error:", error);
    res.status(500).json({
      error: "Failed to get funnel segments",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get funnel user paths
router.get("/:id/paths", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "7d", limit = 100 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const paths = await analyticsService.getFunnelUserPaths(organizationId, id, {
      timeRange: timeRange as string,
      limit: Number(limit),
    });

    res.json({
      success: true,
      funnelId: id,
      paths: paths.map((path: any) => ({
        userId: path.userId,
        sessionId: path.sessionId,
        steps: path.steps,
        completed: path.completed,
        conversionTime: path.conversionTime,
        dropoffStep: path.dropoffStep,
        events: path.events,
      })),
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get funnel user paths error:", error);
    res.status(500).json({
      error: "Failed to get funnel user paths",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Clone funnel
router.post("/:id/clone", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const organizationId = (req as any).user?.organizationId;
    const userId = (req as any).user?.id;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "Name is required for cloned funnel" });
      return;
    }

    const clonedFunnel = await analyticsService.cloneFunnel(organizationId, id, {
      name,
      clonedBy: userId,
    });

    if (!clonedFunnel) {
      res.status(404).json({ error: "Original funnel not found" });
      return;
    }

    res.status(201).json({
      success: true,
      funnel: {
        id: clonedFunnel.id,
        name: clonedFunnel.name,
        description: clonedFunnel.description,
        steps: clonedFunnel.steps,
        conversionWindow: clonedFunnel.conversionWindow,
        isActive: clonedFunnel.isActive,
        createdAt: clonedFunnel.createdAt,
      },
      message: "Funnel cloned successfully",
    });
  } catch (error) {
    console.error("Clone funnel error:", error);
    res.status(500).json({
      error: "Failed to clone funnel",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 