import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("BillingService", () => {
  // Mock data
  const mockSubscription = {
    id: "sub-123",
    organizationId: "org-123",
    planId: "plan-123",
    status: "active",
    currentPeriodStart: new Date("2024-01-01"),
    currentPeriodEnd: new Date("2024-02-01"),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: "sub_stripe_123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockPlan = {
    id: "plan-123",
    name: "Standard Plan",
    price: 2999, // $29.99 in cents
    currency: "USD",
    interval: "month",
    features: ["feature1", "feature2"],
    isActive: true,
    stripePriceId: "price_stripe_123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockInvoice = {
    id: "inv-123",
    subscriptionId: "sub-123",
    amount: 2999,
    currency: "USD",
    status: "paid",
    stripeInvoiceId: "in_stripe_123",
    paidAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
  };

  // Mock dependencies
  const mockPrisma = {
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    usage: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockStripeService = {
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    createPaymentMethod: jest.fn(),
    retrieveInvoice: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  // Mock BillingService class
  class BillingService {
    constructor(
      private prisma = mockPrisma,
      private stripeService = mockStripeService,
      private eventPublisher = mockEventPublisher
    ) {}

    async createSubscription(subscriptionData: {
      organizationId: string;
      planId: string;
      paymentMethodId: string;
    }) {
      if (!subscriptionData.organizationId) {
        throw new Error("Organization ID is required");
      }

      if (!subscriptionData.planId) {
        throw new Error("Plan ID is required");
      }

      if (!subscriptionData.paymentMethodId) {
        throw new Error("Payment method ID is required");
      }

      // Validate plan exists
      const plan = (await this.prisma.plan.findUnique({
        where: { id: subscriptionData.planId },
      })) as any;

      if (!plan) {
        throw new Error("Plan not found");
      }

      if (!plan.isActive) {
        throw new Error("Plan is not active");
      }

      // Create Stripe subscription
      const stripeSubscription = (await this.stripeService.createSubscription({
        priceId: plan.stripePriceId,
        paymentMethodId: subscriptionData.paymentMethodId,
      })) as any;

      // Create local subscription record
      const subscription = (await this.prisma.subscription.create({
        data: {
          organizationId: subscriptionData.organizationId,
          planId: subscriptionData.planId,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          stripeSubscriptionId: stripeSubscription.id,
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("subscription.created", {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        planId: subscription.planId,
      });

      return subscription;
    }

    async getSubscriptionById(id: string) {
      if (!id) {
        throw new Error("Subscription ID is required");
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { id },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      return subscription;
    }

    async getSubscriptionByOrganization(organizationId: string) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { organizationId },
        include: {
          plan: true,
        },
      });

      return subscription;
    }

    async updateSubscription(
      id: string,
      updateData: {
        planId?: string;
        cancelAtPeriodEnd?: boolean;
      }
    ) {
      if (!id) {
        throw new Error("Subscription ID is required");
      }

      const existingSubscription = (await this.prisma.subscription.findUnique({
        where: { id },
      })) as any;

      if (!existingSubscription) {
        throw new Error("Subscription not found");
      }

      let stripeUpdateData: any = {};

      // Handle plan change
      if (updateData.planId) {
        const newPlan = (await this.prisma.plan.findUnique({
          where: { id: updateData.planId },
        })) as any;

        if (!newPlan) {
          throw new Error("New plan not found");
        }

        stripeUpdateData.items = [
          {
            id: existingSubscription.stripeSubscriptionId,
            price: newPlan.stripePriceId,
          },
        ];
      }

      // Handle cancellation
      if (updateData.cancelAtPeriodEnd !== undefined) {
        stripeUpdateData.cancel_at_period_end = updateData.cancelAtPeriodEnd;
      }

      // Update Stripe subscription
      const stripeSubscription = (await this.stripeService.updateSubscription(
        existingSubscription.stripeSubscriptionId,
        stripeUpdateData
      )) as any;

      // Update local subscription
      const subscription = (await this.prisma.subscription.update({
        where: { id },
        data: {
          planId: updateData.planId || existingSubscription.planId,
          cancelAtPeriodEnd: updateData.cancelAtPeriodEnd ?? existingSubscription.cancelAtPeriodEnd,
          status: stripeSubscription.status,
          updatedAt: new Date(),
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("subscription.updated", {
        subscriptionId: subscription.id,
        changes: updateData,
      });

      return subscription;
    }

    async cancelSubscription(id: string, immediately = false) {
      if (!id) {
        throw new Error("Subscription ID is required");
      }

      const subscription = (await this.prisma.subscription.findUnique({
        where: { id },
      })) as any;

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (subscription.status === "canceled") {
        throw new Error("Subscription is already canceled");
      }

      // Cancel Stripe subscription
      const stripeSubscription = (await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        immediately
      )) as any;

      // Update local subscription
      const updatedSubscription = (await this.prisma.subscription.update({
        where: { id },
        data: {
          status: stripeSubscription.status,
          cancelAtPeriodEnd: !immediately,
          updatedAt: new Date(),
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("subscription.canceled", {
        subscriptionId: updatedSubscription.id,
        immediately,
      });

      return updatedSubscription;
    }

    async getPlans(isActive = true) {
      const plans = await this.prisma.plan.findMany({
        where: isActive ? { isActive: true } : {},
        orderBy: { price: "asc" },
      });

      return plans;
    }

    async recordUsage(
      subscriptionId: string,
      usageData: {
        metricName: string;
        quantity: number;
        timestamp?: Date;
      }
    ) {
      if (!subscriptionId) {
        throw new Error("Subscription ID is required");
      }

      if (!usageData.metricName) {
        throw new Error("Metric name is required");
      }

      if (typeof usageData.quantity !== "number" || usageData.quantity < 0) {
        throw new Error("Quantity must be a non-negative number");
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const usage = await this.prisma.usage.create({
        data: {
          subscriptionId,
          metricName: usageData.metricName,
          quantity: usageData.quantity,
          timestamp: usageData.timestamp || new Date(),
        },
      });

      return usage;
    }

    async getUsageStats(
      subscriptionId: string,
      period: {
        startDate: Date;
        endDate: Date;
      }
    ) {
      if (!subscriptionId) {
        throw new Error("Subscription ID is required");
      }

      const { startDate, endDate } = period;

      const usage = (await this.prisma.usage.findMany({
        where: {
          subscriptionId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: "desc" },
      })) as any;

      // Aggregate by metric
      const aggregated = usage.reduce((acc: Record<string, number>, record: any) => {
        acc[record.metricName] = (acc[record.metricName] || 0) + record.quantity;
        return acc;
      }, {});

      return {
        period: { startDate, endDate },
        totalRecords: usage.length,
        metrics: aggregated,
      };
    }

    async getInvoices(subscriptionId: string) {
      if (!subscriptionId) {
        throw new Error("Subscription ID is required");
      }

      const invoices = await this.prisma.invoice.findMany({
        where: { subscriptionId },
        orderBy: { createdAt: "desc" },
      });

      return invoices;
    }

    async processWebhook(event: { type: string; data: any }) {
      switch (event.type) {
        case "invoice.payment_succeeded":
          return this.handleInvoicePaymentSucceeded(event.data);
        case "invoice.payment_failed":
          return this.handleInvoicePaymentFailed(event.data);
        case "customer.subscription.updated":
          return this.handleSubscriptionUpdated(event.data);
        case "customer.subscription.deleted":
          return this.handleSubscriptionDeleted(event.data);
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          return { processed: false };
      }
    }

    private async handleInvoicePaymentSucceeded(invoiceData: any) {
      // Create or update invoice record
      const invoice = (await this.prisma.invoice.create({
        data: {
          subscriptionId: invoiceData.subscription,
          amount: invoiceData.amount_paid,
          currency: invoiceData.currency,
          status: "paid",
          stripeInvoiceId: invoiceData.id,
          paidAt: new Date(invoiceData.status_transitions.paid_at * 1000),
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("invoice.payment_succeeded", {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        amount: invoice.amount,
      });

      return { processed: true, invoiceId: invoice.id };
    }

    private async handleInvoicePaymentFailed(invoiceData: any) {
      // Publish event
      await this.eventPublisher.publish("invoice.payment_failed", {
        stripeInvoiceId: invoiceData.id,
        subscriptionId: invoiceData.subscription,
        amount: invoiceData.amount_due,
      });

      return { processed: true };
    }

    private async handleSubscriptionUpdated(subscriptionData: any) {
      // Update local subscription record
      const subscription = (await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionData.id },
        data: {
          status: subscriptionData.status,
          currentPeriodStart: new Date(subscriptionData.current_period_start * 1000),
          currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
          updatedAt: new Date(),
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("subscription.updated", {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      return { processed: true, subscriptionId: subscription.id };
    }

    private async handleSubscriptionDeleted(subscriptionData: any) {
      // Update local subscription record
      const subscription = (await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionData.id },
        data: {
          status: "canceled",
          updatedAt: new Date(),
        },
      })) as any;

      // Publish event
      await this.eventPublisher.publish("subscription.canceled", {
        subscriptionId: subscription.id,
        immediately: true,
      });

      return { processed: true, subscriptionId: subscription.id };
    }
  }

  let billingService: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    billingService = new BillingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createSubscription", () => {
    const validSubscriptionData = {
      organizationId: "org-123",
      planId: "plan-123",
      paymentMethodId: "pm_123",
    };

    it("should create subscription successfully", async () => {
      const stripeSubscription = {
        id: "sub_stripe_123",
        status: "active",
        current_period_start: 1704067200, // 2024-01-01
        current_period_end: 1706745600, // 2024-02-01
      };

      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan as never);
      mockStripeService.createSubscription.mockResolvedValue(stripeSubscription as never);
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.createSubscription(validSubscriptionData);

      expect(result).toEqual(mockSubscription);
      expect(mockStripeService.createSubscription).toHaveBeenCalledWith({
        priceId: mockPlan.stripePriceId,
        paymentMethodId: validSubscriptionData.paymentMethodId,
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("subscription.created", {
        subscriptionId: mockSubscription.id,
        organizationId: mockSubscription.organizationId,
        planId: mockSubscription.planId,
      });
    });

    it("should throw error for missing organization ID", async () => {
      const invalidData = { ...validSubscriptionData, organizationId: "" };

      await expect(billingService.createSubscription(invalidData)).rejects.toThrow(
        "Organization ID is required"
      );
    });

    it("should throw error for missing plan ID", async () => {
      const invalidData = { ...validSubscriptionData, planId: "" };

      await expect(billingService.createSubscription(invalidData)).rejects.toThrow(
        "Plan ID is required"
      );
    });

    it("should throw error for missing payment method ID", async () => {
      const invalidData = { ...validSubscriptionData, paymentMethodId: "" };

      await expect(billingService.createSubscription(invalidData)).rejects.toThrow(
        "Payment method ID is required"
      );
    });

    it("should throw error for non-existent plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null as never);

      await expect(billingService.createSubscription(validSubscriptionData)).rejects.toThrow(
        "Plan not found"
      );
    });

    it("should throw error for inactive plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ ...mockPlan, isActive: false } as never);

      await expect(billingService.createSubscription(validSubscriptionData)).rejects.toThrow(
        "Plan is not active"
      );
    });
  });

  describe("getSubscriptionById", () => {
    it("should return subscription by ID successfully", async () => {
      const subscriptionWithPlan = { ...mockSubscription, plan: mockPlan };
      mockPrisma.subscription.findUnique.mockResolvedValue(subscriptionWithPlan as never);

      const result = await billingService.getSubscriptionById("sub-123");

      expect(result).toEqual(subscriptionWithPlan);
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: "sub-123" },
        include: { plan: true },
      });
    });

    it("should throw error for missing subscription ID", async () => {
      await expect(billingService.getSubscriptionById("")).rejects.toThrow(
        "Subscription ID is required"
      );
    });

    it("should throw error for non-existent subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null as never);

      await expect(billingService.getSubscriptionById("non-existent")).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("updateSubscription", () => {
    const updateData = {
      planId: "plan-456",
      cancelAtPeriodEnd: true,
    };

    it("should update subscription successfully", async () => {
      const newPlan = { ...mockPlan, id: "plan-456", stripePriceId: "price_456" };
      const stripeSubscription = { status: "active" };
      const updatedSubscription = { ...mockSubscription, ...updateData };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as never);
      mockPrisma.plan.findUnique.mockResolvedValue(newPlan as never);
      mockStripeService.updateSubscription.mockResolvedValue(stripeSubscription as never);
      mockPrisma.subscription.update.mockResolvedValue(updatedSubscription as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.updateSubscription("sub-123", updateData);

      expect(result).toEqual(updatedSubscription);
      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        {
          items: [
            {
              id: mockSubscription.stripeSubscriptionId,
              price: newPlan.stripePriceId,
            },
          ],
          cancel_at_period_end: true,
        }
      );
    });

    it("should throw error for missing subscription ID", async () => {
      await expect(billingService.updateSubscription("", updateData)).rejects.toThrow(
        "Subscription ID is required"
      );
    });

    it("should throw error for non-existent subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null as never);

      await expect(billingService.updateSubscription("non-existent", updateData)).rejects.toThrow(
        "Subscription not found"
      );
    });

    it("should throw error for non-existent new plan", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as never);
      mockPrisma.plan.findUnique.mockResolvedValue(null as never);

      await expect(
        billingService.updateSubscription("sub-123", { planId: "non-existent" })
      ).rejects.toThrow("New plan not found");
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription at period end", async () => {
      const stripeSubscription = { status: "active" };
      const canceledSubscription = { ...mockSubscription, cancelAtPeriodEnd: true };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as never);
      mockStripeService.cancelSubscription.mockResolvedValue(stripeSubscription as never);
      mockPrisma.subscription.update.mockResolvedValue(canceledSubscription as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.cancelSubscription("sub-123", false);

      expect(result).toEqual(canceledSubscription);
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        false
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("subscription.canceled", {
        subscriptionId: "sub-123",
        immediately: false,
      });
    });

    it("should cancel subscription immediately", async () => {
      const stripeSubscription = { status: "canceled" };
      const canceledSubscription = {
        ...mockSubscription,
        status: "canceled",
        cancelAtPeriodEnd: false,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as never);
      mockStripeService.cancelSubscription.mockResolvedValue(stripeSubscription as never);
      mockPrisma.subscription.update.mockResolvedValue(canceledSubscription as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.cancelSubscription("sub-123", true);

      expect(result).toEqual(canceledSubscription);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith("subscription.canceled", {
        subscriptionId: "sub-123",
        immediately: true,
      });
    });

    it("should throw error for already canceled subscription", async () => {
      const canceledSubscription = { ...mockSubscription, status: "canceled" };
      mockPrisma.subscription.findUnique.mockResolvedValue(canceledSubscription as never);

      await expect(billingService.cancelSubscription("sub-123")).rejects.toThrow(
        "Subscription is already canceled"
      );
    });
  });

  describe("recordUsage", () => {
    const validUsageData = {
      metricName: "notifications_sent",
      quantity: 100,
    };

    it("should record usage successfully", async () => {
      const mockUsage = {
        id: "usage-123",
        subscriptionId: "sub-123",
        metricName: "notifications_sent",
        quantity: 100,
        timestamp: new Date(),
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as never);
      mockPrisma.usage.create.mockResolvedValue(mockUsage as never);

      const result = await billingService.recordUsage("sub-123", validUsageData);

      expect(result).toEqual(mockUsage);
      expect(mockPrisma.usage.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: "sub-123",
          metricName: validUsageData.metricName,
          quantity: validUsageData.quantity,
          timestamp: expect.any(Date),
        },
      });
    });

    it("should throw error for missing subscription ID", async () => {
      await expect(billingService.recordUsage("", validUsageData)).rejects.toThrow(
        "Subscription ID is required"
      );
    });

    it("should throw error for missing metric name", async () => {
      const invalidData = { ...validUsageData, metricName: "" };

      await expect(billingService.recordUsage("sub-123", invalidData)).rejects.toThrow(
        "Metric name is required"
      );
    });

    it("should throw error for negative quantity", async () => {
      const invalidData = { ...validUsageData, quantity: -1 };

      await expect(billingService.recordUsage("sub-123", invalidData)).rejects.toThrow(
        "Quantity must be a non-negative number"
      );
    });

    it("should throw error for non-existent subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null as never);

      await expect(billingService.recordUsage("non-existent", validUsageData)).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("getUsageStats", () => {
    const period = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    };

    it("should return usage statistics", async () => {
      const mockUsageRecords = [
        { metricName: "notifications_sent", quantity: 100 },
        { metricName: "notifications_sent", quantity: 50 },
        { metricName: "api_calls", quantity: 200 },
      ];

      mockPrisma.usage.findMany.mockResolvedValue(mockUsageRecords as never);

      const result = await billingService.getUsageStats("sub-123", period);

      expect(result).toEqual({
        period,
        totalRecords: 3,
        metrics: {
          notifications_sent: 150,
          api_calls: 200,
        },
      });
    });

    it("should throw error for missing subscription ID", async () => {
      await expect(billingService.getUsageStats("", period)).rejects.toThrow(
        "Subscription ID is required"
      );
    });
  });

  describe("processWebhook", () => {
    it("should process invoice payment succeeded webhook", async () => {
      const webhookEvent = {
        type: "invoice.payment_succeeded",
        data: {
          id: "in_stripe_123",
          subscription: "sub-123",
          amount_paid: 2999,
          currency: "USD",
          status_transitions: {
            paid_at: 1704067200,
          },
        },
      };

      mockPrisma.invoice.create.mockResolvedValue(mockInvoice as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.processWebhook(webhookEvent);

      expect(result).toEqual({
        processed: true,
        invoiceId: mockInvoice.id,
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith("invoice.payment_succeeded", {
        invoiceId: mockInvoice.id,
        subscriptionId: mockInvoice.subscriptionId,
        amount: mockInvoice.amount,
      });
    });

    it("should process subscription updated webhook", async () => {
      const webhookEvent = {
        type: "customer.subscription.updated",
        data: {
          id: "sub_stripe_123",
          status: "active",
          current_period_start: 1704067200,
          current_period_end: 1706745600,
          cancel_at_period_end: false,
        },
      };

      const updatedSubscription = { ...mockSubscription, status: "active" };
      mockPrisma.subscription.update.mockResolvedValue(updatedSubscription as never);
      mockEventPublisher.publish.mockResolvedValue(true as never);

      const result = await billingService.processWebhook(webhookEvent);

      expect(result).toEqual({
        processed: true,
        subscriptionId: updatedSubscription.id,
      });
    });

    it("should handle unrecognized webhook events", async () => {
      const webhookEvent = {
        type: "unknown.event",
        data: {},
      };

      const result = await billingService.processWebhook(webhookEvent);

      expect(result).toEqual({
        processed: false,
      });
    });
  });
});
