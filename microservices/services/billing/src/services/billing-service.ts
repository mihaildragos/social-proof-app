import { Pool } from "pg";
import { EventEmitter } from "events";
import { StripeService } from "./stripe-service";
import { UsageService } from "./usage-service";
import Stripe from "stripe";

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
  private logger: any;
  private stripe: any;

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
    this.logger = console; // Simple logger for now
    this.stripe = this.stripeService; // Reference to stripe service
  }

  // Subscription Management
  private resolveCustomerId(userId?: string, organizationId?: string): string {
    if (organizationId) {
      return organizationId;
    }
    if (userId) {
      return userId;
    }
    throw new Error("Either userId or organizationId is required");
  }

  async createSubscription(data: {
    userId?: string;
    organizationId?: string;
    planId: string;
    paymentMethodId?: string;
    trialDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
  }): Promise<Subscription> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      const customerId = this.resolveCustomerId(data.userId, data.organizationId);

      // Get plan details
      const planResult = await client.query("SELECT * FROM plans WHERE id = $1 AND is_active = true", [
        data.planId,
      ]);

      if (planResult.rows.length === 0) {
        throw new Error("Plan not found or inactive");
      }

      const plan = planResult.rows[0];

      // Create subscription in Stripe
      const stripeSubscription = await this.stripeService.createSubscription({
        customerId: customerId,
        priceId: plan.stripe_price_id,
        paymentMethodId: data.paymentMethodId || "",
        trialPeriodDays: data.trialDays || plan.trial_period_days,
        couponCode: data.couponCode || "",
        metadata: data.metadata || {},
      });

      // Create subscription in database
      const subscriptionResult = await client.query(
        `INSERT INTO subscriptions (
          id, organization_id, plan_id, stripe_subscription_id, status,
          current_period_start, current_period_end, trial_end,
          cancel_at_period_end, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          stripeSubscription.id,
          customerId,
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
        organizationId: data.organizationId,
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
          priceId: data.planId || "",
          paymentMethodId: data.paymentMethodId || "",
          metadata: data.metadata || {},
          prorationBehavior: data.prorationBehavior as Stripe.SubscriptionUpdateParams.ProrationBehavior,
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
      reason?: Reason;
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
      userId: row.organization_id || row.user_id, // Support both columns
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
  async getUserInvoices(userId: string, options: any = {}): Promise<Invoice[]> {
    try {
      const { page = 1, limit = 50, status, subscription_id } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT i.*, s.billing_cycle, p.display_name as plan_name
        FROM invoices i
        LEFT JOIN subscriptions s ON i.subscription_id = s.id
        LEFT JOIN plans p ON s.plan_id = p.id
        WHERE i.organization_id = $1
      `;
      const params = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND i.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (subscription_id) {
        query += ` AND i.subscription_id = $${paramIndex}`;
        params.push(subscription_id);
        paramIndex++;
      }

      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows.map((row) => ({
        ...row,
        subtotal: parseFloat(row.subtotal),
        tax: parseFloat(row.tax),
        total: parseFloat(row.total),
      }));
    } catch (error) {
      this.logger.error("Error fetching user invoices:", error);
      throw new Error("Failed to fetch invoices");
    }
  }

  async getInvoice(invoiceId: string, userId: string): Promise<Invoice | null> {
    try {
      const query = `
        SELECT i.*, ii.description, ii.quantity, ii.unit_price, ii.amount, ii.type as item_type
        FROM invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        WHERE i.id = $1 AND i.organization_id = $2
      `;

      const result = await this.db.query(query, [invoiceId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const invoice = {
        ...result.rows[0],
        subtotal: parseFloat(result.rows[0].subtotal),
        tax: parseFloat(result.rows[0].tax),
        total: parseFloat(result.rows[0].total),
        items: result.rows
          .filter((row) => row.description)
          .map((row) => ({
            description: row.description,
            quantity: row.quantity,
            unit_price: parseFloat(row.unit_price),
            amount: parseFloat(row.amount),
            type: row.item_type,
          })),
      };

      delete invoice.description;
      delete invoice.quantity;
      delete invoice.unit_price;
      delete invoice.amount;
      delete invoice.item_type;

      return invoice;
    } catch (error) {
      this.logger.error("Error fetching invoice:", error);
      throw new Error("Failed to fetch invoice");
    }
  }

  async createInvoice(data: any): Promise<Invoice> {
    const { organization_id, subscription_id, items = [], currency = "USD", due_date } = data;

    try {
      await this.db.query("BEGIN");

      // Calculate totals
      const subtotal = items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_price,
        0
      );
      const tax = Math.round(subtotal * 0.0875 * 100) / 100; // 8.75% tax rate
      const total = subtotal + tax;

      // Create invoice
      const invoiceQuery = `
        INSERT INTO invoices (
          organization_id, subscription_id, currency, subtotal, tax, total,
          status, period_start, period_end, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const finalDueDate = due_date ? new Date(due_date) : periodEnd;

      const invoiceResult = await this.db.query(invoiceQuery, [
        organization_id,
        subscription_id,
        currency,
        subtotal,
        tax,
        total,
        "draft",
        periodStart,
        periodEnd,
        finalDueDate,
      ]);

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of items) {
        const itemQuery = `
          INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await this.db.query(itemQuery, [
          invoice.id,
          item.description,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
          item.type || "one_time",
        ]);
      }

      await this.db.query("COMMIT");

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal),
        tax: parseFloat(invoice.tax),
        total: parseFloat(invoice.total),
      };
    } catch (error) {
      await this.db.query("ROLLBACK");
      this.logger.error("Error creating invoice:", error);
      throw new Error("Failed to create invoice");
    }
  }

  async updateInvoice(invoiceId: string, userId: string, data: any): Promise<Invoice> {
    const { due_date, items } = data;

    try {
      await this.db.query("BEGIN");

      // Only allow updating draft invoices
      const existingInvoice = await this.getInvoice(invoiceId, userId);
      if (!existingInvoice) {
        throw new Error("Invoice not found");
      }

      if (existingInvoice.status !== "draft") {
        throw new Error("Only draft invoices can be updated");
      }

      // Update due date if provided
      if (due_date) {
        await this.db.query("UPDATE invoices SET due_date = $1, updated_at = NOW() WHERE id = $2", [
          new Date(due_date),
          invoiceId,
        ]);
      }

      // Update items if provided
      if (items) {
        // Delete existing items
        await this.db.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);

        // Recalculate totals
        const subtotal = items.reduce(
          (sum: number, item: any) => sum + item.quantity * item.unit_price,
          0
        );
        const tax = Math.round(subtotal * 0.0875 * 100) / 100;
        const total = subtotal + tax;

        // Update invoice totals
        await this.db.query(
          "UPDATE invoices SET subtotal = $1, tax = $2, total = $3, updated_at = NOW() WHERE id = $4",
          [subtotal, tax, total, invoiceId]
        );

        // Create new items
        for (const item of items) {
          await this.db.query(
            `
            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, type)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
            [
              invoiceId,
              item.description,
              item.quantity,
              item.unit_price,
              item.quantity * item.unit_price,
              item.type || "one_time",
            ]
          );
        }
      }

      await this.db.query("COMMIT");

      // Return updated invoice
      return (await this.getInvoice(invoiceId, userId)) as Invoice;
    } catch (error) {
      await this.db.query("ROLLBACK");
      this.logger.error("Error updating invoice:", error);
      throw error;
    }
  }

  async finalizeInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    try {
      // Update invoice status to open and generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      const query = `
        UPDATE invoices 
        SET status = 'open', number = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3 AND status = 'draft'
        RETURNING *
      `;

      const result = await this.db.query(query, [invoiceNumber, invoiceId, userId]);

      if (result.rows.length === 0) {
        throw new Error("Invoice not found or cannot be finalized");
      }

      const invoice = result.rows[0];

      // If connected to Stripe, finalize the Stripe invoice
      if (invoice.stripe_invoice_id) {
        try {
          await this.stripe.invoices.finalizeInvoice(invoice.stripe_invoice_id);
        } catch (stripeError) {
          this.logger.warn("Failed to finalize Stripe invoice:", stripeError);
        }
      }

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal),
        tax: parseFloat(invoice.tax),
        total: parseFloat(invoice.total),
      };
    } catch (error) {
      this.logger.error("Error finalizing invoice:", error);
      throw new Error("Failed to finalize invoice");
    }
  }

  async payInvoice(invoiceId: string, userId: string, data: any): Promise<any> {
    const { payment_method_id, auto_advance = true } = data;

    try {
      // Get invoice details
      const invoice = await this.getInvoice(invoiceId, userId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === "paid") {
        return { success: true, message: "Invoice already paid" };
      }

      // Process payment with Stripe if connected
      if (invoice.stripe_invoice_id && payment_method_id) {
        try {
          const paymentResult = await this.stripe.invoices.pay(invoice.stripe_invoice_id, {
            payment_method: payment_method_id,
          });

          // Update local invoice status
          await this.db.query("UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2", [
            "paid",
            invoiceId,
          ]);

          return {
            success: true,
            payment_intent_id: paymentResult.payment_intent,
            message: "Payment processed successfully",
          };
        } catch (stripeError: any) {
          this.logger.error("Stripe payment failed:", stripeError);
          throw new Error(`Payment failed: ${stripeError.message}`);
        }
      } else {
        // Manual payment marking (for testing or non-Stripe payments)
        await this.db.query("UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2", [
          "paid",
          invoiceId,
        ]);

        return {
          success: true,
          message: "Invoice marked as paid",
        };
      }
    } catch (error) {
      this.logger.error("Error processing invoice payment:", error);
      throw error;
    }
  }

  async voidInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    try {
      const query = `
        UPDATE invoices 
        SET status = 'void', updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND status IN ('draft', 'open')
        RETURNING *
      `;

      const result = await this.db.query(query, [invoiceId, userId]);

      if (result.rows.length === 0) {
        throw new Error("Invoice not found or cannot be voided");
      }

      const invoice = result.rows[0];

      // Void Stripe invoice if connected
      if (invoice.stripe_invoice_id) {
        try {
          await this.stripe.invoices.voidInvoice(invoice.stripe_invoice_id);
        } catch (stripeError) {
          this.logger.warn("Failed to void Stripe invoice:", stripeError);
        }
      }

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal),
        tax: parseFloat(invoice.tax),
        total: parseFloat(invoice.total),
      };
    } catch (error) {
      this.logger.error("Error voiding invoice:", error);
      throw new Error("Failed to void invoice");
    }
  }

  async markInvoiceUncollectible(invoiceId: string, userId: string): Promise<Invoice> {
    try {
      const query = `
        UPDATE invoices 
        SET status = 'uncollectible', updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND status = 'open'
        RETURNING *
      `;

      const result = await this.db.query(query, [invoiceId, userId]);

      if (result.rows.length === 0) {
        throw new Error("Invoice not found or cannot be marked uncollectible");
      }

      const invoice = result.rows[0];

      // Mark uncollectible in Stripe if connected
      if (invoice.stripe_invoice_id) {
        try {
          await this.stripe.invoices.markUncollectible(invoice.stripe_invoice_id);
        } catch (stripeError) {
          this.logger.warn("Failed to mark Stripe invoice uncollectible:", stripeError);
        }
      }

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal),
        tax: parseFloat(invoice.tax),
        total: parseFloat(invoice.total),
      };
    } catch (error) {
      this.logger.error("Error marking invoice uncollectible:", error);
      throw new Error("Failed to mark invoice uncollectible");
    }
  }

  async sendInvoice(invoiceId: string, userId: string): Promise<void> {
    try {
      const invoice = await this.getInvoice(invoiceId, userId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status !== "open") {
        throw new Error("Only open invoices can be sent");
      }

      // Send via Stripe if connected
      if (invoice.stripe_invoice_id) {
        try {
          await this.stripe.invoices.sendInvoice(invoice.stripe_invoice_id);
          this.logger.info(`Invoice ${invoiceId} sent via Stripe`);
        } catch (stripeError) {
          this.logger.error("Failed to send Stripe invoice:", stripeError);
          throw new Error("Failed to send invoice via Stripe");
        }
      } else {
        // TODO: Implement email sending via SendGrid or other service
        this.logger.info(`Invoice ${invoiceId} would be sent via email (not implemented)`);
      }
    } catch (error) {
      this.logger.error("Error sending invoice:", error);
      throw error;
    }
  }

  async getInvoicePdf(invoiceId: string, userId: string): Promise<Buffer> {
    try {
      const invoice = await this.getInvoice(invoiceId, userId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // If Stripe PDF URL exists, download it
      if (invoice.invoice_pdf_url) {
        const response = await fetch(invoice.invoice_pdf_url);
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer());
        }
      }

      // If Stripe invoice exists, get PDF from Stripe
      if (invoice.stripe_invoice_id) {
        try {
          const stripeInvoice = await this.stripe.invoices.retrieve(invoice.stripe_invoice_id);
          if (stripeInvoice.invoice_pdf) {
            const response = await fetch(stripeInvoice.invoice_pdf);
            if (response.ok) {
              return Buffer.from(await response.arrayBuffer());
            }
          }
        } catch (stripeError) {
          this.logger.warn("Failed to get PDF from Stripe:", stripeError);
        }
      }

      // TODO: Generate PDF using a library like puppeteer or pdfkit
      throw new Error("PDF generation not implemented");
    } catch (error) {
      this.logger.error("Error getting invoice PDF:", error);
      throw error;
    }
  }

  async getInvoiceStats(userId: string, period: string = "30d"): Promise<any> {
    try {
      const days =
        period === "7d" ? 7
        : period === "90d" ? 90
        : 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_invoices,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices,
          SUM(total) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'open' AND due_date < NOW() THEN total ELSE 0 END) as overdue_amount,
          AVG(total) as average_invoice_value
        FROM invoices 
        WHERE organization_id = $1 AND created_at >= $2
      `;

      const result = await this.db.query(query, [userId, startDate]);
      const stats = result.rows[0];

      return {
        period,
        total_invoices: parseInt(stats.total_invoices),
        paid_invoices: parseInt(stats.paid_invoices),
        open_invoices: parseInt(stats.open_invoices),
        overdue_invoices: parseInt(stats.overdue_invoices),
        total_amount: parseFloat(stats.total_amount || 0),
        paid_amount: parseFloat(stats.paid_amount || 0),
        overdue_amount: parseFloat(stats.overdue_amount || 0),
        average_invoice_value: parseFloat(stats.average_invoice_value || 0),
        payment_rate:
          stats.total_invoices > 0 ? (stats.paid_invoices / stats.total_invoices) * 100 : 0,
      };
    } catch (error) {
      this.logger.error("Error getting invoice stats:", error);
      return {
        period,
        total_invoices: 0,
        paid_invoices: 0,
        open_invoices: 0,
        overdue_invoices: 0,
        total_amount: 0,
        paid_amount: 0,
        overdue_amount: 0,
        average_invoice_value: 0,
        payment_rate: 0,
      };
    }
  }

  async getPlans(options: any = {}): Promise<Plan[]> {
    try {
      const { is_public = true, include_features = false, include_limits = false } = options;

      let query = "SELECT * FROM plans";
      const params = [];

      if (is_public !== undefined) {
        query += " WHERE is_public = $1";
        params.push(is_public);
      }

      query += " ORDER BY sort_order, price_monthly";

      const result = await this.db.query(query, params);
      const plans = result.rows.map((row) => ({
        ...row,
        price_monthly: parseFloat(row.price_monthly),
        price_yearly: parseFloat(row.price_yearly),
      }));

      // Include features if requested
      if (include_features) {
        for (const plan of plans) {
          const featuresResult = await this.db.query(
            "SELECT * FROM plan_features WHERE plan_id = $1 ORDER BY created_at",
            [plan.id]
          );
          plan.features = featuresResult.rows;
        }
      }

      // Include limits if requested
      if (include_limits) {
        for (const plan of plans) {
          const limitsResult = await this.db.query(
            "SELECT * FROM plan_limits WHERE plan_id = $1 ORDER BY resource_type",
            [plan.id]
          );
          plan.limits = limitsResult.rows.map((row) => ({
            ...row,
            overage_price: row.overage_price ? parseFloat(row.overage_price) : null,
          }));
        }
      }

      return plans;
    } catch (error) {
      this.logger.error("Error fetching plans:", error);
      throw new Error("Failed to fetch plans");
    }
  }

  async getPlan(planId: string): Promise<Plan | null> {
    try {
      const query = `
        SELECT p.*, 
               COALESCE(json_agg(DISTINCT pf.*) FILTER (WHERE pf.id IS NOT NULL), '[]') as features,
               COALESCE(json_agg(DISTINCT pl.*) FILTER (WHERE pl.id IS NOT NULL), '[]') as limits
        FROM plans p
        LEFT JOIN plan_features pf ON p.id = pf.plan_id
        LEFT JOIN plan_limits pl ON p.id = pl.plan_id
        WHERE p.id = $1
        GROUP BY p.id
      `;

      const result = await this.db.query(query, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      const plan = result.rows[0];
      return {
        ...plan,
        price_monthly: parseFloat(plan.price_monthly),
        price_yearly: parseFloat(plan.price_yearly),
        features: plan.features || [],
        limits: (plan.limits || []).map((limit: any) => ({
          ...limit,
          overage_price: limit.overage_price ? parseFloat(limit.overage_price) : null,
        })),
      };
    } catch (error) {
      this.logger.error("Error fetching plan:", error);
      throw new Error("Failed to fetch plan");
    }
  }

  async createPlan(data: any): Promise<Plan> {
    const {
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      currency = "USD",
      is_public = true,
      sort_order = 0,
      features = [],
      limits = [],
    } = data;

    try {
      await this.db.query("BEGIN");

      // Create the plan
      const planQuery = `
        INSERT INTO plans (
          name, display_name, description, price_monthly, price_yearly,
          currency, is_public, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const planResult = await this.db.query(planQuery, [
        name,
        display_name,
        description,
        price_monthly,
        price_yearly,
        currency,
        is_public,
        sort_order,
      ]);

      const plan = planResult.rows[0];

      // Create plan features
      for (const feature of features) {
        await this.db.query(
          `
          INSERT INTO plan_features (plan_id, name, description, feature_type, value, is_highlighted)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [
            plan.id,
            feature.name,
            feature.description || null,
            feature.feature_type,
            JSON.stringify(feature.value),
            feature.is_highlighted || false,
          ]
        );
      }

      // Create plan limits
      for (const limit of limits) {
        await this.db.query(
          `
          INSERT INTO plan_limits (plan_id, resource_type, max_value, overage_price)
          VALUES ($1, $2, $3, $4)
        `,
          [plan.id, limit.resource_type, limit.max_value, limit.overage_price || null]
        );
      }

      await this.db.query("COMMIT");

      return {
        ...plan,
        price_monthly: parseFloat(plan.price_monthly),
        price_yearly: parseFloat(plan.price_yearly),
      };
    } catch (error) {
      await this.db.query("ROLLBACK");
      this.logger.error("Error creating plan:", error);
      throw new Error("Failed to create plan");
    }
  }

  async updatePlan(planId: string, data: any): Promise<Plan> {
    const {
      display_name,
      description,
      price_monthly,
      price_yearly,
      is_public,
      sort_order,
      features,
      limits,
    } = data;

    try {
      await this.db.query("BEGIN");

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (display_name !== undefined) {
        updateFields.push(`display_name = $${paramIndex}`);
        updateValues.push(display_name);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateValues.push(description);
        paramIndex++;
      }

      if (price_monthly !== undefined) {
        updateFields.push(`price_monthly = $${paramIndex}`);
        updateValues.push(price_monthly);
        paramIndex++;
      }

      if (price_yearly !== undefined) {
        updateFields.push(`price_yearly = $${paramIndex}`);
        updateValues.push(price_yearly);
        paramIndex++;
      }

      if (is_public !== undefined) {
        updateFields.push(`is_public = $${paramIndex}`);
        updateValues.push(is_public);
        paramIndex++;
      }

      if (sort_order !== undefined) {
        updateFields.push(`sort_order = $${paramIndex}`);
        updateValues.push(sort_order);
        paramIndex++;
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(planId);

        const query = `UPDATE plans SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
        const result = await this.db.query(query, updateValues);

        if (result.rows.length === 0) {
          throw new Error("Plan not found");
        }
      }

      // Update features if provided
      if (features) {
        await this.db.query("DELETE FROM plan_features WHERE plan_id = $1", [planId]);
        for (const feature of features) {
          await this.db.query(
            `
            INSERT INTO plan_features (plan_id, name, description, feature_type, value, is_highlighted)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
            [
              planId,
              feature.name,
              feature.description || null,
              feature.feature_type,
              JSON.stringify(feature.value),
              feature.is_highlighted || false,
            ]
          );
        }
      }

      // Update limits if provided
      if (limits) {
        await this.db.query("DELETE FROM plan_limits WHERE plan_id = $1", [planId]);
        for (const limit of limits) {
          await this.db.query(
            `
            INSERT INTO plan_limits (plan_id, resource_type, max_value, overage_price)
            VALUES ($1, $2, $3, $4)
          `,
            [planId, limit.resource_type, limit.max_value, limit.overage_price || null]
          );
        }
      }

      await this.db.query("COMMIT");

      // Return updated plan
      return (await this.getPlan(planId)) as Plan;
    } catch (error) {
      await this.db.query("ROLLBACK");
      this.logger.error("Error updating plan:", error);
      throw new Error("Failed to update plan");
    }
  }

  async deletePlan(planId: string, userId: string): Promise<void> {
    try {
      // Check if plan has active subscriptions
      const activeSubsResult = await this.db.query(
        "SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = $1 AND status = $2",
        [planId, "active"]
      );

      if (parseInt(activeSubsResult.rows[0].count) > 0) {
        throw new Error("Cannot delete plan with active subscriptions");
      }

      // Soft delete by marking as not public instead of hard delete
      await this.db.query("UPDATE plans SET is_public = FALSE, updated_at = NOW() WHERE id = $1", [
        planId,
      ]);

      this.logger.info(`Plan ${planId} marked as private by user ${userId}`);
    } catch (error) {
      this.logger.error("Error deleting plan:", error);
      throw error;
    }
  }

  async archivePlan(planId: string, userId: string): Promise<Plan> {
    try {
      const query = `
        UPDATE plans 
        SET is_public = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, [planId]);

      if (result.rows.length === 0) {
        throw new Error("Plan not found");
      }

      const plan = result.rows[0];
      this.logger.info(`Plan ${planId} archived by user ${userId}`);

      return {
        ...plan,
        price_monthly: parseFloat(plan.price_monthly),
        price_yearly: parseFloat(plan.price_yearly),
      };
    } catch (error) {
      this.logger.error("Error archiving plan:", error);
      throw new Error("Failed to archive plan");
    }
  }

  async getPlanFeatures(planId: string): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM plan_features 
        WHERE plan_id = $1 
        ORDER BY is_highlighted DESC, created_at
      `;

      const result = await this.db.query(query, [planId]);
      return result.rows;
    } catch (error) {
      this.logger.error("Error fetching plan features:", error);
      throw new Error("Failed to fetch plan features");
    }
  }

  async comparePlans(planIds: string[]): Promise<any> {
    try {
      if (planIds.length === 0) {
        return { plans: [], comparison: {} };
      }

      const placeholders = planIds.map((_, i) => `$${i + 1}`).join(",");

      const query = `
        SELECT p.*, 
               COALESCE(json_agg(DISTINCT pf.*) FILTER (WHERE pf.id IS NOT NULL), '[]') as features,
               COALESCE(json_agg(DISTINCT pl.*) FILTER (WHERE pl.id IS NOT NULL), '[]') as limits
        FROM plans p
        LEFT JOIN plan_features pf ON p.id = pf.plan_id
        LEFT JOIN plan_limits pl ON p.id = pl.plan_id
        WHERE p.id IN (${placeholders})
        GROUP BY p.id
        ORDER BY p.sort_order, p.price_monthly
      `;

      const result = await this.db.query(query, planIds);
      const plans = result.rows.map((row) => ({
        ...row,
        price_monthly: parseFloat(row.price_monthly),
        price_yearly: parseFloat(row.price_yearly),
        features: row.features || [],
        limits: (row.limits || []).map((limit: any) => ({
          ...limit,
          overage_price: limit.overage_price ? parseFloat(limit.overage_price) : null,
        })),
      }));

      // Build feature comparison matrix
      const allFeatures = new Set();
      const allLimits = new Set();

      plans.forEach((plan) => {
        plan.features.forEach((f: any) => allFeatures.add(f.name));
        plan.limits.forEach((l: any) => allLimits.add(l.resource_type));
      });

      const comparison = {
        features: Array.from(allFeatures).map((featureName) => {
          const feature = { name: featureName, values: {} };
          plans.forEach((plan) => {
            const planFeature = plan.features.find((f: any) => f.name === featureName);
            feature.values[plan.id] = planFeature ? planFeature.value : null;
          });
          return feature;
        }),
        limits: Array.from(allLimits).map((limitType) => {
          const limit = { resource_type: limitType, values: {} };
          plans.forEach((plan) => {
            const planLimit = plan.limits.find((l: any) => l.resource_type === limitType);
            limit.values[plan.id] =
              planLimit ?
                {
                  max_value: planLimit.max_value,
                  overage_price: planLimit.overage_price,
                }
              : null;
          });
          return limit;
        }),
      };

      return { plans, comparison };
    } catch (error) {
      this.logger.error("Error comparing plans:", error);
      throw new Error("Failed to compare plans");
    }
  }

  async getPlanPricing(planId: string): Promise<any> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) {
        throw new Error("Plan not found");
      }

      const yearlyDiscount =
        plan.price_yearly > 0 ?
          Math.round(
            ((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100
          )
        : 0;

      return {
        plan_id: plan.id,
        name: plan.name,
        display_name: plan.display_name,
        monthly: {
          price: plan.price_monthly,
          currency: plan.currency,
          per_month: plan.price_monthly,
        },
        yearly: {
          price: plan.price_yearly,
          currency: plan.currency,
          per_month: plan.price_yearly / 12,
          total_savings: plan.price_monthly * 12 - plan.price_yearly,
          discount_percentage: yearlyDiscount,
        },
        limits:
          plan.limits?.reduce((acc: any, limit: any) => {
            acc[limit.resource_type] = {
              max_value: limit.max_value,
              overage_price: limit.overage_price,
              unlimited: limit.max_value === -1,
            };
            return acc;
          }, {}) || {},
      };
    } catch (error) {
      this.logger.error("Error getting plan pricing:", error);
      throw new Error("Failed to get plan pricing");
    }
  }

  async getPlanLimits(planId: string): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM plan_limits 
        WHERE plan_id = $1 
        ORDER BY resource_type
      `;

      const result = await this.db.query(query, [planId]);
      return result.rows.map((row) => ({
        ...row,
        overage_price: row.overage_price ? parseFloat(row.overage_price) : null,
        unlimited: row.max_value === -1,
      }));
    } catch (error) {
      this.logger.error("Error fetching plan limits:", error);
      throw new Error("Failed to fetch plan limits");
    }
  }

  async getPlanStats(planId: string): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN status = 'trialing' THEN 1 END) as trial_subscriptions,
          COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_subscriptions,
          COUNT(CASE WHEN billing_cycle = 'monthly' THEN 1 END) as monthly_subscriptions,
          COUNT(CASE WHEN billing_cycle = 'yearly' THEN 1 END) as yearly_subscriptions,
          SUM(CASE WHEN status = 'active' AND billing_cycle = 'monthly' THEN 
                (SELECT price_monthly FROM plans WHERE id = $1) ELSE 0 END) as monthly_mrr,
          SUM(CASE WHEN status = 'active' AND billing_cycle = 'yearly' THEN 
                (SELECT price_yearly FROM plans WHERE id = $1) ELSE 0 END) as yearly_arr
        FROM subscriptions 
        WHERE plan_id = $1
      `;

      const result = await this.db.query(query, [planId]);
      const stats = result.rows[0];

      return {
        plan_id: planId,
        total_subscriptions: parseInt(stats.total_subscriptions),
        active_subscriptions: parseInt(stats.active_subscriptions),
        trial_subscriptions: parseInt(stats.trial_subscriptions),
        canceled_subscriptions: parseInt(stats.canceled_subscriptions),
        monthly_subscriptions: parseInt(stats.monthly_subscriptions),
        yearly_subscriptions: parseInt(stats.yearly_subscriptions),
        monthly_mrr: parseFloat(stats.monthly_mrr || 0),
        yearly_arr: parseFloat(stats.yearly_arr || 0),
        churn_rate:
          stats.total_subscriptions > 0 ?
            (stats.canceled_subscriptions / stats.total_subscriptions) * 100
          : 0,
      };
    } catch (error) {
      this.logger.error("Error getting plan stats:", error);
      return {
        plan_id: planId,
        total_subscriptions: 0,
        active_subscriptions: 0,
        trial_subscriptions: 0,
        canceled_subscriptions: 0,
        monthly_subscriptions: 0,
        yearly_subscriptions: 0,
        monthly_mrr: 0,
        yearly_arr: 0,
        churn_rate: 0,
      };
    }
  }

  async getRecommendedPlan(userId: string, options: any = {}): Promise<any> {
    try {
      const { usage_data = {}, budget_range, current_plan_id } = options;

      // Get all public plans
      const plans = await this.getPlans({ is_public: true, include_limits: true });

      if (plans.length === 0) {
        return { recommended_plan: null, reason: "No plans available" };
      }

      // If user has usage data, recommend based on limits
      if (Object.keys(usage_data).length > 0) {
        for (const plan of plans.sort((a, b) => a.price_monthly - b.price_monthly)) {
          let canFitUsage = true;

          for (const [resourceType, quantity] of Object.entries(usage_data)) {
            const limit = plan.limits?.find((l) => l.resource_type === resourceType);
            if (limit && limit.max_value !== -1 && (quantity as number) > limit.max_value) {
              canFitUsage = false;
              break;
            }
          }

          if (canFitUsage) {
            return {
              recommended_plan: plan,
              reason: "Best fit for your current usage patterns",
              savings:
                current_plan_id ? await this.calculateSavings(current_plan_id, plan.id) : null,
            };
          }
        }
      }

      // If budget range is provided, recommend within budget
      if (budget_range) {
        const { min, max } = budget_range;
        const affordablePlans = plans.filter(
          (p) => p.price_monthly >= min && p.price_monthly <= max
        );

        if (affordablePlans.length > 0) {
          // Recommend the highest tier within budget
          const recommended = affordablePlans.sort((a, b) => b.price_monthly - a.price_monthly)[0];
          return {
            recommended_plan: recommended,
            reason: "Best value within your budget range",
          };
        }
      }

      // Default recommendation: starter plan or most popular
      const starterPlan = plans.find((p) => p.name === "starter") || plans[1] || plans[0];

      return {
        recommended_plan: starterPlan,
        reason: "Recommended for getting started",
      };
    } catch (error) {
      this.logger.error("Error getting recommended plan:", error);
      return {
        recommended_plan: null,
        reason: "Unable to determine recommendation",
      };
    }
  }

  private async calculateSavings(currentPlanId: string, newPlanId: string): Promise<any> {
    try {
      const currentPlan = await this.getPlan(currentPlanId);
      const newPlan = await this.getPlan(newPlanId);

      if (!currentPlan || !newPlan) {
        return null;
      }

      return {
        monthly_savings: currentPlan.price_monthly - newPlan.price_monthly,
        yearly_savings: currentPlan.price_yearly - newPlan.price_yearly,
        percentage_savings:
          currentPlan.price_monthly > 0 ?
            Math.round(
              ((currentPlan.price_monthly - newPlan.price_monthly) / currentPlan.price_monthly) *
                100
            )
          : 0,
      };
    } catch (error) {
      this.logger.warn("Error calculating savings:", error);
      return null;
    }
  }
}
