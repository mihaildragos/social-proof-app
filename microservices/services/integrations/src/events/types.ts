// Event type definitions for integrations service

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

export interface WebhookReceivedEvent extends BaseEvent {
  type: "webhook.received";
  data: {
    webhookId: string;
    provider: string;
    eventType: string;
    payload: Record<string, any>;
    signature?: string;
    verified: boolean;
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

export interface SiteDeletedEvent extends BaseEvent {
  type: "site.deleted";
  data: {
    siteId: string;
    deletedBy: string;
  };
}

export type Event =
  | IntegrationConnectedEvent
  | IntegrationDisconnectedEvent
  | WebhookReceivedEvent
  | SiteCreatedEvent
  | SiteDeletedEvent; 