import { prisma } from "../lib/prisma";
import { Subscription, CreateSubscriptionRequest } from "../types";
import { v4 as uuidv4 } from "uuid";

export class SubscriptionRepository {
  /**
   * Get subscription by organization ID
   */
  async getByOrganizationId(organizationId: string): Promise<Subscription | null> {
    const result = await prisma.subscription.findFirst({
      where: {
        organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return result;
  }

  /**
   * Get subscription by ID
   */
  async getById(id: string): Promise<Subscription | null> {
    const result = await prisma.subscription.findUnique({
      where: {
        id
      }
    });
    return result;
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const result = await prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId
      }
    });
    return result;
  }

  /**
   * Create a new subscription
   */
  async create(data: CreateSubscriptionRequest & {
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    trialEndsAt?: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<Subscription> {
    const result = await prisma.subscription.create({
      data: {
        organizationId: data.organizationId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        status: "active",
        trialEndsAt: data.trialEndsAt || null,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        stripeCustomerId: data.stripeCustomerId || null,
      }
    });

    return result;
  }

  /**
   * Update subscription
   */
  async update(id: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    if (Object.keys(updates).length === 0) {
      return this.getById(id);
    }

    // Build update object from provided fields
    const prismaUpdates: any = {};
    if (updates.organizationId) prismaUpdates.organizationId = updates.organizationId;
    if (updates.planId) prismaUpdates.planId = updates.planId;
    if (updates.billingCycle) prismaUpdates.billingCycle = updates.billingCycle;
    if (updates.status) prismaUpdates.status = updates.status;
    if (updates.trialEndsAt !== undefined) prismaUpdates.trialEndsAt = updates.trialEndsAt;
    if (updates.currentPeriodStart) prismaUpdates.currentPeriodStart = updates.currentPeriodStart;
    if (updates.currentPeriodEnd) prismaUpdates.currentPeriodEnd = updates.currentPeriodEnd;
    if (updates.cancelsAtPeriodEnd !== undefined) prismaUpdates.cancelsAtPeriodEnd = updates.cancelsAtPeriodEnd;
    if (updates.canceledAt !== undefined) prismaUpdates.canceledAt = updates.canceledAt;
    if (updates.stripeSubscriptionId !== undefined) prismaUpdates.stripeSubscriptionId = updates.stripeSubscriptionId;
    if (updates.stripeCustomerId !== undefined) prismaUpdates.stripeCustomerId = updates.stripeCustomerId;
    
    const result = await prisma.subscription.update({
      where: { id },
      data: prismaUpdates
    });

    return result;
  }

  /**
   * Cancel subscription
   */
  async cancel(id: string, canceledAt?: Date): Promise<Subscription | null> {
    const now = canceledAt || new Date();
    
    const result = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: now
      }
    });

    return result;
  }

  /**
   * Get active subscriptions that are ending soon (for trial reminders, etc.)
   */
  async getEndingSoon(days: number = 3): Promise<Subscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const now = new Date();

    const results = await prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          lte: futureDate,
          gt: now
        }
      },
      orderBy: {
        trialEndsAt: 'asc'
      }
    });

    return results;
  }

  /**
   * Get subscriptions by status
   */
  async getByStatus(status: string): Promise<Subscription[]> {
    const results = await prisma.subscription.findMany({
      where: {
        status
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return results;
  }

  /**
   * Update subscription from Stripe webhook data
   */
  async updateFromStripe(stripeSubscriptionId: string, stripeData: any): Promise<Subscription | null> {
    return await prisma.$transaction(async (prisma) => {
      // First, find the subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          stripeSubscriptionId
        }
      });

      if (!existingSubscription) {
        return null;
      }

      // Update with Stripe data
      const updatedSubscription = await prisma.subscription.update({
        where: {
          id: existingSubscription.id
        },
        data: {
          status: stripeData.status,
          currentPeriodStart: new Date(stripeData.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeData.current_period_end * 1000),
          trialEndsAt: stripeData.trial_end ? new Date(stripeData.trial_end * 1000) : null,
          canceledAt: stripeData.canceled_at ? new Date(stripeData.canceled_at * 1000) : null,
          cancelsAtPeriodEnd: stripeData.cancel_at_period_end || false,
        }
      });

      return updatedSubscription;
    });
  }
} 