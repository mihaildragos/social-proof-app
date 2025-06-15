import { Router, Request, Response } from "express";
import { PlanRepository } from "../repositories/PlanRepository";
import { BillingService } from "../services/billing-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const planRepository = new PlanRepository();
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
router.get("/", validateRequest(getPlanSchema, "query"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { active, limit, offset } = req.query;

    const plans = await planRepository.getPublicPlans();

    res.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        isPublic: plan.isPublic,
        sortOrder: plan.sortOrder,
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
router.get("/:planId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }

    const plan = await planRepository.getById(planId);

    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        isPublic: plan.isPublic,
        sortOrder: plan.sortOrder,
        stripeProductId: plan.stripeProductId,
        stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
        stripeYearlyPriceId: plan.stripeYearlyPriceId,
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
  async (req: Request, res: Response): Promise<void> => {
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
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check if user has admin role
      if (userRole !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
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
          displayName: plan.displayName,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          currency: plan.currency,
          isPublic: plan.isPublic,
          sortOrder: plan.sortOrder,
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }
      const { name, description, trialPeriodDays, features, metadata, active } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check if user has admin role
      if (userRole !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
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
          displayName: plan.displayName,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          currency: plan.currency,
          isPublic: plan.isPublic,
          sortOrder: plan.sortOrder,
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
router.delete("/:planId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
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
router.post("/:planId/archive", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const plan = await billingService.archivePlan(planId, userId);

    res.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        isPublic: plan.isPublic,
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
router.get("/:planId/features", async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }

    const features = await planRepository.getPlanFeatures(planId);

    res.json({
      features: features.map((feature) => ({
        id: feature.id,
        planId: feature.planId,
        name: feature.name,
        description: feature.description,
        featureType: feature.featureType,
        value: feature.value,
        isHighlighted: feature.isHighlighted,
        createdAt: feature.createdAt,
        updatedAt: feature.updatedAt,
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
router.post("/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const { planIds } = req.body;

    if (!Array.isArray(planIds) || planIds.length < 2) {
      res.status(400).json({ error: "At least 2 plan IDs are required for comparison" });
      return;
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
router.get("/:planId/pricing", async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }

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
router.get("/:planId/limits", async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }

    const limits = await planRepository.getPlanLimits(planId);

    res.json({
      limits: limits.map((limit) => ({
        id: limit.id,
        planId: limit.planId,
        resourceType: limit.resourceType,
        maxValue: limit.maxValue,
        overagePrice: limit.overagePrice,
        createdAt: limit.createdAt,
        updatedAt: limit.updatedAt,
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
router.get("/:planId/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Check if user has admin role
    if (userRole !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
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
router.get("/recommend", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { usage, features } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
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
