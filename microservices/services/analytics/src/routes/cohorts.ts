import { Router, Request, Response } from "express";
import { AnalyticsService } from "../services/analytics-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const analyticsService = new AnalyticsService();

// Validation schemas
const cohortAnalysisSchema = z.object({
  cohortType: z.enum(["acquisition", "behavioral", "revenue"]).default("acquisition"),
  cohortPeriod: z.enum(["day", "week", "month"]).default("week"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timeRange: z.enum(["30d", "90d", "180d", "365d"]).optional(),
  retentionPeriods: z.number().min(1).max(52).default(12),
  segmentBy: z.array(z.string()).optional(),
  eventType: z.string().optional(),
  eventName: z.string().optional(),
});

const behavioralCohortSchema = z.object({
  triggerEvent: z.object({
    eventType: z.string().min(1, "Event type is required"),
    eventName: z.string().min(1, "Event name is required"),
    filters: z.record(z.any()).optional(),
  }),
  returnEvent: z.object({
    eventType: z.string().min(1, "Event type is required"),
    eventName: z.string().min(1, "Event name is required"),
    filters: z.record(z.any()).optional(),
  }),
  cohortPeriod: z.enum(["day", "week", "month"]).default("week"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  retentionPeriods: z.number().min(1).max(52).default(12),
});

const revenueCohortSchema = z.object({
  cohortPeriod: z.enum(["day", "week", "month"]).default("month"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  retentionPeriods: z.number().min(1).max(52).default(12),
  revenueMetric: z.enum(["total", "average", "cumulative"]).default("total"),
  currency: z.string().default("USD"),
});

// Get acquisition cohort analysis
router.get(
  "/acquisition",
  authMiddleware,
  validateRequest(cohortAnalysisSchema, "query"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        cohortPeriod,
        startDate,
        endDate,
        timeRange,
        retentionPeriods,
        segmentBy,
        eventType,
        eventName,
      } = req.query;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const cohortAnalysis = await analyticsService.getAcquisitionCohorts(organizationId, {
        cohortPeriod: cohortPeriod as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        timeRange: timeRange as string,
        retentionPeriods: Number(retentionPeriods),
        segmentBy: segmentBy as string[],
        eventType: eventType as string,
        eventName: eventName as string,
      });

      res.json({
        success: true,
        cohortType: "acquisition",
        analysis: {
          cohorts: cohortAnalysis.cohorts,
          summary: cohortAnalysis.summary,
          retentionRates: cohortAnalysis.retentionRates,
          segments: cohortAnalysis.segments,
        },
        parameters: {
          cohortPeriod,
          retentionPeriods: Number(retentionPeriods),
          period: cohortAnalysis.period,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get acquisition cohorts error:", error);
      res.status(500).json({
        error: "Failed to get acquisition cohorts",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get behavioral cohort analysis
router.post(
  "/behavioral",
  authMiddleware,
  validateRequest(behavioralCohortSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        triggerEvent,
        returnEvent,
        cohortPeriod,
        startDate,
        endDate,
        retentionPeriods,
      } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const cohortAnalysis = await analyticsService.getBehavioralCohorts(organizationId, {
        triggerEvent,
        returnEvent,
        cohortPeriod,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        retentionPeriods,
      });

      res.json({
        success: true,
        cohortType: "behavioral",
        analysis: {
          cohorts: cohortAnalysis.cohorts,
          summary: cohortAnalysis.summary,
          retentionRates: cohortAnalysis.retentionRates,
          conversionRates: cohortAnalysis.conversionRates,
        },
        parameters: {
          triggerEvent,
          returnEvent,
          cohortPeriod,
          retentionPeriods,
          period: cohortAnalysis.period,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get behavioral cohorts error:", error);
      res.status(500).json({
        error: "Failed to get behavioral cohorts",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get revenue cohort analysis
router.post(
  "/revenue",
  authMiddleware,
  validateRequest(revenueCohortSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        cohortPeriod,
        startDate,
        endDate,
        retentionPeriods,
        revenueMetric,
        currency,
      } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const cohortAnalysis = await analyticsService.getRevenueCohorts(organizationId, {
        cohortPeriod,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        retentionPeriods,
        revenueMetric,
        currency,
      });

      res.json({
        success: true,
        cohortType: "revenue",
        analysis: {
          cohorts: cohortAnalysis.cohorts,
          summary: cohortAnalysis.summary,
          revenueMetrics: cohortAnalysis.revenueMetrics,
          ltv: cohortAnalysis.ltv,
        },
        parameters: {
          cohortPeriod,
          retentionPeriods,
          revenueMetric,
          currency,
          period: cohortAnalysis.period,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get revenue cohorts error:", error);
      res.status(500).json({
        error: "Failed to get revenue cohorts",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get cohort retention curves
router.get("/retention-curves", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { cohortPeriod = "week", timeRange = "90d", compareWith } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const retentionCurves = await analyticsService.getRetentionCurves(organizationId, {
      cohortPeriod: cohortPeriod as string,
      timeRange: timeRange as string,
      compareWith: compareWith as string,
    });

    res.json({
      success: true,
      curves: retentionCurves.map((curve: any) => ({
        cohortDate: curve.cohortDate,
        cohortSize: curve.cohortSize,
        retentionData: curve.retentionData,
        averageRetention: curve.averageRetention,
      })),
      averageCurve: retentionCurves.averageCurve,
      comparison: retentionCurves.comparison,
      parameters: {
        cohortPeriod,
        timeRange,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get retention curves error:", error);
    res.status(500).json({
      error: "Failed to get retention curves",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get cohort size trends
router.get("/size-trends", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { cohortPeriod = "week", timeRange = "90d" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const sizeTrends = await analyticsService.getCohortSizeTrends(organizationId, {
      cohortPeriod: cohortPeriod as string,
      timeRange: timeRange as string,
    });

    res.json({
      success: true,
      trends: sizeTrends.map((trend: any) => ({
        cohortDate: trend.cohortDate,
        cohortSize: trend.cohortSize,
        growthRate: trend.growthRate,
        cumulativeSize: trend.cumulativeSize,
      })),
      summary: {
        totalCohorts: sizeTrends.length,
        averageCohortSize: sizeTrends.averageCohortSize,
        totalUsers: sizeTrends.totalUsers,
        growthTrend: sizeTrends.growthTrend,
      },
      parameters: {
        cohortPeriod,
        timeRange,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get cohort size trends error:", error);
    res.status(500).json({
      error: "Failed to get cohort size trends",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get cohort comparison
router.post("/compare", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { cohortIds, metric = "retention" } = req.body;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!cohortIds || !Array.isArray(cohortIds) || cohortIds.length < 2) {
      res.status(400).json({ error: "At least 2 cohort IDs are required for comparison" });
      return;
    }

    const comparison = await analyticsService.compareCohorts(organizationId, {
      cohortIds,
      metric,
    });

    res.json({
      success: true,
      comparison: {
        cohorts: comparison.cohorts,
        metrics: comparison.metrics,
        differences: comparison.differences,
        significance: comparison.significance,
      },
      parameters: {
        cohortIds,
        metric,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Compare cohorts error:", error);
    res.status(500).json({
      error: "Failed to compare cohorts",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get cohort segments
router.get("/segments", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { segmentBy, cohortPeriod = "week", timeRange = "90d" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!segmentBy) {
      res.status(400).json({ error: "segmentBy parameter is required" });
      return;
    }

    const segments = await analyticsService.getCohortSegments(organizationId, {
      segmentBy: segmentBy as string,
      cohortPeriod: cohortPeriod as string,
      timeRange: timeRange as string,
    });

    res.json({
      success: true,
      segmentBy,
      segments: segments.map((segment: any) => ({
        segmentValue: segment.segmentValue,
        cohorts: segment.cohorts,
        averageRetention: segment.averageRetention,
        totalUsers: segment.totalUsers,
        retentionCurve: segment.retentionCurve,
      })),
      parameters: {
        segmentBy,
        cohortPeriod,
        timeRange,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get cohort segments error:", error);
    res.status(500).json({
      error: "Failed to get cohort segments",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get cohort user lists
router.get("/:cohortId/users", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { cohortId } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { period, limit = 100, offset = 0 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const users = await analyticsService.getCohortUsers(organizationId, cohortId, {
      period: period ? Number(period) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      cohortId,
      users: users.map((user: any) => ({
        userId: user.userId,
        firstSeen: user.firstSeen,
        lastSeen: user.lastSeen,
        retentionPeriods: user.retentionPeriods,
        isRetained: user.isRetained,
        events: user.events,
      })),
      total: users.length,
      parameters: {
        period,
        limit: Number(limit),
        offset: Number(offset),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get cohort users error:", error);
    res.status(500).json({
      error: "Failed to get cohort users",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Export cohort data
router.post("/export", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { cohortType, format = "csv", ...analysisParams } = req.body;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!cohortType) {
      res.status(400).json({ error: "cohortType is required" });
      return;
    }

    const exportData = await analyticsService.exportCohortData(organizationId, {
      cohortType,
      format,
      ...analysisParams,
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="cohort-analysis-${Date.now()}.csv"`);
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData,
        format,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Export cohort data error:", error);
    res.status(500).json({
      error: "Failed to export cohort data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 