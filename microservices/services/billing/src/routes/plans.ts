import { Router, Request, Response } from "express";
import { BillingService } from "../services/billing-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const billingService = new BillingService();

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  interval: z.enum(["day", "week", "month", "year"]),
  intervalCount: z.number().positive("Interval count must be positive").default(1),
  trialPeriodDays: z.number().min(0).optional(),
  features: z
    .array(
      z.object({
        name: z.string().min(1, "Feature name is required"),
        description: z.string().optional(),
        type: z.enum(["boolean", "limit", "usage"]),
        value: z.union([z.boolean(), z.number(), z.string()]),
        metadata: z.record(z.string()).optional(),
      })
    )
    .optional(),
  metadata: z.record(z.string()).optional(),
  active: z.boolean().default(true),
});

const updatePlanSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  trialPeriodDays: z.number().min(0).optional(),
  features: z
    .array(
      z.object({
        name: z.string().min(1, "Feature name is required"),
        description: z.string().optional(),
        type: z.enum(["boolean", "limit", "usage"]),
        value: z.union([z.boolean(), z.number(), z.string()]),
        metadata: z.record(z.string()).optional(),
      })
    )
    .optional(),
  metadata: z.record(z.string()).optional(),
  active: z.boolean().optional(),
});

const getPlanSchema = z.object({
  active: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("20"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
});

// Get all plans (public endpoint for plan selection)
router.get("/", validateRequest(getPlanSchema, "query"), async (req: Request, res: Response) => {
  try {
    const { active, limit, offset } = req.query;

    const plans = await billingService.getPlans({
      active: active as boolean,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
              plans: plans.map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        trialPeriodDays: plan.trialPeriodDays,
        features: plan.features,
        active: plan.active,
        createdAt: plan.createdAt,
      })),
      total: plans.length,
    });
  } catch (error) {
    console.error("Get plans error:", error);
    res.status(500).json({
      error: "Failed to get plans",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get specific plan
router.get("/:planId", async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const plan = await billingService.getPlan(planId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        trialPeriodDays: plan.trialPeriodDays,
        features: plan.features,
        metadata: plan.metadata,
        active: plan.active,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get plan error:", error);
    res.status(500).json({
      error: "Failed to get plan",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create plan (admin only)
router.post(
  "/",
  authMiddleware,
  validateRequest(createPlanSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        amount,
        currency,
        interval,
        intervalCount,
        trialPeriodDays,
        features,
        metadata,
        active,
      } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user has admin role
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const plan = await billingService.createPlan({
        name,
        description,
        amount,
        currency,
        interval,
        intervalCount,
        trialPeriodDays,
        features,
        metadata,
        active,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        plan: {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          amount: plan.amount,
          currency: plan.currency,
          interval: plan.interval,
          intervalCount: plan.intervalCount,
          trialPeriodDays: plan.trialPeriodDays,
          features: plan.features,
          active: plan.active,
          createdAt: plan.createdAt,
        },
      });
    } catch (error) {
      console.error("Create plan error:", error);
      res.status(500).json({
        error: "Failed to create plan",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Update plan (admin only)
router.put(
  "/:planId",
  authMiddleware,
  validateRequest(updatePlanSchema),
  async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const { name, description, trialPeriodDays, features, metadata, active } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user has admin role
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const plan = await billingService.updatePlan(planId, {
        name,
        description,
        trialPeriodDays,
        features,
        metadata,
        active,
        updatedBy: userId,
      });

      res.json({
        success: true,
        plan: {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          trialPeriodDays: plan.trialPeriodDays,
          features: plan.features,
          metadata: plan.metadata,
          active: plan.active,
          updatedAt: plan.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update plan error:", error);
      res.status(500).json({
        error: "Failed to update plan",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Delete plan (admin only)
router.delete("/:planId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    await billingService.deletePlan(planId, userId);

    res.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete plan error:", error);
    res.status(500).json({
      error: "Failed to delete plan",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Archive plan (admin only)
router.post("/:planId/archive", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const plan = await billingService.archivePlan(planId, userId);

    res.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        active: plan.active,
      },
      message: "Plan archived successfully",
    });
  } catch (error) {
    console.error("Archive plan error:", error);
    res.status(500).json({
      error: "Failed to archive plan",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get plan features
router.get("/:planId/features", async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const features = await billingService.getPlanFeatures(planId);

    res.json({
      features: features.map((feature) => ({
        name: feature.name,
        description: feature.description,
        type: feature.type,
        value: feature.value,
        metadata: feature.metadata,
      })),
      total: features.length,
    });
  } catch (error) {
    console.error("Get plan features error:", error);
    res.status(500).json({
      error: "Failed to get plan features",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Compare plans
router.post("/compare", async (req: Request, res: Response) => {
  try {
    const { planIds } = req.body;

    if (!Array.isArray(planIds) || planIds.length < 2) {
      return res.status(400).json({ error: "At least 2 plan IDs are required for comparison" });
    }

    const comparison = await billingService.comparePlans(planIds);

    res.json(comparison);
  } catch (error) {
    console.error("Compare plans error:", error);
    res.status(500).json({
      error: "Failed to compare plans",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get plan pricing tiers
router.get("/:planId/pricing", async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const pricing = await billingService.getPlanPricing(planId);

    res.json(pricing);
  } catch (error) {
    console.error("Get plan pricing error:", error);
    res.status(500).json({
      error: "Failed to get plan pricing",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get plan usage limits
router.get("/:planId/limits", async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const limits = await billingService.getPlanLimits(planId);

    res.json({
      limits: limits.map((limit) => ({
        feature: limit.feature,
        limit: limit.limit,
        period: limit.period,
        overage: limit.overage,
      })),
      total: limits.length,
    });
  } catch (error) {
    console.error("Get plan limits error:", error);
    res.status(500).json({
      error: "Failed to get plan limits",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get plan statistics (admin only)
router.get("/:planId/stats", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const stats = await billingService.getPlanStats(planId);

    res.json(stats);
  } catch (error) {
    console.error("Get plan stats error:", error);
    res.status(500).json({
      error: "Failed to get plan statistics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get recommended plan for user
router.get("/recommend", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { usage, features } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const recommendation = await billingService.getRecommendedPlan(userId, {
      usage: usage ? JSON.parse(usage as string) : undefined,
      features: features ? JSON.parse(features as string) : undefined,
    });

    res.json(recommendation);
  } catch (error) {
    console.error("Get recommended plan error:", error);
    res.status(500).json({
      error: "Failed to get recommended plan",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
