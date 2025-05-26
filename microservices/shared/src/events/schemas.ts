import { z } from "zod";

// Base event schema that all events must extend
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  version: z.string().default("1.0.0"),
  timestamp: z.string().datetime(),
  source: z.string(),
  organizationId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

// User Events
export const UserRegisteredEventSchema = BaseEventSchema.extend({
  type: z.literal("user.registered"),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    organizationId: z.string().uuid(),
    role: z.enum(["admin", "analyst", "designer"]),
    invitedBy: z.string().uuid().optional(),
  }),
});

export const UserLoginEventSchema = BaseEventSchema.extend({
  type: z.literal("user.login"),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    ipAddress: z.string(),
    userAgent: z.string(),
    loginMethod: z.enum(["email", "oauth", "sso"]),
  }),
});

export const UserLogoutEventSchema = BaseEventSchema.extend({
  type: z.literal("user.logout"),
  data: z.object({
    userId: z.string().uuid(),
    sessionDuration: z.number(),
  }),
});

// Site Events
export const SiteCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal("site.created"),
  data: z.object({
    siteId: z.string().uuid(),
    name: z.string(),
    domain: z.string(),
    organizationId: z.string().uuid(),
    createdBy: z.string().uuid(),
  }),
});

export const SiteUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal("site.updated"),
  data: z.object({
    siteId: z.string().uuid(),
    changes: z.record(z.any()),
    updatedBy: z.string().uuid(),
  }),
});

export const SiteDeletedEventSchema = BaseEventSchema.extend({
  type: z.literal("site.deleted"),
  data: z.object({
    siteId: z.string().uuid(),
    deletedBy: z.string().uuid(),
  }),
});

// Notification Events
export const NotificationCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.created"),
  data: z.object({
    notificationId: z.string().uuid(),
    templateId: z.string().uuid(),
    campaignId: z.string().uuid().optional(),
    siteId: z.string().uuid(),
    type: z.enum(["purchase", "signup", "activity", "custom"]),
    content: z.record(z.any()),
    targetingRules: z.record(z.any()),
    createdBy: z.string().uuid(),
  }),
});

export const NotificationTriggeredEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.triggered"),
  data: z.object({
    notificationId: z.string().uuid(),
    triggerId: z.string().uuid(),
    siteId: z.string().uuid(),
    visitorId: z.string(),
    triggerData: z.record(z.any()),
    targetingMatched: z.boolean(),
  }),
});

export const NotificationDisplayedEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.displayed"),
  data: z.object({
    notificationId: z.string().uuid(),
    triggerId: z.string().uuid(),
    siteId: z.string().uuid(),
    visitorId: z.string(),
    displayTime: z.string().datetime(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    variant: z.string().optional(),
  }),
});

export const NotificationClickedEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.clicked"),
  data: z.object({
    notificationId: z.string().uuid(),
    triggerId: z.string().uuid(),
    siteId: z.string().uuid(),
    visitorId: z.string(),
    clickTime: z.string().datetime(),
    clickPosition: z.object({
      x: z.number(),
      y: z.number(),
    }),
    variant: z.string().optional(),
  }),
});

export const NotificationClosedEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.closed"),
  data: z.object({
    notificationId: z.string().uuid(),
    triggerId: z.string().uuid(),
    siteId: z.string().uuid(),
    visitorId: z.string(),
    closeTime: z.string().datetime(),
    closeReason: z.enum(["user_action", "timeout", "auto_close"]),
    displayDuration: z.number(),
    variant: z.string().optional(),
  }),
});

// Integration Events
export const IntegrationConnectedEventSchema = BaseEventSchema.extend({
  type: z.literal("integration.connected"),
  data: z.object({
    integrationId: z.string().uuid(),
    provider: z.enum(["shopify", "woocommerce", "stripe", "zapier"]),
    siteId: z.string().uuid(),
    connectedBy: z.string().uuid(),
    configuration: z.record(z.any()),
  }),
});

export const IntegrationDisconnectedEventSchema = BaseEventSchema.extend({
  type: z.literal("integration.disconnected"),
  data: z.object({
    integrationId: z.string().uuid(),
    provider: z.enum(["shopify", "woocommerce", "stripe", "zapier"]),
    siteId: z.string().uuid(),
    disconnectedBy: z.string().uuid(),
    reason: z.string().optional(),
  }),
});

export const WebhookReceivedEventSchema = BaseEventSchema.extend({
  type: z.literal("webhook.received"),
  data: z.object({
    webhookId: z.string().uuid(),
    provider: z.string(),
    eventType: z.string(),
    payload: z.record(z.any()),
    signature: z.string().optional(),
    verified: z.boolean(),
  }),
});

// Billing Events
export const SubscriptionCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal("subscription.created"),
  data: z.object({
    subscriptionId: z.string().uuid(),
    organizationId: z.string().uuid(),
    planId: z.string().uuid(),
    stripeSubscriptionId: z.string(),
    status: z.enum(["active", "trialing", "past_due", "canceled", "unpaid"]),
    currentPeriodStart: z.string().datetime(),
    currentPeriodEnd: z.string().datetime(),
    createdBy: z.string().uuid(),
  }),
});

