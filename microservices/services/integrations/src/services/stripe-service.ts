import { EventEmitter } from "events";
import Stripe from "stripe";

export interface StripeAccountData {
  stripe_user_id: string;
  access_token: string;
  refresh_token?: string;
  stripe_publishable_key: string;
  account_type: string;
  country: string;
  default_currency: string;
  business_name?: string;
  email?: string;
  scope: string;
}

export interface StripePaymentOptions {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export interface StripeCustomerOptions {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
  email?: string;
}

export class StripeService extends EventEmitter {
  private stripe: Stripe;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    super();

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    if (!process.env.STRIPE_CLIENT_ID) {
      throw new Error("STRIPE_CLIENT_ID environment variable is required");
    }

    if (!process.env.STRIPE_CLIENT_SECRET) {
      throw new Error("STRIPE_CLIENT_SECRET environment variable is required");
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      typescript: true,
    });

    this.clientId = process.env.STRIPE_CLIENT_ID;
    this.clientSecret = process.env.STRIPE_CLIENT_SECRET;
  }

  /**
   * Generate OAuth URL for Stripe Connect
   */
  async generateAuthUrl(userId: string, state?: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: this.clientId,
        scope: "read_write",
        redirect_uri: `${process.env.API_BASE_URL}/api/integrations/stripe/callback`,
        state: state || userId,
      });

      const authUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

      this.emit("auth:url_generated", { userId, authUrl });
      return authUrl;
    } catch (error) {
      this.emit("auth:url_failed", { userId, error });
      throw new Error(
        `Failed to generate auth URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<StripeAccountData> {
    try {
      const response = await this.stripe.oauth.token({
        grant_type: "authorization_code",
        code,
      });

      const accountData: StripeAccountData = {
        stripe_user_id: response.stripe_user_id || "",
        access_token: response.access_token || "",
        refresh_token: response.refresh_token,
        stripe_publishable_key: response.stripe_publishable_key || "",
        account_type: "standard",
        country: "US",
        default_currency: "usd",
        business_name: undefined,
        email: undefined,
        scope: response.scope || "",
      };

      this.emit("token:exchanged", { accountData });
      return accountData;
    } catch (error) {
      this.emit("token:exchange_failed", { code, error });
      throw new Error(
        `Failed to exchange code for token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(accountId: string): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      this.emit("account:retrieved", { accountId, account });
      return account;
    } catch (error) {
      this.emit("account:retrieve_failed", { accountId, error });
      throw new Error(
        `Failed to get account info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Setup webhooks for Stripe account
   */
  async setupWebhooks(accountId: string): Promise<void> {
    try {
      const webhookUrl = `${process.env.API_BASE_URL}/api/integrations/webhooks/stripe`;

      const webhookEvents = [
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "charge.succeeded",
        "charge.failed",
        "customer.created",
        "customer.updated",
        "customer.deleted",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ];

      const webhook = await this.stripe.webhookEndpoints.create(
        {
          url: webhookUrl,
          enabled_events: webhookEvents as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
          connect: true,
        },
        {
          stripeAccount: accountId,
        }
      );

      this.emit("webhooks:setup", { accountId, webhookId: webhook.id, events: webhookEvents });
    } catch (error) {
      this.emit("webhooks:setup_failed", { accountId, error });
      throw new Error(
        `Failed to setup webhooks: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess(accountId: string): Promise<void> {
    try {
      await this.stripe.oauth.deauthorize({
        client_id: this.clientId,
        stripe_user_id: accountId,
      });

      this.emit("access:revoked", { accountId });
    } catch (error) {
      this.emit("access:revoke_failed", { accountId, error });
      throw new Error(
        `Failed to revoke access: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get payments for account
   */
  async getPayments(
    accountId: string,
    options: StripePaymentOptions = {}
  ): Promise<Stripe.ApiList<Stripe.PaymentIntent>> {
    try {
      const payments = await this.stripe.paymentIntents.list(
        {
          limit: options.limit || 20,
          starting_after: options.starting_after,
          ending_before: options.ending_before,
        },
        {
          stripeAccount: accountId,
        }
      );

      this.emit("payments:retrieved", { accountId, count: payments.data.length });
      return payments;
    } catch (error) {
      this.emit("payments:retrieve_failed", { accountId, error });
      throw new Error(
        `Failed to get payments: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get customers for account
   */
  async getCustomers(
    accountId: string,
    options: StripeCustomerOptions = {}
  ): Promise<Stripe.ApiList<Stripe.Customer>> {
    try {
      const customers = await this.stripe.customers.list(
        {
          limit: options.limit || 20,
          starting_after: options.starting_after,
          ending_before: options.ending_before,
          email: options.email,
        },
        {
          stripeAccount: accountId,
        }
      );

      this.emit("customers:retrieved", { accountId, count: customers.data.length });
      return customers;
    } catch (error) {
      this.emit("customers:retrieve_failed", { accountId, error });
      throw new Error(
        `Failed to get customers: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Sync account data
   */
  async syncAccountData(accountId: string, userId: string): Promise<void> {
    try {
      // Get account info
      const account = await this.getAccountInfo(accountId);

      // Get recent payments
      const payments = await this.getPayments(accountId, { limit: 100 });

      // Get customers
      const customers = await this.getCustomers(accountId, { limit: 100 });

      this.emit("data:synced", {
        accountId,
        userId,
        account,
        payments: payments.data.length,
        customers: customers.data.length,
      });
    } catch (error) {
      this.emit("sync:failed", { accountId, userId, error });
      throw new Error(
        `Failed to sync account data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): Stripe.Event | null {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      return event;
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return null;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      this.emit("webhook:received", {
        eventId: event.id,
        eventType: event.type,
        accountId: event.account,
        timestamp: new Date(event.created * 1000),
      });

      // Process different event types
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case "customer.created":
          await this.handleCustomerCreated(event.data.object as Stripe.Customer);
          break;
        case "customer.updated":
          await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
          break;
        case "customer.deleted":
          await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
          break;
        default:
          // Handle subscription events and other events
          if (event.type.startsWith("customer.subscription.")) {
            const subscription = event.data.object as Stripe.Subscription;
            if (event.type === "customer.subscription.created") {
              await this.handleSubscriptionCreated(subscription);
            } else if (event.type === "customer.subscription.updated") {
              await this.handleSubscriptionUpdated(subscription);
            } else if (event.type === "customer.subscription.deleted") {
              await this.handleSubscriptionDeleted(subscription);
            }
          } else {
            console.log(`Unhandled Stripe webhook event: ${event.type}`);
          }
      }
    } catch (error) {
      this.emit("webhook:error", { eventId: event.id, eventType: event.type, error });
      throw error;
    }
  }

  /**
   * Handle payment succeeded events
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.emit("payment:succeeded", { paymentIntent });
  }

  /**
   * Handle payment failed events
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.emit("payment:failed", { paymentIntent });
  }

  /**
   * Handle customer created events
   */
  private async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    this.emit("customer:created", { customer });
  }

  /**
   * Handle customer updated events
   */
  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    this.emit("customer:updated", { customer });
  }

  /**
   * Handle customer deleted events
   */
  private async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    this.emit("customer:deleted", { customer });
  }

  /**
   * Handle subscription created events
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    this.emit("subscription:created", { subscription });
  }

  /**
   * Handle subscription updated events
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    this.emit("subscription:updated", { subscription });
  }

  /**
   * Handle subscription deleted events
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.emit("subscription:deleted", { subscription });
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(
    accountId: string,
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          return_url: returnUrl,
        },
        {
          stripeAccount: accountId,
        }
      );

      this.emit("billing_portal:created", { accountId, customerId, sessionId: session.id });
      return session;
    } catch (error) {
      this.emit("billing_portal:failed", { accountId, customerId, error });
      throw new Error(
        `Failed to create billing portal session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Create checkout session
   */
  async createCheckoutSession(
    accountId: string,
    params: Stripe.Checkout.SessionCreateParams
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create(params, {
        stripeAccount: accountId,
      });

      this.emit("checkout:created", { accountId, sessionId: session.id });
      return session;
    } catch (error) {
      this.emit("checkout:failed", { accountId, error });
      throw new Error(
        `Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
  }
}
