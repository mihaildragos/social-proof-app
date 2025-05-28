// Event type definitions for analytics service

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

export interface PageViewEvent extends BaseEvent {
  type: "page.viewed";
  data: {
    pageId: string;
    siteId: string;
    visitorId: string;
    url: string;
    title: string;
    referrer?: string;
    userAgent: string;
    ipAddress: string;
    sessionDuration?: number;
  };
}

export interface ConversionEvent extends BaseEvent {
  type: "conversion.tracked";
  data: {
    conversionId: string;
    siteId: string;
    visitorId: string;
    notificationId?: string;
    conversionType: "purchase" | "signup" | "download" | "custom";
    value?: number;
    currency?: string;
    properties: Record<string, any>;
  };
}

export interface NotificationAnalyticsEvent extends BaseEvent {
  type: "notification.analytics";
  data: {
    notificationId: string;
    siteId: string;
    visitorId: string;
    action: "displayed" | "clicked" | "closed" | "converted";
    variant?: string;
    position?: { x: number; y: number };
    duration?: number;
  };
}

export type Event =
  | PageViewEvent
  | ConversionEvent
  | NotificationAnalyticsEvent; 