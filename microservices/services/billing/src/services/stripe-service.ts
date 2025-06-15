import Stripe from "stripe";
import { EventEmitter } from "events";

export class StripeService extends EventEmitter {
  private stripe: Stripe;

  constructor() {
    super();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
      typescript: true,
    });
  }

  // Customer Management
  async createCustomer(data: {
    email?: string;
    name?: string;
    phone?: string;
    address?: Stripe.AddressParam;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        metadata: data.metadata,
      });

      this.emit("customer.created", { customer });
      return customer;
    } catch (error) {
      this.emit("error", { error, operation: "createCustomer" });
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      return customer.deleted ? null : (customer as Stripe.Customer);
    } catch (error) {
      if ((error as any).code === "resource_missing") {
        return null;
      }
      throw error;
    }
  }

  async updateCustomer(
    customerId: string,
    data: {
      email?: string;
      name?: string;
      phone?: string;
      address?: Stripe.AddressParam;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        metadata: data.metadata,
      });

      this.emit("customer.updated", { customer });
      return customer;
    } catch (error) {
      this.emit("error", { error, operation: "updateCustomer" });
      throw error;
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.stripe.customers.del(customerId);
      this.emit("customer.deleted", { customerId });
    } catch (error) {
      this.emit("error", { error, operation: "deleteCustomer" });
      throw error;
    }
  }

  // Subscription Management
  async createSubscription(data: {
    customerId: string;
    priceId: string;
    paymentMethodId?: string;
    trialPeriodDays?: number;
    couponCode?: string;
    metadata?: Record<string, string>;
    prorationBehavior?: Stripe.SubscriptionCreateParams.ProrationBehavior;
  }): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [{ price: data.priceId }],
        metadata: data.metadata,
        proration_behavior: data.prorationBehavior,
      };

      if (data.paymentMethodId) {
        subscriptionData.default_payment_method = data.paymentMethodId;
      }

      if (data.trialPeriodDays) {
        subscriptionData.trial_period_days = data.trialPeriodDays;
      }

      if (data.couponCode) {
        subscriptionData.coupon = data.couponCode;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      this.emit("subscription.created", { subscription });
      return subscription;
    } catch (error) {
      this.emit("error", { error, operation: "createSubscription" });
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      if ((error as any).code === "resource_missing") {
        return null;
      }
      throw error;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: {
      priceId?: string;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
      prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
    }
  ): Promise<Stripe.Subscription> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {
        metadata: data.metadata,
        proration_behavior: data.prorationBehavior,
      };

      if (data.priceId) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        updateData.items = [
          {
            id: subscription.items.data[0]!.id,
            price: data.priceId,
          },
        ];
      }

      if (data.paymentMethodId) {
        updateData.default_payment_method = data.paymentMethodId;
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateData);

      this.emit("subscription.updated", { subscription });
      return subscription;
    } catch (error) {
      this.emit("error", { error, operation: "updateSubscription" });
      throw error;
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    options: {
      cancelAtPeriodEnd?: boolean;
      cancellationDetails?: {
        comment?: string;
        feedback?: string;
      };
    } = {}
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (options.cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      }

      this.emit("subscription.canceled", { subscription });
      return subscription;
    } catch (error) {
      this.emit("error", { error, operation: "cancelSubscription" });
      throw error;
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      this.emit("subscription.reactivated", { subscription });
      return subscription;
    } catch (error) {
      this.emit("error", { error, operation: "reactivateSubscription" });
      throw error;
    }
  }

  async previewSubscriptionChange(
    subscriptionId: string,
    _data: {
      priceId?: string;
      prorationBehavior?: string;
    }
  ): Promise<Stripe.Invoice> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const invoiceData: Stripe.InvoiceCreateParams = {
        customer: subscription.customer as string,
        subscription: subscriptionId,
      };

      const invoice = await this.stripe.invoices.create(invoiceData);
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "previewSubscriptionChange" });
      throw error;
    }
  }

  // Payment Management
  async createPayment(data: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    customerId?: string;
    description?: string;
    metadata?: Record<string, string>;
    receiptEmail?: string;
    confirmationMethod?: "automatic" | "manual";
  }): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency,
        payment_method: data.paymentMethodId,
        customer: data.customerId,
        description: data.description,
        metadata: data.metadata,
        receipt_email: data.receiptEmail,
        confirmation_method: data.confirmationMethod || "automatic",
        confirm: true,
        return_url: process.env.STRIPE_RETURN_URL,
      });

      this.emit("payment.created", { paymentIntent });
      return paymentIntent;
    } catch (error) {
      this.emit("error", { error, operation: "createPayment" });
      throw error;
    }
  }

  async getPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      if ((error as any).code === "resource_missing") {
        return null;
      }
      throw error;
    }
  }

  async confirmPayment(
    paymentIntentId: string,
    data: {
      paymentMethodId?: string;
      returnUrl?: string;
    } = {}
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: data.paymentMethodId,
        return_url: data.returnUrl || process.env.STRIPE_RETURN_URL,
      });

      this.emit("payment.confirmed", { paymentIntent });
      return paymentIntent;
    } catch (error) {
      this.emit("error", { error, operation: "confirmPayment" });
      throw error;
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      this.emit("payment.canceled", { paymentIntent });
      return paymentIntent;
    } catch (error) {
      this.emit("error", { error, operation: "cancelPayment" });
      throw error;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    data: {
      amount?: number;
      reason?: Stripe.RefundCreateParams.Reason;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: data.amount ? Math.round(data.amount * 100) : undefined,
        reason: data.reason,
        metadata: data.metadata,
      });

      this.emit("payment.refunded", { refund });
      return refund;
    } catch (error) {
      this.emit("error", { error, operation: "refundPayment" });
      throw error;
    }
  }

  // Payment Method Management
  async createPaymentMethod(data: {
    customerId: string;
    type: string;
    card?: any;
    bankAccount?: any;
    billingDetails?: Stripe.PaymentMethodCreateParams.BillingDetails;
  }): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethodData: Stripe.PaymentMethodCreateParams = {
        type: data.type as Stripe.PaymentMethodCreateParams.Type,
        billing_details: data.billingDetails,
      };

      if (data.card) {
        paymentMethodData.card = data.card;
      }

      const paymentMethod = await this.stripe.paymentMethods.create(paymentMethodData);

      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: data.customerId,
      });

      this.emit("payment_method.created", { paymentMethod });
      return paymentMethod;
    } catch (error) {
      this.emit("error", { error, operation: "createPaymentMethod" });
      throw error;
    }
  }

  async getCustomerPaymentMethods(
    customerId: string,
    options: { type?: string } = {}
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: options.type as Stripe.PaymentMethodListParams.Type,
      });

      return paymentMethods.data;
    } catch (error) {
      this.emit("error", { error, operation: "getCustomerPaymentMethods" });
      throw error;
    }
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    data: {
      billingDetails?: Stripe.PaymentMethodUpdateParams.BillingDetails;
      isDefault?: boolean;
    }
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.update(paymentMethodId, {
        billing_details: data.billingDetails,
      });

      this.emit("payment_method.updated", { paymentMethod });
      return paymentMethod;
    } catch (error) {
      this.emit("error", { error, operation: "updatePaymentMethod" });
      throw error;
    }
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      this.emit("payment_method.deleted", { paymentMethodId });
    } catch (error) {
      this.emit("error", { error, operation: "deletePaymentMethod" });
      throw error;
    }
  }

  // Invoice Management
  async createInvoice(data: {
    customerId: string;
    subscriptionId?: string;
    items?: Array<{
      price?: string;
      quantity?: number;
      description?: string;
      amount?: number;
    }>;
    dueDate?: Date;
    metadata?: Record<string, string>;
    autoAdvance?: boolean;
  }): Promise<Stripe.Invoice> {
    try {
      const invoiceData: Stripe.InvoiceCreateParams = {
        customer: data.customerId,
        subscription: data.subscriptionId,
        metadata: data.metadata,
        auto_advance: data.autoAdvance,
      };

      if (data.dueDate) {
        invoiceData.due_date = Math.floor(data.dueDate.getTime() / 1000);
      }

      const invoice = await this.stripe.invoices.create(invoiceData);

      // Add invoice items if provided
      if (data.items) {
        for (const item of data.items) {
          await this.stripe.invoiceItems.create({
            customer: data.customerId,
            invoice: invoice.id,
            price: item.price,
            quantity: item.quantity,
            description: item.description,
            amount: item.amount ? Math.round(item.amount * 100) : undefined,
          });
        }
      }

      this.emit("invoice.created", { invoice });
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "createInvoice" });
      throw error;
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice | null> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (error) {
      if ((error as any).code === "resource_missing") {
        return null;
      }
      throw error;
    }
  }

  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.finalizeInvoice(invoiceId);
      this.emit("invoice.finalized", { invoice });
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "finalizeInvoice" });
      throw error;
    }
  }

  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.pay(invoiceId);
      this.emit("invoice.paid", { invoice });
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "payInvoice" });
      throw error;
    }
  }

  async voidInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.voidInvoice(invoiceId);
      this.emit("invoice.voided", { invoice });
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "voidInvoice" });
      throw error;
    }
  }

  async sendInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.sendInvoice(invoiceId);
      this.emit("invoice.sent", { invoice });
      return invoice;
    } catch (error) {
      this.emit("error", { error, operation: "sendInvoice" });
      throw error;
    }
  }

  // Product and Price Management
  async createProduct(data: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
    active?: boolean;
  }): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create({
        name: data.name,
        description: data.description,
        metadata: data.metadata,
        active: data.active,
      });

      this.emit("product.created", { product });
      return product;
    } catch (error) {
      this.emit("error", { error, operation: "createProduct" });
      throw error;
    }
  }

  async createPrice(data: {
    productId: string;
    unitAmount: number;
    currency: string;
    recurring?: {
      interval: "day" | "week" | "month" | "year";
      intervalCount?: number;
    };
    metadata?: Record<string, string>;
    active?: boolean;
  }): Promise<Stripe.Price> {
    try {
      const priceData: Stripe.PriceCreateParams = {
        product: data.productId,
        unit_amount: Math.round(data.unitAmount * 100),
        currency: data.currency,
        metadata: data.metadata,
        active: data.active,
      };

      if (data.recurring) {
        priceData.recurring = {
          interval: data.recurring.interval,
          interval_count: data.recurring.intervalCount,
        };
      }

      const price = await this.stripe.prices.create(priceData);

      this.emit("price.created", { price });
      return price;
    } catch (error) {
      this.emit("error", { error, operation: "createPrice" });
      throw error;
    }
  }

  // Webhook Management
  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    endpointSecret: string
  ): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      this.emit("webhook.received", { event });
      return event;
    } catch (error) {
      this.emit("error", { error, operation: "constructWebhookEvent" });
      throw error;
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case "customer.created":
        case "customer.updated":
        case "customer.deleted":
          this.emit(`stripe.${event.type}`, { data: event.data.object });
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
        case "customer.subscription.trial_will_end":
          this.emit(`stripe.${event.type}`, { data: event.data.object });
          break;

        case "payment_intent.succeeded":
        case "payment_intent.payment_failed":
        case "payment_intent.canceled":
          this.emit(`stripe.${event.type}`, { data: event.data.object });
          break;

        case "invoice.created":
        case "invoice.finalized":
        case "invoice.paid":
        case "invoice.payment_failed":
          this.emit(`stripe.${event.type}`, { data: event.data.object });
          break;

        case "payment_method.attached":
        case "payment_method.detached":
          this.emit(`stripe.${event.type}`, { data: event.data.object });
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.emit("error", { error, operation: "handleWebhookEvent", eventType: event.type });
      throw error;
    }
  }

  // Utility Methods
  async getBalance(): Promise<Stripe.Balance> {
    try {
      return await this.stripe.balance.retrieve();
    } catch (error) {
      this.emit("error", { error, operation: "getBalance" });
      throw error;
    }
  }

  async getBalanceTransactions(
    options: {
      limit?: number;
      startingAfter?: string;
      endingBefore?: string;
    } = {}
  ): Promise<Stripe.BalanceTransaction[]> {
    try {
      const transactions = await this.stripe.balanceTransactions.list(options);
      return transactions.data;
    } catch (error) {
      this.emit("error", { error, operation: "getBalanceTransactions" });
      throw error;
    }
  }

  async createSetupIntent(data: {
    customerId: string;
    paymentMethodTypes?: string[];
    usage?: "off_session" | "on_session";
    metadata?: Record<string, string>;
  }): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: data.customerId,
        payment_method_types: data.paymentMethodTypes || ["card"],
        usage: data.usage || "off_session",
        metadata: data.metadata,
      });

      this.emit("setup_intent.created", { setupIntent });
      return setupIntent;
    } catch (error) {
      this.emit("error", { error, operation: "createSetupIntent" });
      throw error;
    }
  }

  async createPortalSession(data: {
    customerId: string;
    returnUrl: string;
    configuration?: string;
  }): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: data.customerId,
        return_url: data.returnUrl,
        configuration: data.configuration,
      });

      this.emit("portal_session.created", { session });
      return session;
    } catch (error) {
      this.emit("error", { error, operation: "createPortalSession" });
      throw error;
    }
  }
}
