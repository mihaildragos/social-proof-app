-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites (tenants)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  verified_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  data_region TEXT DEFAULT 'us',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates for notifications
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  css_content TEXT,
  html_content TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  channels TEXT[] DEFAULT ARRAY['web']::TEXT[], -- web, email, push
  created_by UUID NOT NULL, -- User ID who created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ
);

-- A/B Tests
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed
  winner_variant_id UUID, -- Self-reference to variant
  confidence_level FLOAT,
  auto_select_winner BOOLEAN DEFAULT TRUE,
  significance_threshold FLOAT DEFAULT 0.95,
  winner_selected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B Test Variants
CREATE TABLE ab_test_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  content JSONB, -- Dynamic content specific to this variant
  weight INTEGER DEFAULT 50, -- Traffic distribution weight
  is_control BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the foreign key from ab_tests to winner_variant_id 
ALTER TABLE ab_tests ADD CONSTRAINT fk_ab_tests_winner
  FOREIGN KEY (winner_variant_id) REFERENCES ab_test_variants(id) ON DELETE SET NULL;

-- Targeting Rules
CREATE TABLE targeting_rule_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  operator TEXT NOT NULL DEFAULT 'and' -- and, or
);

CREATE TABLE targeting_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_group_id UUID NOT NULL REFERENCES targeting_rule_groups(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL, -- location, utm_source, referrer, etc.
  operator TEXT NOT NULL, -- equals, contains, regex, lt, gt, etc.
  value JSONB NOT NULL, -- Can be string, number, array, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Channel Config
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  template_id TEXT, -- SendGrid template ID
  scheduled_time TIMESTAMPTZ,
  use_ai_optimization BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Push Notification Config
CREATE TABLE push_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  title TEXT NOT NULL, 
  body TEXT NOT NULL,
  icon_url TEXT,
  click_action TEXT,
  scheduled_time TIMESTAMPTZ,
  use_ai_optimization BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Web Notification Config
CREATE TABLE web_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  position TEXT DEFAULT 'bottom-left', -- bottom-left, bottom-right, top-left, top-right
  display_time INTEGER DEFAULT 5, -- Time in seconds
  animation TEXT DEFAULT 'fade', -- fade, slide, bounce
  delay INTEGER DEFAULT 0, -- Delay in seconds
  frequency TEXT DEFAULT 'once', -- once, every-visit, every-page
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dynamic Variables
CREATE TABLE dynamic_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_value TEXT,
  data_source TEXT, -- event_data, event_attribute, static
  event_path TEXT, -- JSON path for event data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_variable_per_notification UNIQUE(notification_id, name)
);

-- Real-time notification events for TimescaleDB
CREATE TABLE notification_events (
  id UUID DEFAULT uuid_generate_v4(),
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  site_id UUID NOT NULL,
  notification_id UUID,
  variant_id UUID,
  event_type TEXT NOT NULL, -- impression, click, conversion
  visitor_id TEXT,
  session_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  geo_country TEXT,
  geo_region TEXT,
  geo_city TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,
  browser TEXT,
  channel TEXT, -- web, email, push
  metadata JSONB,
  CONSTRAINT notification_events_pkey PRIMARY KEY (id, time)
);

-- Create hypertable for time-series data
SELECT create_hypertable('notification_events', 'time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add partitioning on site_id
SELECT add_dimension('notification_events', 'site_id', 
  number_partitions => 8,
  if_not_exists => TRUE
);

-- Automated archiving function for retention policy
CREATE OR REPLACE FUNCTION archive_old_events() RETURNS void
LANGUAGE SQL AS $$
  -- Archive data older than 90 days 
  -- Implementation depends on S3 archival strategy
$$;

-- Create indexes for common queries
CREATE INDEX idx_notifications_site_id ON notifications(site_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_templates_site_id ON templates(site_id);
CREATE INDEX idx_ab_tests_notification_id ON ab_tests(notification_id);
CREATE INDEX idx_ab_test_variants_test_id ON ab_test_variants(ab_test_id);
CREATE INDEX idx_targeting_rules_group_id ON targeting_rules(rule_group_id);
CREATE INDEX idx_email_campaigns_notification_id ON email_campaigns(notification_id);
CREATE INDEX idx_push_campaigns_notification_id ON push_campaigns(notification_id);
CREATE INDEX idx_web_campaigns_notification_id ON web_campaigns(notification_id);
CREATE INDEX idx_dynamic_variables_notification_id ON dynamic_variables(notification_id);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE targeting_rule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE targeting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_variables ENABLE ROW LEVEL SECURITY;

-- Create policies for site access
CREATE POLICY site_access ON sites
  FOR ALL USING (
    id IN (
      SELECT site_id FROM organization_sites 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_user_id()
      )
    )
  );

-- Create policy for notifications access
CREATE POLICY notification_access ON notifications
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE id IN (
        SELECT site_id FROM organization_sites
        WHERE organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = current_user_id()
        )
      )
    )
  );

-- Create policy for templates access
CREATE POLICY template_access ON templates
  FOR ALL USING (
    site_id IN (
      SELECT id FROM sites WHERE id IN (
        SELECT site_id FROM organization_sites
        WHERE organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = current_user_id()
        )
      )
    )
  );

-- Create function to get current user ID (to be implemented in application)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_user_id', TRUE)::UUID;
$$; 