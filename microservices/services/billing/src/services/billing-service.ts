import { EventEmitter } from "events";
import { prisma } from "../lib/prisma";
import { PlanRepository } from "../repositories/PlanRepository";
import { SubscriptionRepository } from "../repositories/SubscriptionRepository";
import { StripeService } from "./stripe-service";
import { UsageService } from "./usage-service";
import { Plan, Subscription, Invoice } from "../types";
import Stripe from "stripe";

export class BillingService extends EventEmitter {
  private stripeService: StripeService;
  private usageService: UsageService;
  private planRepository: PlanRepository;
  private subscriptionRepository: SubscriptionRepository;

  constructor() {
    super();
    this.stripeService = new StripeService();
    this.usageService = new UsageService();
    this.planRepository = new PlanRepository();
    this.subscriptionRepository = new SubscriptionRepository();
  }

  // Subscription Management
  async createSubscription(data: {
    userId?: string;
    organizationId?: string;
    planId: string;
    paymentMethodId?: string;
    trialDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
  }): Promise<Subscription> {
    return await prisma.$transaction(async (prisma) => {
      const organizationId = data.organizationId || data.userId;
      if (!organizationId) {
        throw new Error("Either userId or organizationId is required");
      }

      // Get plan details
      const plan = await this.planRepository.getById(data.planId);
      if (!plan || !plan.isPublic) {
        throw new Error("Plan not found or inactive");
      }

      // Create subscription in Stripe
      const subscriptionData: any = {
        customerId: organizationId,
        priceId: plan.stripeMonthlyPriceId || "",
      };
      if (data.paymentMethodId !== undefined) subscriptionData.paymentMethodId = data.paymentMethodId;
      if (data.trialDays !== undefined) subscriptionData.trialPeriodDays = data.trialDays;
      if (data.couponCode !== undefined) subscriptionData.couponCode = data.couponCode;
      if (data.metadata !== undefined) subscriptionData.metadata = data.metadata;
      
      const stripeSubscription = await this.stripeService.createSubscription(subscriptionData);

      // Create subscription in database
      const createData: any = {
        organizationId,
        planId: data.planId,
        billingCycle: "monthly",
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: organizationId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      };
      if (stripeSubscription.trial_end) {
        createData.trialEndsAt = new Date(stripeSubscription.trial_end * 1000);
      }
      
      const subscription = await this.subscriptionRepository.create(createData);

      // Emit event
      this.emit("subscription.created", {
        subscription,
        userId: data.userId,
        organizationId: data.organizationId,
        planId: data.planId,
      });

      return subscription;
    });
  }

  async getActiveSubscription(organizationId: string): Promise<Subscription | null> {
    return await this.subscriptionRepository.getByOrganizationId(organizationId);
  }

  // Plan management methods using repository
  async getPlans(options?: { active?: boolean; limit?: number; offset?: number }) {
    return await this.planRepository.getPublicPlans();
  }

  async getPlan(planId: string) {
    return await this.planRepository.getById(planId);
  }

  async getPlanFeatures(planId: string) {
    return await this.planRepository.getPlanFeatures(planId);
  }

  async getPlanLimits(planId: string) {
    return await this.planRepository.getPlanLimits(planId);
  }

  async getPlanWithDetails(planId: string) {
    return await this.planRepository.getPlanWithDetails(planId);
  }

  async getUserSubscriptions(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Subscription[]> {
    const whereClause: any = {
      organizationId: userId
    };

    if (options.status) {
      whereClause.status = options.status;
    }

    const findOptions: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    };
    if (options.limit !== undefined) findOptions.take = options.limit;
    if (options.offset !== undefined) findOptions.skip = options.offset;
    
    const subscriptions = await prisma.subscription.findMany(findOptions);

    return subscriptions;
  }

  async getSubscription(subscriptionId: string, organizationId: string): Promise<Subscription | null> {
    return await this.subscriptionRepository.getById(subscriptionId);
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
    return await prisma.$transaction(async (prisma) => {
      // Get current subscription
      const currentSubscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: userId
        }
      });

      if (!currentSubscription) {
        throw new Error("Subscription not found");
      }

