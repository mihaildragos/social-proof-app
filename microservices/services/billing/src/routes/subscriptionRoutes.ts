import { Router } from "express";
import { SubscriptionRepository } from "../repositories/SubscriptionRepository";
import { PlanRepository } from "../repositories/PlanRepository";
import { StripeService } from "../services/stripe-service";
import { logger } from "../utils/logger";
import { BadRequestError, NotFoundError, ConflictError } from "../middleware/errorHandler";
import {
  requireAuth,
  requireBillingAccess,
  getOrganizationId,
  getUserId,
} from "../middleware/auth";
import { ApiResponse } from "../types";

const router = Router();
const subscriptionRepo = new SubscriptionRepository();
const planRepo = new PlanRepository();
const stripeService = new StripeService();

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireBillingAccess);

/**
 * GET /api/subscriptions/:organizationId
 * Get subscription for organization
 */
router.get("/:organizationId", async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const authOrgId = getOrganizationId(req);

    // Ensure user can only access their organization's subscription
    if (organizationId !== authOrgId) {
      throw new BadRequestError("Access denied to this organization");
    }

    const subscription = await subscriptionRepo.getByOrganizationId(organizationId);

    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    logger.info("Subscription retrieved", { organizationId, subscriptionId: subscription.id });

    // Get plan details
    const planDetails = await planRepo.getPlanWithDetails(subscription.planId);

    const response: ApiResponse = {
      status: "success",
      data: {
        subscription,
        plan: planDetails.plan,
        features: planDetails.features,
        limits: planDetails.limits,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscriptions
 * Create new subscription
 */
router.post("/", async (req, res, next) => {
  try {
    const { organization_id, plan_id, billing_cycle, payment_method_id } = req.body;
    const authOrgId = getOrganizationId(req);
    const userId = getUserId(req);

    // Ensure user can only create subscription for their organization
    if (organization_id !== authOrgId) {
      throw new BadRequestError("Access denied to this organization");
    }

    // Validate required fields
    if (!organization_id || !plan_id || !billing_cycle) {
      throw new BadRequestError("Missing required fields: organization_id, plan_id, billing_cycle");
    }

    if (!["monthly", "yearly"].includes(billing_cycle)) {
      throw new BadRequestError("Invalid billing cycle. Must be 'monthly' or 'yearly'");
    }

    // Check if organization already has a subscription
    const existingSubscription = await subscriptionRepo.getByOrganizationId(organization_id);
    if (existingSubscription) {
      throw new ConflictError("Organization already has an active subscription");
    }

    // Get plan details
    const plan = await planRepo.getById(plan_id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    // Get the appropriate Stripe price ID
    const priceId =
      billing_cycle === "monthly" ? plan.stripeMonthlyPriceId : plan.stripeYearlyPriceId;

    if (!priceId) {
      throw new BadRequestError(`No Stripe price configured for ${billing_cycle} billing`);
    }

    // Create Stripe customer and subscription
    const stripeCustomer = await stripeService.createCustomer({
      email: `billing+${organization_id}@example.com`, // This should come from organization data
    });

    const stripeSubscription = await stripeService.createSubscription({
      customerId: stripeCustomer.id,
      priceId,
      paymentMethodId: payment_method_id,
    });

    // Create subscription in database
    const subscription = await subscriptionRepo.create({
      organizationId: organization_id,
      planId: plan_id,
      billingCycle: billing_cycle,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeCustomer.id,
    });

    logger.info("Subscription created", {
      organizationId: organization_id,
      subscriptionId: subscription.id,
      userId,
    });

    const response: ApiResponse = {
      status: "success",
      data: {
        subscription,
        stripe_subscription: stripeSubscription,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/subscriptions/:id
 * Update subscription
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan_id, billing_cycle } = req.body;
    const authOrgId = getOrganizationId(req);
    const userId = getUserId(req);

    // Get existing subscription
    const existingSubscription = await subscriptionRepo.getById(id);
    if (!existingSubscription) {
      throw new NotFoundError("Subscription not found");
    }

    // Ensure user can only update their organization's subscription
    if (existingSubscription.organizationId !== authOrgId) {
      throw new BadRequestError("Access denied to this subscription");
    }

    // Validate billing cycle if provided
    if (billing_cycle && !["monthly", "yearly"].includes(billing_cycle)) {
      throw new BadRequestError("Invalid billing cycle. Must be 'monthly' or 'yearly'");
    }

    // Update Stripe subscription if needed
    if (plan_id || billing_cycle) {
      // For now, we'll skip the Stripe update as it requires more complex logic
      // to handle plan changes and billing cycle changes properly
      // This would typically involve creating a new subscription or modifying items
      logger.info("Subscription update requested", { 
        subscriptionId: id, 
        plan_id, 
        billing_cycle 
      });
    }

    // Update subscription in database
    const updatedSubscription = await subscriptionRepo.update(id, {
      planId: plan_id,
      billingCycle: billing_cycle,
      updatedAt: new Date(),
    });

    logger.info("Subscription updated", {
      subscriptionId: id,
      organizationId: authOrgId,
      userId,
    });

    res.json({
      status: "success",
      data: updatedSubscription,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/subscriptions/:id
 * Cancel subscription
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { immediate } = req.query;
    const authOrgId = getOrganizationId(req);
    const userId = getUserId(req);

    // Get existing subscription
    const existingSubscription = await subscriptionRepo.getById(id);
    if (!existingSubscription) {
      throw new NotFoundError("Subscription not found");
    }

    // Ensure user can only cancel their organization's subscription
    if (existingSubscription.organizationId !== authOrgId) {
      throw new BadRequestError("Access denied to this subscription");
    }

    // Cancel Stripe subscription
    const canceledStripeSubscription = await stripeService.cancelSubscription(
      existingSubscription.stripeSubscriptionId!,
      { cancelAtPeriodEnd: immediate === "true" }
    );

    // Update subscription in database
    const canceledSubscription = await subscriptionRepo.update(id, {
      status: canceledStripeSubscription.status as any,
      cancelsAtPeriodEnd: canceledStripeSubscription.cancel_at_period_end,
      canceledAt:
        canceledStripeSubscription.canceled_at ?
          new Date(canceledStripeSubscription.canceled_at * 1000)
        : null,
      updatedAt: new Date(),
    });

    logger.info("Subscription canceled", {
      subscriptionId: id,
      organizationId: authOrgId,
      immediate: immediate === "true",
      userId,
    });

    res.json({
      status: "success",
      data: canceledSubscription,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
