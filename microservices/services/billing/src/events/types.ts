// Event type definitions for billing service

export interface BaseEvent {
  id: string;
  type: string;
  version: string;
  timestamp: string;
  source: string;
  organizationId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionCreatedEvent extends BaseEvent {
  type: "subscription.created";
  data: {
    subscriptionId: string;
    organizationId: string;
    planId: string;
    stripeSubscriptionId: string;
    status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    createdBy: string;
  };
}

export interface SubscriptionUpdatedEvent extends BaseEvent {
  type: "subscription.updated";
  data: {
    subscriptionId: string;
    organizationId: string;
    status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    changes: Record<string, any>;
  };
}

export interface PaymentProcessedEvent extends BaseEvent {
  type: "payment.processed";
  data: {
    paymentId: string;
    subscriptionId: string;
    organizationId: string;
    amount: number;
    currency: string;
    status: "succeeded" | "failed" | "pending";
    stripePaymentIntentId: string;
    paymentMethod: string;
  };
}

export interface UsageRecordedEvent extends BaseEvent {
  type: "usage.recorded";
  data: {
    usageId: string;
    organizationId: string;
    siteId: string;
    metricType: "notifications" | "api_calls" | "storage";
    quantity: number;
    timestamp: string;
    billingPeriod: string;
  };
}

export type Event =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | PaymentProcessedEvent
  | UsageRecordedEvent; 