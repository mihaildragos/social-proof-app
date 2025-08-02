// Event type definitions for notifications service

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

export interface NotificationCreatedEvent extends BaseEvent {
  type: "notification.created";
  data: {
    notificationId: string;
    templateId: string;
    campaignId?: string;
    siteId: string;
    type: "purchase" | "signup" | "activity" | "custom";
    content: Record<string, any>;
    targetingRules: Record<string, any>;
    createdBy: string;
  };
}

export interface NotificationTriggeredEvent extends BaseEvent {
  type: "notification.triggered";
  data: {
    notificationId: string;
    triggerId: string;
    siteId: string;
    visitorId: string;
    triggerData: Record<string, any>;
    targetingMatched: boolean;
  };
}

export interface NotificationDisplayedEvent extends BaseEvent {
  type: "notification.displayed";
  data: {
    notificationId: string;
    triggerId: string;
    siteId: string;
    visitorId: string;
    displayTime: string;
    position: { x: number; y: number };
    variant?: string;
  };
}

export interface NotificationClickedEvent extends BaseEvent {
  type: "notification.clicked";
  data: {
    notificationId: string;
    triggerId: string;
    siteId: string;
    visitorId: string;
    clickTime: string;
    clickPosition: { x: number; y: number };
    variant?: string;
  };
}

export interface NotificationClosedEvent extends BaseEvent {
  type: "notification.closed";
  data: {
    notificationId: string;
    triggerId: string;
    siteId: string;
    visitorId: string;
    closeTime: string;
    closeReason: "user_action" | "timeout" | "auto_close";
    displayDuration: number;
    variant?: string;
  };
}

export interface CampaignStartedEvent extends BaseEvent {
  type: "campaign.started";
  data: {
    campaignId: string;
    name: string;
    siteId: string;
    startedBy: string;
    scheduledStart: string;
    scheduledEnd?: string;
    targetAudience: Record<string, any>;
  };
}

export interface CampaignEndedEvent extends BaseEvent {
  type: "campaign.ended";
  data: {
    campaignId: string;
    siteId: string;
    endedBy?: string;
    endReason: "scheduled" | "manual" | "budget_exhausted" | "error";
    totalNotifications: number;
    totalClicks: number;
    totalConversions: number;
  };
}

export interface ABTestStartedEvent extends BaseEvent {
  type: "ab_test.started";
  data: {
    testId: string;
    name: string;
    siteId: string;
    variants: Array<{
      id: string;
      name: string;
      trafficAllocation: number;
    }>;
    startedBy: string;
  };
}

export interface ABTestEndedEvent extends BaseEvent {
  type: "ab_test.ended";
  data: {
    testId: string;
    siteId: string;
    endedBy: string;
    winningVariant?: string;
    results: Record<string, any>;
    statisticalSignificance?: number;
  };
}

export type Event =
  | NotificationCreatedEvent
  | NotificationTriggeredEvent
  | NotificationDisplayedEvent
  | NotificationClickedEvent
  | NotificationClosedEvent
  | CampaignStartedEvent
  | CampaignEndedEvent
  | ABTestStartedEvent
  | ABTestEndedEvent; 