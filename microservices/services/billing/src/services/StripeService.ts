import Stripe from "stripe";
import { logger } from "../utils/logger";
import { BadRequestError, InternalServerError } from "../middleware/errorHandler";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
      typescript: true,
    });
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createOrGetCustomer(organizationId: string, email?: string): Promise<Stripe.Customer> {
    try {
      // First, try to find existing customer by metadata
      const existingCustomers = await this.stripe.customers.list({
        metadata: { organization_id: organizationId },
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0]!;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          organization_id: organizationId,
        },
      });

      logger.info("Created Stripe customer", { 
        customerId: customer.id, 
        organizationId 
      });

      return customer;
    } catch (error) {
      logger.error("Failed to create/get Stripe customer", { error, organizationId });
      throw new InternalServerError("Failed to create customer");
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
    trialDays?: number
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      };

      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      if (trialDays && trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      logger.info("Created Stripe subscription", { 
        subscriptionId: subscription.id,
        customerId,
        priceId 
      });

      return subscription;
    } catch (error) {
      logger.error("Failed to create Stripe subscription", { 
        error, 
        customerId, 
        priceId 
      });
      throw new BadRequestError("Failed to create subscription");
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updates
      );

      logger.info("Updated Stripe subscription", { 
        subscriptionId,
        updates 
      });

      return subscription;
    } catch (error) {
      logger.error("Failed to update Stripe subscription", { 
        error, 
        subscriptionId, 
        updates 
      });
      throw new BadRequestError("Failed to update subscription");
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
        }
      );

      logger.info("Canceled Stripe subscription", { 
        subscriptionId,
        cancelAtPeriodEnd 
      });

      return subscription;
    } catch (error) {
      logger.error("Failed to cancel Stripe subscription", { 
        error, 
        subscriptionId 
      });
      throw new BadRequestError("Failed to cancel subscription");
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error("Failed to get Stripe subscription", { 
        error, 
        subscriptionId 
      });
      throw new BadRequestError("Failed to retrieve subscription");
    }
  }

  /**
   * Create a payment method
   */
  async createPaymentMethod(
    customerId: string,
    paymentMethodData: Stripe.PaymentMethodCreateParams
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create(paymentMethodData);
      
      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId,
      });

      logger.info("Created and attached payment method", { 
        paymentMethodId: paymentMethod.id,
        customerId 
      });

      return paymentMethod;
    } catch (error) {
      logger.error("Failed to create payment method", { 
        error, 
        customerId 
      });
      throw new BadRequestError("Failed to create payment method");
    }
  }

  /**
   * Get customer's payment methods
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error("Failed to get payment methods", { 
        error, 
        customerId 
      });
      throw new BadRequestError("Failed to retrieve payment methods");
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error("Failed to verify Stripe webhook signature", { error });
      throw new BadRequestError("Invalid webhook signature");
    }
  }

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });

      logger.info("Created setup intent", { 
        setupIntentId: setupIntent.id,
        customerId 
      });

      return setupIntent;
    } catch (error) {
      logger.error("Failed to create setup intent", { 
        error, 
        customerId 
      });
      throw new BadRequestError("Failed to create setup intent");
    }
  }
} 