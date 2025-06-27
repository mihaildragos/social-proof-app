export interface NotificationTemplate {
  id: string;
  name: string;
  type: "purchase" | "signup" | "review" | "visitor_count" | "custom";
  category: "social_proof" | "urgency" | "trust" | "engagement";
  preview: string;
  content: {
    title: string;
    message: string;
    image?: string;
    cta?: {
      text: string;
      url: string;
    };
  };
  styling: {
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
    theme: "light" | "dark" | "custom";
    colors: {
      background: string;
      text: string;
      accent: string;
    };
    animation: "slide" | "fade" | "bounce" | "none";
    duration: number;
  };
  isCustom: boolean;
}

export interface TargetingRule {
  id: string;
  type: "page_url" | "referrer" | "device" | "location" | "time" | "behavior" | "custom";
  operator: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "in" | "not_in";
  value: string | string[];
  description: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  rules: TargetingRule[];
  logic: "AND" | "OR";
  estimatedReach?: number;
}

export interface BehavioralTrigger {
  id: string;
  event: "page_view" | "time_on_page" | "scroll_depth" | "exit_intent" | "click" | "form_submit";
  conditions: {
    delay?: number;
    scrollPercentage?: number;
    elementSelector?: string;
    pageViews?: number;
  };
  frequency: "once" | "session" | "daily" | "always";
}

export interface TargetingConfig {
  segments: AudienceSegment[];
  triggers: BehavioralTrigger[];
  frequency: {
    maxPerSession: number;
    maxPerDay: number;
    cooldownMinutes: number;
  };
  excludeRules?: TargetingRule[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
  template: NotificationTemplate;
  isControl: boolean;
}

export interface ABTestConfig {
  enabled: boolean;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number;
  duration: {
    startDate: Date;
    endDate: Date;
  };
  goals: {
    primary: "clicks" | "conversions" | "engagement" | "revenue";
    secondary?: string[];
  };
  significanceLevel: number;
  minimumSampleSize: number;
}

export interface ScheduleConfig {
  type: "immediate" | "scheduled" | "recurring";
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    daysOfWeek?: number[];
    timeSlots: {
      start: string;
      end: string;
    }[];
  };
  pauseConditions?: {
    lowTraffic: boolean;
    highBounceRate: boolean;
    customMetrics?: string[];
  };
}

export interface NotificationBuilderData {
  template?: NotificationTemplate;
  targeting?: TargetingConfig;
  abTest?: ABTestConfig;
  schedule?: ScheduleConfig;
  metadata: {
    name: string;
    description: string;
    siteId: string;
    createdBy: string;
    tags: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
}

export interface CreateNotificationResult {
  success: boolean;
  data?: {
    id: string;
    campaignId: string;
  };
  error?: string;
}

// Device preview types
export interface DevicePreview {
  type: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
  userAgent: string;
}

// Form validation schemas
export interface TemplateFormData {
  templateId?: string;
  customTemplate?: Partial<NotificationTemplate>;
}

export interface TargetingFormData {
  segments: AudienceSegment[];
  triggers: BehavioralTrigger[];
  frequency: TargetingConfig["frequency"];
}

export interface ABTestFormData {
  enabled: boolean;
  name?: string;
  variants?: ABTestVariant[];
  duration?: ABTestConfig["duration"];
  goals?: ABTestConfig["goals"];
}

export interface ScheduleFormData {
  type: ScheduleConfig["type"];
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  recurring?: ScheduleConfig["recurring"];
}