export const SubscriptionUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal("subscription.updated"),
  data: z.object({
    subscriptionId: z.string().uuid(),
    organizationId: z.string().uuid(),
    changes: z.record(z.any()),
    previousStatus: z.string(),
    newStatus: z.string(),
    updatedBy: z.string().uuid().optional(),
  }),
});

export const PaymentProcessedEventSchema = BaseEventSchema.extend({
  type: z.literal("payment.processed"),
  data: z.object({
    paymentId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    organizationId: z.string().uuid(),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(["succeeded", "failed", "pending"]),
    stripePaymentIntentId: z.string(),
    failureReason: z.string().optional(),
  }),
});

export const UsageRecordedEventSchema = BaseEventSchema.extend({
  type: z.literal("usage.recorded"),
  data: z.object({
    organizationId: z.string().uuid(),
    siteId: z.string().uuid().optional(),
    metric: z.enum(["notifications_sent", "api_calls", "storage_used", "bandwidth_used"]),
    quantity: z.number(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
  }),
});

// Analytics Events
export const PageViewEventSchema = BaseEventSchema.extend({
  type: z.literal("analytics.page_view"),
  data: z.object({
    siteId: z.string().uuid(),
    visitorId: z.string(),
    sessionId: z.string(),
    url: z.string().url(),
    referrer: z.string().optional(),
    userAgent: z.string(),
    ipAddress: z.string(),
    country: z.string().optional(),
    city: z.string().optional(),
    device: z.object({
      type: z.enum(["desktop", "mobile", "tablet"]),
      browser: z.string(),
      os: z.string(),
    }),
  }),
});

export const ConversionEventSchema = BaseEventSchema.extend({
  type: z.literal("analytics.conversion"),
  data: z.object({
    siteId: z.string().uuid(),
    visitorId: z.string(),
    sessionId: z.string(),
    conversionType: z.string(),
    value: z.number().optional(),
    currency: z.string().optional(),
    funnelId: z.string().uuid().optional(),
    step: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// Campaign Events
export const CampaignStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("campaign.started"),
  data: z.object({
    campaignId: z.string().uuid(),
    name: z.string(),
    siteId: z.string().uuid(),
    startedBy: z.string().uuid(),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime().optional(),
    targetAudience: z.record(z.any()),
  }),
});

export const CampaignEndedEventSchema = BaseEventSchema.extend({
  type: z.literal("campaign.ended"),
  data: z.object({
    campaignId: z.string().uuid(),
    siteId: z.string().uuid(),
    endedBy: z.string().uuid().optional(),
    endReason: z.enum(["scheduled", "manual", "budget_exhausted", "error"]),
    totalNotifications: z.number(),
    totalClicks: z.number(),
    totalConversions: z.number(),
  }),
});

// A/B Test Events
export const ABTestStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("ab_test.started"),
  data: z.object({
    testId: z.string().uuid(),
    name: z.string(),
    siteId: z.string().uuid(),
    variants: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        trafficAllocation: z.number(),
      })
    ),
    startedBy: z.string().uuid(),
  }),
});

export const ABTestEndedEventSchema = BaseEventSchema.extend({
  type: z.literal("ab_test.ended"),
  data: z.object({
    testId: z.string().uuid(),
    siteId: z.string().uuid(),
    endedBy: z.string().uuid(),
    winningVariant: z.string().optional(),
    results: z.record(z.any()),
    statisticalSignificance: z.number().optional(),
  }),
});

// Union type of all event schemas
export const EventSchema = z.discriminatedUnion("type", [
  UserRegisteredEventSchema,
  UserLoginEventSchema,
  UserLogoutEventSchema,
  SiteCreatedEventSchema,
  SiteUpdatedEventSchema,
  SiteDeletedEventSchema,
  NotificationCreatedEventSchema,
  NotificationTriggeredEventSchema,
  NotificationDisplayedEventSchema,
  NotificationClickedEventSchema,
  NotificationClosedEventSchema,
  IntegrationConnectedEventSchema,
  IntegrationDisconnectedEventSchema,
  WebhookReceivedEventSchema,
  SubscriptionCreatedEventSchema,
  SubscriptionUpdatedEventSchema,
  PaymentProcessedEventSchema,
  UsageRecordedEventSchema,
  PageViewEventSchema,
  ConversionEventSchema,
  CampaignStartedEventSchema,
  CampaignEndedEventSchema,
  ABTestStartedEventSchema,
  ABTestEndedEventSchema,
]);