      // Update subscription in Stripe if needed
      if (data.planId || data.paymentMethodId) {
        const updateData: any = {
          prorationBehavior: data.prorationBehavior as Stripe.SubscriptionUpdateParams.ProrationBehavior || "create_prorations",
        };
        if (data.planId !== undefined) updateData.priceId = data.planId;
        if (data.paymentMethodId !== undefined) updateData.paymentMethodId = data.paymentMethodId;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;
        
        const stripeSubscription = await this.stripeService.updateSubscription(
          currentSubscription.stripeSubscriptionId!,
          updateData
        );

        // Update subscription in database
        const subscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planId: data.planId || currentSubscription.planId,
            status: stripeSubscription.status,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          }
        });

        // Emit event
        this.emit("subscription.updated", {
          subscription,
          userId,
          changes: data,
        });

        return subscription;
      }

      return currentSubscription;
    });
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
    return await prisma.$transaction(async (prisma) => {
      // Get current subscription
      const currentSubscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: userId
        }
      });

      if (!currentSubscription) {
        throw new Error("Subscription not found");
      }

      // Cancel subscription in Stripe
      const stripeSubscription = await this.stripeService.cancelSubscription(
        currentSubscription.stripeSubscriptionId!,
        {
          cancelAtPeriodEnd: options.cancelAtPeriodEnd || false,
        }
      );

      // Update subscription in database
      const subscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: stripeSubscription.status,
          cancelsAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
        }
      });

      // Emit event
      this.emit("subscription.canceled", {
        subscription,
        userId,
        reason: options.cancellationReason,
        feedback: options.feedback,
      });

      return subscription;
    });
  }

  async reactivateSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    return await prisma.$transaction(async (prisma) => {
      // Get current subscription
      const currentSubscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: userId
        }
      });

      if (!currentSubscription) {
        throw new Error("Subscription not found");
      }

      // Reactivate subscription in Stripe
      const stripeSubscription = await this.stripeService.reactivateSubscription(
        currentSubscription.stripeSubscriptionId!
      );

      // Update subscription in database
      const subscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: stripeSubscription.status,
          cancelsAtPeriodEnd: false,
          canceledAt: null,
        }
      });

      // Emit event
      this.emit("subscription.reactivated", {
        subscription,
        userId,
      });

      return subscription;
    });
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
    const previewData: any = {};
    if (data.planId !== undefined) previewData.priceId = data.planId;
    if (data.prorationBehavior !== undefined) previewData.prorationBehavior = data.prorationBehavior;
    
    return await this.stripeService.previewSubscriptionChange(subscription.id, previewData);
  }

  // Payment methods
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

  // Basic invoice methods using Prisma
  async getUserInvoices(userId: string, options: any = {}): Promise<Invoice[]> {
    const { limit = 50, offset = 0, status } = options;
    
    const whereClause: any = {
      organizationId: userId
    };

    if (status) {
      whereClause.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return invoices;
  }

  async getInvoice(invoiceId: string, userId: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      },
      include: {
        items: true
      }
    });

    return invoice;
  }

  // Simplified methods that delegate to repositories
  async createPlan(data: any): Promise<Plan> {
    // This would need a PlanRepository.create method
    throw new Error("Plan creation not implemented in simplified version");
  }

  async updatePlan(planId: string, data: any): Promise<Plan> {
    // This would need a PlanRepository.update method  
    throw new Error("Plan update not implemented in simplified version");
  }

  async deletePlan(planId: string, userId: string): Promise<void> {
    // This would need a PlanRepository.delete method
    throw new Error("Plan deletion not implemented in simplified version");
  }

  // Invoice management methods
  async createInvoice(data: {
    userId: string;
    customerId?: string;
    subscriptionId: string; // Required field based on Prisma schema
    items: Array<{
      description: string;
      amount: number;
      quantity: number;
      metadata?: Record<string, string>;
    }>;
    dueDate?: Date;
    metadata?: Record<string, string>;
    autoAdvance?: boolean;
  }): Promise<Invoice> {
    // Create invoice in Stripe
    const stripeInvoice = await this.stripeService.createInvoice({
      customerId: data.customerId || data.userId,
      subscriptionId: data.subscriptionId,
      metadata: data.metadata,
      autoAdvance: data.autoAdvance,
    });

    // Get the subscription to set period dates
    const subscription = await prisma.subscription.findUnique({
      where: { id: data.subscriptionId }
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Create invoice in database
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: data.userId,
        subscriptionId: data.subscriptionId,
        stripeInvoiceId: stripeInvoice.id,
        number: stripeInvoice.number || `INV-${Date.now()}`,
        status: stripeInvoice.status || 'draft',
        currency: stripeInvoice.currency || 'usd',
        subtotal: stripeInvoice.subtotal || 0,
        tax: stripeInvoice.tax || 0,
        total: stripeInvoice.total || 0,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        dueDate: data.dueDate,
      }
    });

    return invoice;
  }

  async updateInvoice(invoiceId: string, userId: string, data: {
    description?: string;
    metadata?: Record<string, string>;
    dueDate?: Date;
  }): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Update in Stripe if needed
    if (invoice.stripeInvoiceId && (data.description || data.metadata)) {
      // Stripe doesn't support updating some invoice fields after creation
      // For now, we'll just update the local invoice
    }

    // Update in database
    return await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        dueDate: data.dueDate,
      }
    });
  }

  async finalizeInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Finalize in Stripe
    if (invoice.stripeInvoiceId) {
      await this.stripeService.finalizeInvoice(invoice.stripeInvoiceId);
    }

    // Update status in database
    return await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'open',
      }
    });
  }

  async payInvoice(invoiceId: string, userId: string, options: {
    paymentMethodId?: string;
    offSession?: boolean;
  }): Promise<any> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Pay in Stripe
    if (invoice.stripeInvoiceId) {
      const payment = await this.stripeService.payInvoice(invoice.stripeInvoiceId);

      // Update invoice status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        }
      });

      return payment;
    }

    throw new Error("Cannot pay invoice without Stripe invoice ID");
  }

  async voidInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Void in Stripe
    if (invoice.stripeInvoiceId) {
      await this.stripeService.voidInvoice(invoice.stripeInvoiceId);
    }

    // Update status in database
    return await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'void',
      }
    });
  }

  async markInvoiceUncollectible(invoiceId: string, userId: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Mark uncollectible in Stripe
    if (invoice.stripeInvoiceId) {
      // Stripe doesn't have a direct API to mark invoice uncollectible
      // This would typically be done through the Stripe dashboard
    }

    // Update status in database
    return await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'uncollectible',
      }
    });
  }

  async sendInvoice(invoiceId: string, userId: string): Promise<void> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Send via Stripe
    if (invoice.stripeInvoiceId) {
      await this.stripeService.sendInvoice(invoice.stripeInvoiceId);
    }
  }

  async getInvoicePdf(invoiceId: string, userId: string): Promise<Buffer> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: userId
      }
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Get PDF from Stripe or generate
    if (invoice.stripeInvoiceId) {
      // Get invoice from Stripe and use its PDF URL
      const stripeInvoice = await this.stripeService.getInvoice(invoice.stripeInvoiceId);
      if (stripeInvoice?.invoice_pdf) {
        // In a real implementation, you would fetch the PDF from the URL
        return Buffer.from('PDF would be fetched from: ' + stripeInvoice.invoice_pdf);
      }
      return Buffer.from('PDF not available');
    }

    // For now, return empty buffer
    return Buffer.from('PDF not available');
  }

  async getInvoiceStats(userId: string, period: string): Promise<any> {
    const startDate = new Date();
    if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: userId,
        createdAt: { gte: startDate }
      }
    });

    const stats = {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'paid').length,
      open: invoices.filter(i => i.status === 'open').length,
      void: invoices.filter(i => i.status === 'void').length,
      uncollectible: invoices.filter(i => i.status === 'uncollectible').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.total.toNumber(), 0),
      paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total.toNumber(), 0),
    };

    return stats;
  }

  // Payment methods
  async createPayment(data: {
    userId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    description?: string;
    metadata?: Record<string, string>;
    receiptEmail?: string;
  }): Promise<any> {
    // Create payment intent in Stripe
    const payment = await this.stripeService.createPayment({
      amount: data.amount,
      currency: data.currency,
      paymentMethodId: data.paymentMethodId,
      customerId: data.userId,
      description: data.description,
      metadata: data.metadata,
      receiptEmail: data.receiptEmail,
    });

    return payment;
  }

  async getUserPayments(userId: string, options: any = {}): Promise<any[]> {
    // Get payments from Stripe
    // For now, return empty array as Stripe doesn't have a direct customer payments endpoint
    // In practice, you would use payment_intents.list with customer filter
    const payments: any[] = [];
    return payments;
  }

  async getPayment(paymentId: string, userId: string): Promise<any> {
    // Get payment from Stripe
    const payment = await this.stripeService.getPayment(paymentId);
    
    // Verify it belongs to the user
    if (payment && payment.customer !== userId) {
      throw new Error("Payment not found");
    }

    return payment;
  }

  async refundPayment(paymentId: string, userId: string, data: {
    amount?: number;
    reason?: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    // Get payment first to verify ownership
    const payment = await this.getPayment(paymentId, userId);

    // Create refund
    const refund = await this.stripeService.refundPayment(paymentId, {
      amount: data.amount,
      reason: data.reason as Stripe.RefundCreateParams.Reason,
      metadata: data.metadata,
    });

    return refund;
  }

  async getPaymentStats(userId: string, period: string): Promise<any> {
    // Get payment stats from Stripe
    // For now, return mock stats as Stripe doesn't have a direct stats endpoint
    const stats = {
      totalPayments: 0,
      totalAmount: 0,
      averageAmount: 0,
      period
    };
    
    return stats;
  }

  // Plan management methods
  async archivePlan(planId: string, userId: string): Promise<Plan> {
    // Archive plan by setting isPublic to false
    const plan = await prisma.plan.update({
      where: { id: planId },
      data: { isPublic: false }
    });

    return plan;
  }

  async comparePlans(planIds: string[]): Promise<any> {
    const plans = await Promise.all(
      planIds.map(id => this.planRepository.getPlanWithDetails(id))
    );

    return {
      plans: plans.filter(p => p.plan !== null),
      comparison: {
        features: this.compareFeatures(plans),
        pricing: this.comparePricing(plans),
        limits: this.compareLimits(plans),
      }
    };
  }

  private compareFeatures(plans: any[]): any {
    const allFeatures = new Set<string>();
    plans.forEach(p => {
      if (p.features) {
        p.features.forEach((f: any) => allFeatures.add(f.name));
      }
    });

    const comparison: Record<string, any> = {};
    allFeatures.forEach(featureName => {
      comparison[featureName] = plans.map(p => {
        const feature = p.features?.find((f: any) => f.name === featureName);
        return feature ? feature.value : false;
      });
    });

    return comparison;
  }

  private comparePricing(plans: any[]): any {
    return plans.map(p => ({
      planId: p.plan?.id,
      monthly: p.plan?.priceMonthly,
      yearly: p.plan?.priceYearly,
      savings: p.plan?.priceMonthly && p.plan?.priceYearly ? 
        (p.plan.priceMonthly.toNumber() * 12 - p.plan.priceYearly.toNumber()) : 0
    }));
  }

  private compareLimits(plans: any[]): any {
    const allLimits = new Set<string>();
    plans.forEach(p => {
      if (p.limits) {
        p.limits.forEach((l: any) => allLimits.add(l.resourceType));
      }
    });

    const comparison: Record<string, any> = {};
    allLimits.forEach(resourceType => {
      comparison[resourceType] = plans.map(p => {
        const limit = p.limits?.find((l: any) => l.resourceType === resourceType);
        return limit ? limit.maxValue : 'Unlimited';
      });
    });

    return comparison;
  }

  async getPlanPricing(planId: string): Promise<any> {
    const plan = await this.planRepository.getById(planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    return {
      monthly: {
        price: plan.priceMonthly,
        currency: plan.currency,
      },
      yearly: {
        price: plan.priceYearly,
        currency: plan.currency,
        savings: plan.priceMonthly && plan.priceYearly ? 
          (plan.priceMonthly.toNumber() * 12 - plan.priceYearly.toNumber()) : 0,
        savingsPercent: plan.priceMonthly && plan.priceYearly ? 
          Math.round((1 - plan.priceYearly.toNumber() / (plan.priceMonthly.toNumber() * 12)) * 100) : 0,
      }
    };
  }

  async getPlanStats(planId: string): Promise<any> {
    const subscriptions = await prisma.subscription.findMany({
      where: { planId }
    });

    const stats = {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
      trialSubscriptions: subscriptions.filter(s => s.status === 'trialing').length,
      canceledSubscriptions: subscriptions.filter(s => s.status === 'canceled').length,
      monthlyRevenue: subscriptions
        .filter(s => s.status === 'active' && s.billingCycle === 'monthly')
        .length * (await this.planRepository.getById(planId))!.priceMonthly!.toNumber(),
      yearlyRevenue: subscriptions
        .filter(s => s.status === 'active' && s.billingCycle === 'yearly')
        .length * (await this.planRepository.getById(planId))!.priceYearly!.toNumber(),
    };

    return stats;
  }

  async getRecommendedPlan(userId: string, criteria: {
    usage?: any;
    features?: string[];
  }): Promise<any> {
    const plans = await this.planRepository.getPublicPlans();
    const userUsage = criteria.usage || await this.usageService.getCurrentPeriodUsage(userId);

    // Simple recommendation logic
    let recommendedPlan = plans[0];
    for (const plan of plans) {
      const limits = await this.planRepository.getPlanLimits(plan.id);
      let meetsRequirements = true;

      // Check if plan meets usage requirements
      for (const limit of limits) {
        const usage = userUsage.limits?.find((u: any) => u.eventType === limit.resourceType);
        if (usage && usage.currentUsage > limit.maxValue) {
          meetsRequirements = false;
          break;
        }
      }

      if (meetsRequirements) {
        recommendedPlan = plan;
        break;
      }
    }

    return {
      recommendedPlan,
      reason: "Based on your current usage patterns",
      alternatives: recommendedPlan ? plans.filter(p => p.id !== recommendedPlan.id).slice(0, 2) : [],
    };
  }
}