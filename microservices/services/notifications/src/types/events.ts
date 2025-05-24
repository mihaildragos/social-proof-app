export interface BaseEvent {
  id: string;
  type: string;
  siteId: string;
  timestamp: string;
  source: string;
}

export interface OrderEvent extends BaseEvent {
  type: "order.created" | "order.paid" | "order.fulfilled";
  data: {
    id: string;
    order_number: string;
    customer: {
      id: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };
    line_items: Array<{
      id: string;
      product_id: string;
      variant_id: string;
      title: string;
      quantity: number;
      price: string;
      image_url?: string;
    }>;
    total_price: string;
    currency: string;
    created_at: string;
    fulfillment_status?: string;
    financial_status?: string;
    metadata?: Record<string, any>;
  };
}

export interface NotificationEvent extends BaseEvent {
  type: "notification_created" | "notification_delivered" | "notification_clicked";
  data: {
    notification_id: string;
    template_id: string;
    event_type: string;
    metadata?: Record<string, any>;
  };
}

export interface NotificationInput {
  siteId: string;
  templateId: string;
  eventType: string;
  eventData: Record<string, any>;
  channels: string[];
  status: string;
}

export interface Notification {
  id: string;
  siteId: string;
  templateId: string;
  eventType: string;
  content: Record<string, any>;
  channels: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  siteId: string;
  name: string;
  description?: string;
  channels: string[];
  content: Record<string, any>;
  css: string;
  html: string;
  eventTypes: string[];
  status: string;
}

export interface NotificationEventRecord {
  notificationId: string;
  siteId: string;
  eventType: string;
  metadata?: Record<string, any>;
}

export interface PublishableNotification {
  id: string;
  siteId: string;
  templateId: string;
  eventType: string;
  content: Record<string, any>;
  channels: string[];
  createdAt: string;
}
