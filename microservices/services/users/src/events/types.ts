// Event type definitions for user service

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

export interface UserRegisteredEvent extends BaseEvent {
  type: "user.registered";
  data: {
    userId: string;
    email: string;
    name: string;
    organizationId: string;
    role: "admin" | "analyst" | "designer";
    invitedBy?: string;
  };
}

export interface UserLoginEvent extends BaseEvent {
  type: "user.login";
  data: {
    userId: string;
    email: string;
    ipAddress: string;
    userAgent: string;
    loginMethod: "email" | "oauth" | "sso";
  };
}

export interface UserLogoutEvent extends BaseEvent {
  type: "user.logout";
  data: {
    userId: string;
    sessionDuration: number;
  };
}

export interface SiteCreatedEvent extends BaseEvent {
  type: "site.created";
  data: {
    siteId: string;
    name: string;
    domain: string;
    organizationId: string;
    createdBy: string;
  };
}

export interface SiteUpdatedEvent extends BaseEvent {
  type: "site.updated";
  data: {
    siteId: string;
    changes: Record<string, any>;
    updatedBy: string;
  };
}

export interface SiteDeletedEvent extends BaseEvent {
  type: "site.deleted";
  data: {
    siteId: string;
    deletedBy: string;
  };
}

export interface IntegrationConnectedEvent extends BaseEvent {
  type: "integration.connected";
  data: {
    integrationId: string;
    provider: "shopify" | "woocommerce" | "stripe" | "zapier";
    siteId: string;
    connectedBy: string;
    configuration: Record<string, any>;
  };
}

export interface IntegrationDisconnectedEvent extends BaseEvent {
  type: "integration.disconnected";
  data: {
    integrationId: string;
    provider: "shopify" | "woocommerce" | "stripe" | "zapier";
    siteId: string;
    disconnectedBy: string;
    reason?: string;
  };
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

export type Event =
  | UserRegisteredEvent
  | UserLoginEvent
  | UserLogoutEvent
  | SiteCreatedEvent
  | SiteUpdatedEvent
  | SiteDeletedEvent
  | IntegrationConnectedEvent
  | IntegrationDisconnectedEvent
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent;
