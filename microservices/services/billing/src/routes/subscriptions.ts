import { Router, Request, Response } from "express";
import { BillingService } from "../services/billing-service";
import { SubscriptionRepository } from "../repositories/SubscriptionRepository";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const billingService = new BillingService();
const subscriptionRepository = new SubscriptionRepository();

// Validation schemas
const createSubscriptionSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().min(0).optional(),
  couponCode: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  prorationBehavior: z.enum(["create_prorations", "none", "always_invoice"]).optional(),
});

const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  cancellationReason: z.string().optional(),
  feedback: z.string().optional(),
});

// Create subscription
router.post(
  "/",
  authMiddleware,
  validateRequest(createSubscriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { planId, paymentMethodId, trialDays, couponCode, metadata } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check if user already has an active subscription
      const existingSubscription = await subscriptionRepository.getByOrganizationId(userId);
      if (existingSubscription && existingSubscription.status === 'active') {
        res.status(400).json({
          error: "User already has an active subscription",
          subscriptionId: existingSubscription.id,
        });
        return;
      }

      const subscription = await billingService.createSubscription({
        userId,
        planId,
        paymentMethodId,
        trialDays,
        couponCode,
        metadata,
      });

      res.status(201).json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEndsAt: subscription.trialEndsAt,
          cancelsAtPeriodEnd: subscription.cancelsAtPeriodEnd,
          createdAt: subscription.createdAt,
        },
      });
    } catch (error) {
      console.error("Create subscription error:", error);
      res.status(500).json({
        error: "Failed to create subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get user's subscriptions
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { status, limit = 20, offset = 0 } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const subscriptions = await billingService.getUserSubscriptions(userId, {
      status: status as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      subscriptions: subscriptions.map((sub: any) => ({
        id: sub.id,
        status: sub.status,
        planId: sub.planId,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
        cancelsAtPeriodEnd: sub.cancelsAtPeriodEnd,
        canceledAt: sub.canceledAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({
      error: "Failed to get subscriptions",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get specific subscription
router.get(
  "/:subscriptionId",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const subscription = await billingService.getSubscription(subscriptionId, userId);

      if (!subscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      res.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEndsAt: subscription.trialEndsAt,
          cancelsAtPeriodEnd: subscription.cancelsAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({
        error: "Failed to get subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Update subscription
router.put(
  "/:subscriptionId",
  authMiddleware,
  validateRequest(updateSubscriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { planId, paymentMethodId, metadata, prorationBehavior } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const subscription = await billingService.updateSubscription(subscriptionId, userId, {
        planId,
        paymentMethodId,
        metadata,
        prorationBehavior,
      });

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          updatedAt: subscription.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update subscription error:", error);
      res.status(500).json({
        error: "Failed to update subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Cancel subscription
router.post(
  "/:subscriptionId/cancel",
  authMiddleware,
  validateRequest(cancelSubscriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { cancelAtPeriodEnd, cancellationReason, feedback } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const subscription = await billingService.cancelSubscription(subscriptionId, userId, {
        cancelAtPeriodEnd,
        cancellationReason,
        feedback,
      });

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelsAtPeriodEnd: subscription.cancelsAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        message:
          cancelAtPeriodEnd ?
            "Subscription will be canceled at the end of the current period"
          : "Subscription has been canceled immediately",
      });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({
        error: "Failed to cancel subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Reactivate subscription
router.post(
  "/:subscriptionId/reactivate",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const subscription = await billingService.reactivateSubscription(subscriptionId, userId);

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelsAtPeriodEnd: subscription.cancelsAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        message: "Subscription has been reactivated",
      });
    } catch (error) {
      console.error("Reactivate subscription error:", error);
      res.status(500).json({
        error: "Failed to reactivate subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get subscription usage
router.get(
  "/:subscriptionId/usage",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const userId = (req as any).user?.id;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const usageOptions: { startDate?: Date; endDate?: Date } = {};
      if (startDate) usageOptions.startDate = new Date(startDate as string);
      if (endDate) usageOptions.endDate = new Date(endDate as string);

      const usage = await billingService.getSubscriptionUsage(subscriptionId, userId, usageOptions);

      res.json(usage);
    } catch (error) {
      console.error("Get subscription usage error:", error);
      res.status(500).json({
        error: "Failed to get subscription usage",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Preview subscription changes
router.post(
  "/:subscriptionId/preview",
  authMiddleware,
  validateRequest(updateSubscriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { planId, prorationBehavior } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: "Subscription ID is required" });
        return;
      }

      const preview = await billingService.previewSubscriptionChange(subscriptionId, userId, {
        planId,
        prorationBehavior,
      });

      res.json(preview);
    } catch (error) {
      console.error("Preview subscription change error:", error);
      res.status(500).json({
        error: "Failed to preview subscription change",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
