import { query, queryOne, transaction } from "../utils/database";
import { Subscription, CreateSubscriptionRequest } from "../types";
import { v4 as uuidv4 } from "uuid";

export class SubscriptionRepository {
  /**
   * Get subscription by organization ID
   */
  async getByOrganizationId(organizationId: string): Promise<Subscription | null> {
    const result = await queryOne<Subscription>(
      `SELECT * FROM subscriptions 
       WHERE organization_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [organizationId]
    );
    return result;
  }

  /**
   * Get subscription by ID
   */
  async getById(id: string): Promise<Subscription | null> {
    const result = await queryOne<Subscription>(
      "SELECT * FROM subscriptions WHERE id = $1",
      [id]
    );
    return result;
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const result = await queryOne<Subscription>(
      "SELECT * FROM subscriptions WHERE stripe_subscription_id = $1",
      [stripeSubscriptionId]
    );
    return result;
  }

  /**
   * Create a new subscription
   */
  async create(data: CreateSubscriptionRequest & {
    stripe_subscription_id?: string;
    stripe_customer_id?: string;
    trial_ends_at?: Date;
    current_period_start: Date;
    current_period_end: Date;
  }): Promise<Subscription> {
    const id = uuidv4();
    const now = new Date();

    const result = await queryOne<Subscription>(
      `INSERT INTO subscriptions (
        id, organization_id, plan_id, billing_cycle, status,
        trial_ends_at, current_period_start, current_period_end,
        stripe_subscription_id, stripe_customer_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        data.organization_id,
        data.plan_id,
        data.billing_cycle,
        "active", // Default status
        data.trial_ends_at || null,
        data.current_period_start,
        data.current_period_end,
        data.stripe_subscription_id || null,
        data.stripe_customer_id || null,
        now,
        now,
      ]
    );

    if (!result) {
      throw new Error("Failed to create subscription");
    }

    return result;
  }

  /**
   * Update subscription
   */
  async update(id: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    if (!setClause) {
      return this.getById(id);
    }

    const values = [id, ...Object.values(updates), new Date()];
    
    const result = await queryOne<Subscription>(
      `UPDATE subscriptions 
       SET ${setClause}, updated_at = $${values.length}
       WHERE id = $1 
       RETURNING *`,
      values
    );

    return result;
  }

  /**
   * Cancel subscription
   */
  async cancel(id: string, canceledAt?: Date): Promise<Subscription | null> {
    const now = canceledAt || new Date();
    
    const result = await queryOne<Subscription>(
      `UPDATE subscriptions 
       SET status = 'canceled', canceled_at = $2, updated_at = $3
       WHERE id = $1 
       RETURNING *`,
      [id, now, new Date()]
    );

    return result;
  }

  /**
   * Get active subscriptions that are ending soon (for trial reminders, etc.)
   */
  async getEndingSoon(days: number = 3): Promise<Subscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const results = await query<Subscription>(
      `SELECT * FROM subscriptions 
       WHERE status = 'trialing' 
       AND trial_ends_at <= $1 
       AND trial_ends_at > NOW()
       ORDER BY trial_ends_at ASC`,
      [futureDate]
    );

    return results;
  }

  /**
   * Get subscriptions by status
   */
  async getByStatus(status: string): Promise<Subscription[]> {
    const results = await query<Subscription>(
      "SELECT * FROM subscriptions WHERE status = $1 ORDER BY created_at DESC",
      [status]
    );

    return results;
  }

  /**
   * Update subscription from Stripe webhook data
   */
  async updateFromStripe(stripeSubscriptionId: string, stripeData: any): Promise<Subscription | null> {
    return await transaction(async (client) => {
      // First, find the subscription
      const existingResult = await client.query(
        "SELECT * FROM subscriptions WHERE stripe_subscription_id = $1",
        [stripeSubscriptionId]
      );

      if (existingResult.rows.length === 0) {
        return null;
      }

      // Update with Stripe data
      const updateResult = await client.query(
        `UPDATE subscriptions 
         SET 
           status = $2,
           current_period_start = $3,
           current_period_end = $4,
           trial_ends_at = $5,
           canceled_at = $6,
           cancels_at_period_end = $7,
           updated_at = $8
         WHERE stripe_subscription_id = $1
         RETURNING *`,
        [
          stripeSubscriptionId,
          stripeData.status,
          new Date(stripeData.current_period_start * 1000),
          new Date(stripeData.current_period_end * 1000),
          stripeData.trial_end ? new Date(stripeData.trial_end * 1000) : null,
          stripeData.canceled_at ? new Date(stripeData.canceled_at * 1000) : null,
          stripeData.cancel_at_period_end || false,
          new Date(),
        ]
      );

      return updateResult.rows[0] || null;
    });
  }
} 