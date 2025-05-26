import { Pool } from "pg";
import { EventEmitter } from "events";
import { StripeService } from "./stripe-service";
import { UsageService } from "./usage-service";

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  cancellationReason?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  paymentMethodId?: string;
  receiptUrl?: string;
  failureReason?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface Invoice {
  id: string;
  userId: string;
  number: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  description?: string;
  dueDate?: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  subscriptionId?: string;
  customerId?: string;
  lines: any[];
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
  trialPeriodDays?: number;
  features: any[];
  metadata?: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BillingService extends EventEmitter {
  private db: Pool;
  private stripeService: StripeService;
  private usageService: UsageService;

  constructor() {
    super();
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.stripeService = new StripeService();
    this.usageService = new UsageService();
  }

  // Subscription Management
  async createSubscription(data: {
    userId: string;
    planId: string;
    paymentMethodId?: string;
    trialDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
  }): Promise<Subscription> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Get plan details
      const planResult = await client.query("SELECT * FROM plans WHERE id = $1 AND active = true", [
        data.planId,
      ]);

      if (planResult.rows.length === 0) {
        throw new Error("Plan not found or inactive");
      }

      const plan = planResult.rows[0];

      // Create subscription in Stripe
      const stripeSubscription = await this.stripeService.createSubscription({
        customerId: data.userId,
        priceId: plan.stripe_price_id,
        paymentMethodId: data.paymentMethodId,
        trialPeriodDays: data.trialDays || plan.trial_period_days,
        couponCode: data.couponCode,
        metadata: data.metadata,
      });

      // Create subscription in database
      const subscriptionResult = await client.query(
        `INSERT INTO subscriptions (
          id, user_id, plan_id, stripe_subscription_id, status,
          current_period_start, current_period_end, trial_end,
          cancel_at_period_end, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          stripeSubscription.id,
          data.userId,
          data.planId,
          stripeSubscription.id,
          stripeSubscription.status,
          new Date(stripeSubscription.current_period_start * 1000),
          new Date(stripeSubscription.current_period_end * 1000),
          stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          stripeSubscription.cancel_at_period_end,
          JSON.stringify(data.metadata || {}),
        ]
      );

      await client.query("COMMIT");

      const subscription = this.mapSubscription(subscriptionResult.rows[0]);

      // Emit event
      this.emit("subscription.created", {
        subscription,
        userId: data.userId,
        planId: data.planId,
      });

      return subscription;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    const result = await this.db.query(
      `SELECT * FROM subscriptions 
       WHERE user_id = $1 AND status IN ('active', 'trialing') 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? this.mapSubscription(result.rows[0]) : null;
  }

  async getUserSubscriptions(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Subscription[]> {
    let query = "SELECT * FROM subscriptions WHERE user_id = $1";
    const params: any[] = [userId];

    if (options.status) {
      query += " AND status = $2";
      params.push(options.status);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapSubscription(row));
  }

  async getSubscription(subscriptionId: string, userId: string): Promise<Subscription | null> {
    const result = await this.db.query(
      "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
      [subscriptionId, userId]
    );

    return result.rows.length > 0 ? this.mapSubscription(result.rows[0]) : null;
  }

  async updateSubscription(
    subscriptionId: string,
    userId: string,
    data: {
      planId?: string;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
      prorationBehavior?: string;
    }
  ): Promise<Subscription> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Get current subscription
      const currentResult = await client.query(
        "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
        [subscriptionId, userId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error("Subscription not found");
      }

      const currentSubscription = currentResult.rows[0];

      // Update subscription in Stripe
      const stripeSubscription = await this.stripeService.updateSubscription(
        currentSubscription.stripe_subscription_id,
        {
          priceId: data.planId,
          paymentMethodId: data.paymentMethodId,
          metadata: data.metadata,
          prorationBehavior: data.prorationBehavior,
        }
      );

      // Update subscription in database
      const updateResult = await client.query(
        `UPDATE subscriptions SET
          plan_id = COALESCE($1, plan_id),
          status = $2,
          current_period_start = $3,
          current_period_end = $4,
          metadata = COALESCE($5, metadata),
          updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [
          data.planId,
          stripeSubscription.status,
          new Date(stripeSubscription.current_period_start * 1000),
          new Date(stripeSubscription.current_period_end * 1000),
          data.metadata ? JSON.stringify(data.metadata) : null,
          subscriptionId,
          userId,
        ]
      );

      await client.query("COMMIT");

      const subscription = this.mapSubscription(updateResult.rows[0]);

      // Emit event
      this.emit("subscription.updated", {
        subscription,
        userId,
        changes: data,
      });

      return subscription;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    userId: string,
    options: {
      cancelAtPeriodEnd?: boolean;
      cancellationReason?: string;
      feedback?: string;
    } = {}
  ): Promise<Subscription> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Get current subscription
      const currentResult = await client.query(
        "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
        [subscriptionId, userId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error("Subscription not found");
      }

      const currentSubscription = currentResult.rows[0];

      // Cancel subscription in Stripe
      const stripeSubscription = await this.stripeService.cancelSubscription(
        currentSubscription.stripe_subscription_id,
        {
          cancelAtPeriodEnd: options.cancelAtPeriodEnd,
        }
      );

      // Update subscription in database
      const updateResult = await client.query(
        `UPDATE subscriptions SET
          status = $1,
          cancel_at_period_end = $2,
          canceled_at = $3,
          cancellation_reason = $4,
          updated_at = NOW()
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [
          stripeSubscription.status,
          stripeSubscription.cancel_at_period_end,
          stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
          options.cancellationReason,
          subscriptionId,
          userId,
        ]
      );

      await client.query("COMMIT");

      const subscription = this.mapSubscription(updateResult.rows[0]);

      // Emit event
      this.emit("subscription.canceled", {
        subscription,
        userId,
        reason: options.cancellationReason,
        feedback: options.feedback,
      });

      return subscription;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reactivateSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Get current subscription
      const currentResult = await client.query(
        "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
        [subscriptionId, userId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error("Subscription not found");
      }

      const currentSubscription = currentResult.rows[0];

      // Reactivate subscription in Stripe
      const stripeSubscription = await this.stripeService.reactivateSubscription(
        currentSubscription.stripe_subscription_id
      );

      // Update subscription in database
      const updateResult = await client.query(
        `UPDATE subscriptions SET
          status = $1,
          cancel_at_period_end = false,
          canceled_at = NULL,
          cancellation_reason = NULL,
          updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [stripeSubscription.status, subscriptionId, userId]
      );

      await client.query("COMMIT");

      const subscription = this.mapSubscription(updateResult.rows[0]);

      // Emit event
      this.emit("subscription.reactivated", {
        subscription,
        userId,
      });

      return subscription;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSubscriptionUsage(
    subscriptionId: string,
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any> {
    // Get subscription
    const subscription = await this.getSubscription(subscriptionId, userId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Get usage data from usage service
    return await this.usageService.getUsage(userId, {
      startDate: options.startDate || subscription.currentPeriodStart,
      endDate: options.endDate || subscription.currentPeriodEnd,
    });
  }

  async previewSubscriptionChange(
    subscriptionId: string,
    userId: string,
    data: {
      planId?: string;
      prorationBehavior?: string;
    }
  ): Promise<any> {
    // Get current subscription
    const subscription = await this.getSubscription(subscriptionId, userId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Get preview from Stripe
    return await this.stripeService.previewSubscriptionChange(subscription.id, {
      priceId: data.planId,
      prorationBehavior: data.prorationBehavior,
    });
  }

  // Payment Management
  async createPayment(data: {
    userId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    description?: string;
    metadata?: Record<string, string>;
    receiptEmail?: string;
  }): Promise<Payment> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Create payment in Stripe
      const stripePayment = await this.stripeService.createPayment({
        amount: data.amount,
        currency: data.currency,
        paymentMethodId: data.paymentMethodId,
        customerId: data.userId,
        description: data.description,
        metadata: data.metadata,
        receiptEmail: data.receiptEmail,
      });

      // Create payment in database
      const paymentResult = await client.query(
        `INSERT INTO payments (
          id, user_id, stripe_payment_id, amount, currency, status,
          description, payment_method_id, receipt_url, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          stripePayment.id,
          data.userId,
          stripePayment.id,
          data.amount,
          data.currency,
          stripePayment.status,
          data.description,
          data.paymentMethodId,
          stripePayment.receipt_url,
          JSON.stringify(data.metadata || {}),
        ]
      );

      await client.query("COMMIT");

      const payment = this.mapPayment(paymentResult.rows[0]);

      // Emit event
      this.emit("payment.created", {
        payment,
        userId: data.userId,
      });

      return payment;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserPayments(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<Payment[]> {
    let query = "SELECT * FROM payments WHERE user_id = $1";
    const params: any[] = [userId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapPayment(row));
  }

  async getPayment(paymentId: string, userId: string): Promise<Payment | null> {
    const result = await this.db.query("SELECT * FROM payments WHERE id = $1 AND user_id = $2", [
      paymentId,
      userId,
    ]);

    return result.rows.length > 0 ? this.mapPayment(result.rows[0]) : null;
  }

  async refundPayment(
    paymentId: string,
    userId: string,
    data: {
      amount?: number;
      reason?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<any> {
    // Get payment
    const payment = await this.getPayment(paymentId, userId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // Create refund in Stripe
    const stripeRefund = await this.stripeService.refundPayment(payment.id, {
      amount: data.amount,
      reason: data.reason,
      metadata: data.metadata,
    });

    // Emit event
    this.emit("payment.refunded", {
      payment,
      refund: stripeRefund,
      userId,
    });

    return stripeRefund;
  }

  async createPaymentMethod(data: {
    userId: string;
    type: string;
    card?: any;
    bankAccount?: any;
    billingDetails?: any;
  }): Promise<any> {
    return await this.stripeService.createPaymentMethod({
      customerId: data.userId,
      type: data.type,
      card: data.card,
      bankAccount: data.bankAccount,
      billingDetails: data.billingDetails,
    });
  }

  async getUserPaymentMethods(userId: string, options: { type?: string } = {}): Promise<any[]> {
    return await this.stripeService.getCustomerPaymentMethods(userId, options);
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    userId: string,
    data: {
      billingDetails?: any;
      isDefault?: boolean;
    }
  ): Promise<any> {
    return await this.stripeService.updatePaymentMethod(paymentMethodId, data);
  }

  async deletePaymentMethod(paymentMethodId: string, userId: string): Promise<void> {
    await this.stripeService.deletePaymentMethod(paymentMethodId);
  }

  async getPaymentStats(userId: string, period: string): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
       FROM payments 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 ${period}'`,
      [userId]
    );

    return result.rows[0];
  }

  // Helper methods
  private mapSubscription(row: any): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      trialEnd: row.trial_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at,
      cancellationReason: row.cancellation_reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPayment(row: any): Payment {
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      description: row.description,
      paymentMethodId: row.payment_method_id,
      receiptUrl: row.receipt_url,
      failureReason: row.failure_reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Placeholder methods for invoice and plan management
  async getUserInvoices(userId: string, options: any): Promise<Invoice[]> {
    // Implementation would go here
    return [];
  }

  async getInvoice(invoiceId: string, userId: string): Promise<Invoice | null> {
    // Implementation would go here
    return null;
  }

  async createInvoice(data: any): Promise<Invoice> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async updateInvoice(invoiceId: string, userId: string, data: any): Promise<Invoice> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async finalizeInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async payInvoice(invoiceId: string, userId: string, data: any): Promise<any> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async voidInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async markInvoiceUncollectible(invoiceId: string, userId: string): Promise<Invoice> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async sendInvoice(invoiceId: string, userId: string): Promise<void> {
    // Implementation would go here
  }

  async getInvoicePdf(invoiceId: string, userId: string): Promise<Buffer> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async getInvoiceStats(userId: string, period: string): Promise<any> {
    // Implementation would go here
    return {};
  }

  async getPlans(options: any): Promise<Plan[]> {
    // Implementation would go here
    return [];
  }

  async getPlan(planId: string): Promise<Plan | null> {
    // Implementation would go here
    return null;
  }

  async createPlan(data: any): Promise<Plan> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async updatePlan(planId: string, data: any): Promise<Plan> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async deletePlan(planId: string, userId: string): Promise<void> {
    // Implementation would go here
  }

  async archivePlan(planId: string, userId: string): Promise<Plan> {
    // Implementation would go here
    throw new Error("Not implemented");
  }

  async getPlanFeatures(planId: string): Promise<any[]> {
    // Implementation would go here
    return [];
  }

  async comparePlans(planIds: string[]): Promise<any> {
    // Implementation would go here
    return {};
  }

  async getPlanPricing(planId: string): Promise<any> {
    // Implementation would go here
    return {};
  }

  async getPlanLimits(planId: string): Promise<any[]> {
    // Implementation would go here
    return [];
  }

  async getPlanStats(planId: string): Promise<any> {
    // Implementation would go here
    return {};
  }

  async getRecommendedPlan(userId: string, options: any): Promise<any> {
    // Implementation would go here
    return {};
  }
}
