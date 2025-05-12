-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ClickHouse tables would typically be created in a separate ClickHouse database
-- This represents the PostgreSQL/TimescaleDB portion of the analytics schema

-- Sites reference (shadows main sites table)
CREATE TABLE analytics_sites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily aggregated metrics
CREATE TABLE daily_metrics (
  time TIMESTAMPTZ NOT NULL,
  site_id UUID NOT NULL,
  notification_id UUID,
  variant_id UUID,
  channel TEXT, -- web, email, push
  metric_name TEXT NOT NULL, -- impressions, clicks, conversions, revenue
  metric_value FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT daily_metrics_pkey PRIMARY KEY (time, site_id, metric_name, notification_id, variant_id, channel)
);

-- Make daily_metrics a hypertable
SELECT create_hypertable('daily_metrics', 'time', 
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

-- Hourly aggregated metrics for recent data
CREATE TABLE hourly_metrics (
  time TIMESTAMPTZ NOT NULL,
  site_id UUID NOT NULL,
  notification_id UUID,
  variant_id UUID,
  channel TEXT, -- web, email, push
  metric_name TEXT NOT NULL, -- impressions, clicks, conversions, revenue
  metric_value FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT hourly_metrics_pkey PRIMARY KEY (time, site_id, metric_name, notification_id, variant_id, channel)
);

-- Make hourly_metrics a hypertable with 7-day retention
SELECT create_hypertable('hourly_metrics', 'time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add a retention policy for hourly data (keep only 7 days)
SELECT add_retention_policy('hourly_metrics', INTERVAL '7 days');

-- Real-time counters in Redis (structure shown for documentation)
/*
REDIS KEY STRUCTURE:
  counter:{site_id}:{notification_id}:{variant_id}:{channel}:{metric}:{date} -> value
  
EXAMPLE KEYS:
  counter:123e4567-e89b-12d3-a456-426614174000:null:null:null:impressions:20230601 -> 1500
  counter:123e4567-e89b-12d3-a456-426614174000:456e4567-e89b-12d3-a456-426614174000:null:web:clicks:20230601 -> 350
*/

-- Funnel definitions
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funnel steps
CREATE TABLE funnel_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- impression, click, conversion, custom
  event_criteria JSONB, -- Criteria for matching events to this step
  step_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_step_order UNIQUE (funnel_id, step_order)
);

-- Cohort definitions
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL, -- Contains the cohort query definition
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B test statistical results
CREATE TABLE ab_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  ab_test_id UUID NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  control_variant_id UUID NOT NULL,
  metrics JSONB NOT NULL, -- Contains metrics like sample sizes, conversion rates, confidence intervals
  winning_variant_id UUID,
  confidence_level FLOAT,
  is_statistically_significant BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attribution models
CREATE TABLE attribution_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  model_type TEXT NOT NULL, -- first-touch, last-touch, linear, time-decay, position-based, custom
  custom_weights JSONB, -- For custom attribution models
  lookback_window_days INTEGER DEFAULT 30,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved report configurations
CREATE TABLE report_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- metrics, funnel, cohort, attribution, ab-test
  parameters JSONB NOT NULL, -- Report-specific parameters like date range, metrics, dimensions
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled report configurations
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_config_id UUID NOT NULL REFERENCES report_configs(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL, -- daily, weekly, monthly
  day_of_week INTEGER, -- For weekly reports (0 = Sunday)
  day_of_month INTEGER, -- For monthly reports
  hour INTEGER NOT NULL, -- Hour of day (0-23)
  minute INTEGER NOT NULL, -- Minute of hour (0-59)
  recipients TEXT[] NOT NULL, -- Array of email addresses
  format TEXT NOT NULL, -- csv, pdf
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Export history
CREATE TABLE export_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  report_config_id UUID REFERENCES report_configs(id) ON DELETE SET NULL,
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL,
  format TEXT NOT NULL, -- csv, pdf
  status TEXT NOT NULL, -- pending, processing, completed, failed
  file_url TEXT, -- S3 or other storage URL
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Archival tracking
CREATE TABLE archived_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  data_type TEXT NOT NULL, -- events, metrics
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  s3_bucket TEXT NOT NULL, 
  s3_key TEXT NOT NULL,
  file_size_bytes BIGINT,
  record_count INTEGER,
  archive_status TEXT NOT NULL, -- pending, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Data retention policies
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  data_type TEXT NOT NULL, -- events, metrics
  retention_days INTEGER NOT NULL,
  archive_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_site_data_type UNIQUE (site_id, data_type)
);

-- Create indexes for common queries
CREATE INDEX idx_daily_metrics_site_time ON daily_metrics(site_id, time DESC);
CREATE INDEX idx_daily_metrics_notification ON daily_metrics(notification_id);
CREATE INDEX idx_daily_metrics_metric ON daily_metrics(metric_name, time DESC);
CREATE INDEX idx_hourly_metrics_site_time ON hourly_metrics(site_id, time DESC);
CREATE INDEX idx_hourly_metrics_notification ON hourly_metrics(notification_id);
CREATE INDEX idx_funnels_site_id ON funnels(site_id);
CREATE INDEX idx_funnel_steps_funnel_id ON funnel_steps(funnel_id);
CREATE INDEX idx_cohorts_site_id ON cohorts(site_id);
CREATE INDEX idx_ab_test_results_notification ON ab_test_results(notification_id);
CREATE INDEX idx_report_configs_site_id ON report_configs(site_id);
CREATE INDEX idx_scheduled_reports_report_config ON scheduled_reports(report_config_id);
CREATE INDEX idx_export_history_site_id ON export_history(site_id);
CREATE INDEX idx_archived_data_site_id ON archived_data(site_id);
CREATE INDEX idx_data_retention_policies_site_id ON data_retention_policies(site_id);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE analytics_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Create policies for data access
CREATE POLICY analytics_site_access ON analytics_sites
  FOR ALL USING (
    id IN (
      SELECT site_id FROM organization_sites
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_user_id()
      )
    )
  );

CREATE POLICY funnel_access ON funnels
  FOR ALL USING (
    site_id IN (
      SELECT id FROM analytics_sites
      WHERE id IN (
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

-- Automated continuous aggregate views
CREATE MATERIALIZED VIEW daily_metrics_last_30d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS day,
  site_id,
  notification_id,
  channel,
  metric_name,
  SUM(metric_value) AS total_value,
  COUNT(*) AS data_points
FROM hourly_metrics
WHERE time > NOW() - INTERVAL '30 days'
GROUP BY day, site_id, notification_id, channel, metric_name;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('daily_metrics_last_30d',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Function to migrate data to ClickHouse (placeholder)
CREATE OR REPLACE FUNCTION migrate_data_to_clickhouse(
  p_date_from DATE,
  p_date_to DATE
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Implementation would connect to ClickHouse and transfer data
  -- This is a placeholder for the actual implementation
  NULL;
END;
$$; 