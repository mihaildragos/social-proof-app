import { Router, Request, Response } from "express";
import { StripeService } from "../services/StripeService";
import { SubscriptionRepository } from "../repositories/SubscriptionRepository";
import { logger } from "../utils/logger";
import { BadRequestError } from "../middleware/errorHandler";

const router = Router();
const stripeService = new StripeService();
const subscriptionRepo = new SubscriptionRepository();

/**
 * POST /webhooks/stripe
 * Handle Stripe webhooks
 */
router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    
    if (!signature) {
      throw new BadRequestError("Missing Stripe signature");
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(
      JSON.stringify(req.body),
      signature
    );

    logger.info("Received Stripe webhook", { 
      eventType: event.type,
      eventId: event.id 
    });

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object);
        break;

      default:
        logger.info("Unhandled webhook event type", { eventType: event.type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Failed to process Stripe webhook", { error });
    throw error;
  }
});

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: any): Promise<void> {
  try {
    logger.info("Processing subscription created", { 
      subscriptionId: subscription.id 
    });

    // Update subscription in database if it exists
    await subscriptionRepo.updateFromStripe(subscription.id, subscription);
  } catch (error) {
    logger.error("Failed to handle subscription created", { 
      error, 
      subscriptionId: subscription.id 
    });
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  try {
    logger.info("Processing subscription updated", { 
      subscriptionId: subscription.id,
      status: subscription.status 
    });

    // Update subscription in database
    await subscriptionRepo.updateFromStripe(subscription.id, subscription);
  } catch (error) {
    logger.error("Failed to handle subscription updated", { 
      error, 
      subscriptionId: subscription.id 
    });
  }
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  try {
    logger.info("Processing subscription deleted", { 
      subscriptionId: subscription.id 
    });

    // Update subscription status in database
    await subscriptionRepo.updateFromStripe(subscription.id, {
      ...subscription,
      status: "canceled",
      canceled_at: subscription.canceled_at
    });
  } catch (error) {
    logger.error("Failed to handle subscription deleted", { 
      error, 
      subscriptionId: subscription.id 
    });
  }
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  try {
    logger.info("Processing invoice payment succeeded", { 
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription 
    });

    // Here you could update invoice records, send confirmation emails, etc.
    // For now, just log the successful payment
  } catch (error) {
    logger.error("Failed to handle invoice payment succeeded", { 
      error, 
      invoiceId: invoice.id 
    });
  }
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  try {
    logger.info("Processing invoice payment failed", { 
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription 
    });

    // Here you could send payment failure notifications, update subscription status, etc.
    // For now, just log the failed payment
  } catch (error) {
    logger.error("Failed to handle invoice payment failed", { 
      error, 
      invoiceId: invoice.id 
    });
  }
}

/**
 * Handle trial will end event
 */
async function handleTrialWillEnd(subscription: any): Promise<void> {
  try {
    logger.info("Processing trial will end", { 
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end 
    });

    // Here you could send trial ending notifications
    // For now, just log the event
  } catch (error) {
    logger.error("Failed to handle trial will end", { 
      error, 
      subscriptionId: subscription.id 
    });
  }
}

export default router; 