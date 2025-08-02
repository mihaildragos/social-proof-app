import { Router, Request, Response } from "express";
import { AnalyticsService } from "../services/analytics-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const analyticsService = new AnalyticsService();

// Validation schemas
const dashboardQuerySchema = z.object({
  timeRange: z.enum(["1h", "24h", "7d", "30d", "90d"]).default("24h"),
  timezone: z.string().optional(),
  compareWith: z.enum(["previous", "none"]).default("none"),
  metrics: z.array(z.string()).optional(),
});

const customDashboardSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  granularity: z.enum(["minute", "hour", "day", "week", "month"]).default("hour"),
});

// Get main dashboard data
router.get(
  "/",
  authMiddleware,
  validateRequest(dashboardQuerySchema, "query"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { timeRange, timezone, compareWith, metrics } = req.query;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const dashboardData = await analyticsService.getDashboardData(organizationId, {
        timeRange: timeRange as string,
        timezone: timezone as string,
        compareWith: compareWith as string,
        metrics: metrics as string[],
      });

      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get dashboard data error:", error);
      res.status(500).json({
        error: "Failed to get dashboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get custom dashboard data with date range
router.post(
  "/custom",
  authMiddleware,
  validateRequest(customDashboardSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, timezone, metrics, granularity } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const customData = await analyticsService.getCustomDashboardData(organizationId, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timezone,
        metrics,
        granularity,
      });

      res.json({
        success: true,
        data: customData,
        period: {
          startDate,
          endDate,
          granularity,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get custom dashboard data error:", error);
      res.status(500).json({
        error: "Failed to get custom dashboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get real-time metrics
router.get("/realtime", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { interval = "1m" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const realtimeMetrics = await analyticsService.getRealtimeMetrics(organizationId, {
      interval: interval as string,
    });

    res.json({
      success: true,
      metrics: realtimeMetrics,
      timestamp: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 60000).toISOString(), // Next minute
    });
  } catch (error) {
    console.error("Get realtime metrics error:", error);
    res.status(500).json({
      error: "Failed to get realtime metrics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get top events
router.get("/top-events", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h", limit = 10 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const topEvents = await analyticsService.getTopEvents(organizationId, {
      timeRange: timeRange as string,
      limit: Number(limit),
    });

    res.json({
      success: true,
      events: topEvents.map((event: any) => ({
        eventType: event.eventType,
        eventName: event.eventName,
        count: event.count,
        percentage: event.percentage,
        trend: event.trend,
      })),
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get top events error:", error);
    res.status(500).json({
      error: "Failed to get top events",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get user activity
router.get("/user-activity", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h", granularity = "hour" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const userActivity = await analyticsService.getUserActivity(organizationId, {
      timeRange: timeRange as string,
      granularity: granularity as string,
    });

    res.json({
      success: true,
      activity: userActivity,
      timeRange,
      granularity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get user activity error:", error);
    res.status(500).json({
      error: "Failed to get user activity",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get conversion metrics
router.get("/conversions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h", funnelId } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const conversions = await analyticsService.getConversions(organizationId, {
      timeRange: timeRange as string,
      funnelId: funnelId as string,
    });

    res.json({
      success: true,
      conversions: conversions.map((conversion: any) => ({
        step: conversion.step,
        stepName: conversion.stepName,
        users: conversion.users,
        conversionRate: conversion.conversionRate,
        dropoffRate: conversion.dropoffRate,
      })),
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get conversions error:", error);
    res.status(500).json({
      error: "Failed to get conversions",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get traffic sources
router.get("/traffic-sources", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h", limit = 10 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const trafficSources = await analyticsService.getTrafficSources(organizationId, {
      timeRange: timeRange as string,
      limit: Number(limit),
    });

    res.json({
      success: true,
      sources: trafficSources.map((source: any) => ({
        source: source.source,
        medium: source.medium,
        campaign: source.campaign,
        users: source.users,
        sessions: source.sessions,
        bounceRate: source.bounceRate,
        avgSessionDuration: source.avgSessionDuration,
      })),
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get traffic sources error:", error);
    res.status(500).json({
      error: "Failed to get traffic sources",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get device and browser stats
router.get("/devices", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const deviceStats = await analyticsService.getDeviceStats(organizationId, {
      timeRange: timeRange as string,
    });

    res.json({
      success: true,
      devices: deviceStats.devices,
      browsers: deviceStats.browsers,
      operatingSystems: deviceStats.operatingSystems,
      screenResolutions: deviceStats.screenResolutions,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get device stats error:", error);
    res.status(500).json({
      error: "Failed to get device stats",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get geographic data
router.get("/geography", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h", level = "country" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const geoData = await analyticsService.getGeographicData(organizationId, {
      timeRange: timeRange as string,
      level: level as string,
    });

    res.json({
      success: true,
      geography: geoData.map((geo: any) => ({
        location: geo.location,
        users: geo.users,
        sessions: geo.sessions,
        bounceRate: geo.bounceRate,
        avgSessionDuration: geo.avgSessionDuration,
        coordinates: geo.coordinates,
      })),
      level,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get geographic data error:", error);
    res.status(500).json({
      error: "Failed to get geographic data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get performance metrics
router.get("/performance", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { timeRange = "24h" } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const performance = await analyticsService.getPerformanceMetrics(organizationId, {
      timeRange: timeRange as string,
    });

    res.json({
      success: true,
      performance: {
        pageLoadTime: performance.pageLoadTime,
        serverResponseTime: performance.serverResponseTime,
        domContentLoaded: performance.domContentLoaded,
        firstContentfulPaint: performance.firstContentfulPaint,
        largestContentfulPaint: performance.largestContentfulPaint,
        cumulativeLayoutShift: performance.cumulativeLayoutShift,
        firstInputDelay: performance.firstInputDelay,
      },
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get performance metrics error:", error);
    res.status(500).json({
      error: "Failed to get performance metrics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 