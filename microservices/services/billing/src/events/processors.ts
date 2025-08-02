// Event processor for billing-related events
// Refactored to use extracted types

import { Event, SubscriptionCreatedEvent, SubscriptionUpdatedEvent, PaymentProcessedEvent, UsageRecordedEvent } from './types';

/**
 * Event processor for billing-related events
 */
export class BillingEventProcessor {
  private isRunning: boolean = false;

  constructor() {
    // Initialize processor
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    console.log("Starting billing event processor");
    this.isRunning = true;
  }

  /**
   * Stop processing events
   */
  async stop(): Promise<void> {
    console.log("Stopping billing event processor");
    this.isRunning = false;
  }

  /**
   * Handle incoming events
   */
  async handleEvent(event: Event): Promise<void> {
    console.log("Processing event", {
      type: event.type,
      id: event.id,
      organizationId: event.organizationId,
    });

    try {
      switch (event.type) {
        case "subscription.created":
          await this.handleSubscriptionCreated(event);
          break;
        case "subscription.updated":
          await this.handleSubscriptionUpdated(event);
          break;
        case "payment.processed":
          await this.handlePaymentProcessed(event);
          break;
        case "usage.recorded":
          await this.handleUsageRecorded(event);
          break;
        default:
          console.log("Unhandled event type", { type: (event as Event).type });
      }
    } catch (error: any) {
      console.error("Error processing event", {
        error: error.message,
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Handle subscription created events
   */
  private async handleSubscriptionCreated(event: SubscriptionCreatedEvent): Promise<void> {
    console.log("Processing subscription created event", {
      subscriptionId: event.data.subscriptionId,
      organizationId: event.data.organizationId,
    });

    try {
      // Initialize billing account
      await this.initializeBillingAccount(event.data.organizationId, {
        subscriptionId: event.data.subscriptionId,
        planId: event.data.planId,
        stripeSubscriptionId: event.data.stripeSubscriptionId,
        status: event.data.status,
        currentPeriodStart: event.data.currentPeriodStart,
        currentPeriodEnd: event.data.currentPeriodEnd,
      });

      // Set up usage tracking
      await this.setupUsageTracking(event.data.organizationId, event.data.planId);

      console.log("Subscription created event processed successfully", {
        subscriptionId: event.data.subscriptionId,
      });
    } catch (error: any) {
      console.error("Failed to process subscription created event", {
        error: error.message,
        subscriptionId: event.data.subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Handle subscription updated events
   */
  private async handleSubscriptionUpdated(event: SubscriptionUpdatedEvent): Promise<void> {
    console.log("Processing subscription updated event", {
      subscriptionId: event.data.subscriptionId,
      status: event.data.status,
    });

    try {
      // Update billing account
      await this.updateBillingAccount(event.data.organizationId, {
        subscriptionId: event.data.subscriptionId,
        status: event.data.status,
        currentPeriodStart: event.data.currentPeriodStart,
        currentPeriodEnd: event.data.currentPeriodEnd,
        changes: event.data.changes,
      });

      console.log("Subscription updated event processed successfully", {
        subscriptionId: event.data.subscriptionId,
      });
    } catch (error: any) {
      console.error("Failed to process subscription updated event", {
        error: error.message,
        subscriptionId: event.data.subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Handle payment processed events
   */
  private async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    console.log("Processing payment processed event", {
      paymentId: event.data.paymentId,
      status: event.data.status,
      amount: event.data.amount,
    });

    try {
      // Record payment transaction
      await this.recordPaymentTransaction(event.data.paymentId, {
        subscriptionId: event.data.subscriptionId,
        organizationId: event.data.organizationId,
        amount: event.data.amount,
        currency: event.data.currency,
        status: event.data.status,
        stripePaymentIntentId: event.data.stripePaymentIntentId,
        paymentMethod: event.data.paymentMethod,
        timestamp: event.timestamp,
      });

      console.log("Payment processed event processed successfully", {
        paymentId: event.data.paymentId,
      });
    } catch (error: any) {
      console.error("Failed to process payment processed event", {
        error: error.message,
        paymentId: event.data.paymentId,
      });
      throw error;
    }
  }

  /**
   * Handle usage recorded events
   */
  private async handleUsageRecorded(event: UsageRecordedEvent): Promise<void> {
    console.log("Processing usage recorded event", {
      usageId: event.data.usageId,
      metricType: event.data.metricType,
      quantity: event.data.quantity,
    });

    try {
      // Record usage metrics
      await this.recordUsageMetrics(event.data.usageId, {
        organizationId: event.data.organizationId,
        siteId: event.data.siteId,
        metricType: event.data.metricType,
        quantity: event.data.quantity,
        timestamp: event.data.timestamp,
        billingPeriod: event.data.billingPeriod,
      });

      console.log("Usage recorded event processed successfully", {
        usageId: event.data.usageId,
      });
    } catch (error: any) {
      console.error("Failed to process usage recorded event", {
        error: error.message,
        usageId: event.data.usageId,
      });
      throw error;
    }
  }

  /**
   * Get processor status
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }

  // Helper methods (placeholder implementations)
  private async initializeBillingAccount(organizationId: string, data: any): Promise<void> {
    console.log("Initializing billing account", { organizationId, data });
    // Implementation would create billing account
  }

  private async setupUsageTracking(organizationId: string, planId: string): Promise<void> {
    console.log("Setting up usage tracking", { organizationId, planId });
    // Implementation would configure usage tracking
  }

  private async updateBillingAccount(organizationId: string, data: any): Promise<void> {
    console.log("Updating billing account", { organizationId, data });
    // Implementation would update billing account
  }

  private async recordPaymentTransaction(paymentId: string, data: any): Promise<void> {
    console.log("Recording payment transaction", { paymentId, data });
    // Implementation would record payment transaction
  }

  private async recordUsageMetrics(usageId: string, data: any): Promise<void> {
    console.log("Recording usage metrics", { usageId, data });
    // Implementation would record usage metrics
  }
}

/**
 * Factory function to create and configure billing event processor
 */
export function createBillingEventProcessor(): BillingEventProcessor {
  return new BillingEventProcessor();
}
 