// TypeScript types derived from schemas
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;
export type UserLoginEvent = z.infer<typeof UserLoginEventSchema>;
export type UserLogoutEvent = z.infer<typeof UserLogoutEventSchema>;
export type SiteCreatedEvent = z.infer<typeof SiteCreatedEventSchema>;
export type SiteUpdatedEvent = z.infer<typeof SiteUpdatedEventSchema>;
export type SiteDeletedEvent = z.infer<typeof SiteDeletedEventSchema>;
export type NotificationCreatedEvent = z.infer<typeof NotificationCreatedEventSchema>;
export type NotificationTriggeredEvent = z.infer<typeof NotificationTriggeredEventSchema>;
export type NotificationDisplayedEvent = z.infer<typeof NotificationDisplayedEventSchema>;
export type NotificationClickedEvent = z.infer<typeof NotificationClickedEventSchema>;
export type NotificationClosedEvent = z.infer<typeof NotificationClosedEventSchema>;
export type IntegrationConnectedEvent = z.infer<typeof IntegrationConnectedEventSchema>;
export type IntegrationDisconnectedEvent = z.infer<typeof IntegrationDisconnectedEventSchema>;
export type WebhookReceivedEvent = z.infer<typeof WebhookReceivedEventSchema>;
export type SubscriptionCreatedEvent = z.infer<typeof SubscriptionCreatedEventSchema>;
export type SubscriptionUpdatedEvent = z.infer<typeof SubscriptionUpdatedEventSchema>;
export type PaymentProcessedEvent = z.infer<typeof PaymentProcessedEventSchema>;
export type UsageRecordedEvent = z.infer<typeof UsageRecordedEventSchema>;
export type PageViewEvent = z.infer<typeof PageViewEventSchema>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;
export type CampaignStartedEvent = z.infer<typeof CampaignStartedEventSchema>;
export type CampaignEndedEvent = z.infer<typeof CampaignEndedEventSchema>;
export type ABTestStartedEvent = z.infer<typeof ABTestStartedEventSchema>;
export type ABTestEndedEvent = z.infer<typeof ABTestEndedEventSchema>;

export type Event = z.infer<typeof EventSchema>;

// Event type constants for easy reference
export const EVENT_TYPES = {
  // User events
  USER_REGISTERED: "user.registered",
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",

  // Site events
  SITE_CREATED: "site.created",
  SITE_UPDATED: "site.updated",
  SITE_DELETED: "site.deleted",

  // Notification events
  NOTIFICATION_CREATED: "notification.created",
  NOTIFICATION_TRIGGERED: "notification.triggered",
  NOTIFICATION_DISPLAYED: "notification.displayed",
  NOTIFICATION_CLICKED: "notification.clicked",
  NOTIFICATION_CLOSED: "notification.closed",

  // Integration events
  INTEGRATION_CONNECTED: "integration.connected",
  INTEGRATION_DISCONNECTED: "integration.disconnected",
  WEBHOOK_RECEIVED: "webhook.received",

  // Billing events
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_UPDATED: "subscription.updated",
  PAYMENT_PROCESSED: "payment.processed",
  USAGE_RECORDED: "usage.recorded",

  // Analytics events
  PAGE_VIEW: "analytics.page_view",
  CONVERSION: "analytics.conversion",

  // Campaign events
  CAMPAIGN_STARTED: "campaign.started",
  CAMPAIGN_ENDED: "campaign.ended",

  // A/B Test events
  AB_TEST_STARTED: "ab_test.started",
  AB_TEST_ENDED: "ab_test.ended",
} as const;

// Topic mapping for Kafka
export const KAFKA_TOPICS = {
  USER_EVENTS: "user-events",
  SITE_EVENTS: "site-events",
  NOTIFICATION_EVENTS: "notification-events",
  INTEGRATION_EVENTS: "integration-events",
  BILLING_EVENTS: "billing-events",
  ANALYTICS_EVENTS: "analytics-events",
  CAMPAIGN_EVENTS: "campaign-events",
  AB_TEST_EVENTS: "ab-test-events",
} as const;

// Helper function to get topic for event type
export function getTopicForEventType(eventType: string): string {
  if (eventType.startsWith("user.")) return KAFKA_TOPICS.USER_EVENTS;
  if (eventType.startsWith("site.")) return KAFKA_TOPICS.SITE_EVENTS;
  if (eventType.startsWith("notification.")) return KAFKA_TOPICS.NOTIFICATION_EVENTS;
  if (eventType.startsWith("integration.") || eventType.startsWith("webhook."))
    return KAFKA_TOPICS.INTEGRATION_EVENTS;
  if (
    eventType.startsWith("subscription.") ||
    eventType.startsWith("payment.") ||
    eventType.startsWith("usage.")
  )
    return KAFKA_TOPICS.BILLING_EVENTS;
  if (eventType.startsWith("analytics.")) return KAFKA_TOPICS.ANALYTICS_EVENTS;
  if (eventType.startsWith("campaign.")) return KAFKA_TOPICS.CAMPAIGN_EVENTS;
  if (eventType.startsWith("ab_test.")) return KAFKA_TOPICS.AB_TEST_EVENTS;

  // Default to a general events topic
  return "general-events";
}
