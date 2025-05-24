-- Initialize notifications service database schema

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create notification templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  css TEXT,
  html TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT '{web}'::text[],
  event_types TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id),
  event_type TEXT NOT NULL,
  content JSONB NOT NULL,
  channels TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create targeting rule groups table
CREATE TABLE IF NOT EXISTS targeting_rule_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  operator TEXT NOT NULL DEFAULT 'and',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create targeting rules table
CREATE TABLE IF NOT EXISTS targeting_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_group_id UUID NOT NULL REFERENCES targeting_rule_groups(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  operator TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notification events table (using TimescaleDB for time-series data)
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID DEFAULT uuid_generate_v4(),
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  site_id UUID NOT NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  CONSTRAINT notification_events_pkey PRIMARY KEY (id, time)
);

-- Convert to hypertable (if TimescaleDB is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('notification_events', 'time', 
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    );
  END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at fields
CREATE TRIGGER templates_updated_at_trigger
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER notifications_updated_at_trigger
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER targeting_rule_groups_updated_at_trigger
BEFORE UPDATE ON targeting_rule_groups
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER targeting_rules_updated_at_trigger
BEFORE UPDATE ON targeting_rules
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Create indexes for common query patterns
CREATE INDEX idx_templates_site_id ON templates(site_id);
CREATE INDEX idx_templates_event_types ON templates USING GIN(event_types);
CREATE INDEX idx_templates_status ON templates(status);

CREATE INDEX idx_notifications_site_id ON notifications(site_id);
CREATE INDEX idx_notifications_template_id ON notifications(template_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_event_type ON notifications(event_type);

CREATE INDEX idx_targeting_rule_groups_notification_id ON targeting_rule_groups(notification_id);

CREATE INDEX idx_targeting_rules_rule_group_id ON targeting_rules(rule_group_id);

CREATE INDEX idx_notification_events_site_id ON notification_events(site_id, time DESC);
CREATE INDEX idx_notification_events_notification_id ON notification_events(notification_id, time DESC);
CREATE INDEX idx_notification_events_event_type ON notification_events(event_type, time DESC);

-- Insert sample template for testing
INSERT INTO templates (
  site_id,
  name,
  description,
  css,
  html,
  content,
  channels,
  event_types,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Order Confirmation',
  'Template for new order notifications',
  '
    .notification {
      font-family: sans-serif;
      padding: 15px;
      border-radius: 5px;
      background-color: #ffffff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      max-width: 400px;
    }
    .notification-icon {
      width: 40px;
      height: 40px;
      margin-right: 15px;
      border-radius: 50%;
      overflow: hidden;
    }
    .notification-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .notification-content {
      flex: 1;
    }
    .notification-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .notification-message {
      font-size: 14px;
      color: #666;
    }
    .notification-time {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
  ',
  '
    <div class="notification">
      <div class="notification-icon">
        <img src="{{line_items.0.image_url}}" alt="Product Image" />
      </div>
      <div class="notification-content">
        <div class="notification-title">New Order Placed</div>
        <div class="notification-message">
          Someone just purchased {{line_items.0.title}} for {{formatCurrency total_price currency}}
        </div>
        <div class="notification-time">{{formatDate created_at "relative"}}</div>
      </div>
    </div>
  ',
  '{
    "variables": {
      "productTitle": {
        "path": "line_items.0.title",
        "default": "a product"
      },
      "productImage": {
        "path": "line_items.0.image_url",
        "default": "https://placehold.co/200"
      },
      "totalPrice": {
        "path": "total_price",
        "default": "0.00"
      },
      "currency": {
        "path": "currency",
        "default": "USD"
      },
      "createdAt": {
        "path": "created_at",
        "default": ""
      }
    }
  }',
  '{web}',
  '{order.created, order.paid}',
  'active'
); 