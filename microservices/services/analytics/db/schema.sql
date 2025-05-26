-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

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

-- Raw events table for high-volume event ingestion
CREATE TABLE raw_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  session_id UUID,
  user_id UUID,
  anonymous_id UUID,
  event_type TEXT NOT NULL, -- impression, click, conversion, page_view, custom
  event_name TEXT,
  notification_id UUID,
  variant_id UUID,
  channel TEXT, -- web, email, push
  properties JSONB,
  user_properties JSONB,
  device_info JSONB,
  location_info JSONB,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make raw_events a hypertable
SELECT create_hypertable('raw_events', 'timestamp', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add retention policy for raw events (90 days as per PRD)
SELECT add_retention_policy('raw_events', INTERVAL '90 days');

-- User sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  user_id UUID,
  anonymous_id UUID,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  is_bounce BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make user_sessions a hypertable
SELECT create_hypertable('user_sessions', 'session_start', 
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Page views table
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  session_id UUID,
  user_id UUID,
  anonymous_id UUID,
  page_url TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_on_page INTEGER, -- seconds
  scroll_depth FLOAT, -- percentage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make page_views a hypertable
SELECT create_hypertable('page_views', 'timestamp', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
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

-- User segments table
CREATE TABLE user_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL, -- Segment criteria definition
  is_dynamic BOOLEAN DEFAULT TRUE,
  user_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User segment memberships
CREATE TABLE user_segment_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID NOT NULL REFERENCES user_segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  anonymous_id UUID,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT unique_segment_user UNIQUE (segment_id, user_id)
);

-- Funnel definitions
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  conversion_window_hours INTEGER DEFAULT 24,
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

-- Funnel analysis results
CREATE TABLE funnel_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  step_order INTEGER NOT NULL,
  users_entered INTEGER NOT NULL,
  users_completed INTEGER NOT NULL,
  conversion_rate FLOAT NOT NULL,
  avg_time_to_convert INTERVAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_funnel_analysis UNIQUE (funnel_id, analysis_date, step_order)
);

-- Cohort definitions
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cohort_type TEXT NOT NULL, -- acquisition, behavioral, revenue
  definition JSONB NOT NULL, -- Contains the cohort query definition
  period_type TEXT NOT NULL, -- day, week, month
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohort analysis results
CREATE TABLE cohort_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  cohort_period DATE NOT NULL, -- The period when users entered the cohort
  analysis_period INTEGER NOT NULL, -- Period number (0, 1, 2, etc.)
  users_in_cohort INTEGER NOT NULL,
  users_returned INTEGER NOT NULL,
  retention_rate FLOAT NOT NULL,
  revenue_per_user FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_cohort_analysis UNIQUE (cohort_id, cohort_period, analysis_period)
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

-- Attribution results
CREATE TABLE attribution_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  attribution_model_id UUID NOT NULL REFERENCES attribution_models(id) ON DELETE CASCADE,
  conversion_event_id UUID NOT NULL,
  touchpoint_event_id UUID NOT NULL,
  attribution_weight FLOAT NOT NULL,
  revenue_attributed FLOAT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom events definitions
CREATE TABLE custom_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_schema JSONB, -- JSON schema for event validation
  is_conversion_event BOOLEAN DEFAULT FALSE,
  revenue_property TEXT, -- Property name that contains revenue value
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_site_event_name UNIQUE (site_id, name)
);

-- Goals and KPIs tracking
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL, -- conversion_rate, revenue, engagement, retention
  target_value FLOAT NOT NULL,
  current_value FLOAT DEFAULT 0,
  measurement_period TEXT NOT NULL, -- daily, weekly, monthly, quarterly
  event_criteria JSONB, -- Criteria for goal measurement
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal progress tracking
CREATE TABLE goal_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  actual_value FLOAT NOT NULL,
  target_value FLOAT NOT NULL,
  achievement_rate FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_goal_period UNIQUE (goal_id, period_start, period_end)
);

-- Saved report configurations
CREATE TABLE report_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- metrics, funnel, cohort, attribution, ab-test
  parameters JSONB NOT NULL, -- Report-specific parameters like date range, metrics, dimensions
  is_public BOOLEAN DEFAULT FALSE,
  share_token UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report generation history
CREATE TABLE report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_config_id UUID NOT NULL REFERENCES report_configs(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL,
  format TEXT NOT NULL, -- json, csv, pdf, xlsx
  file_url TEXT,
  file_size_bytes BIGINT,
  generation_time_ms INTEGER,
  status TEXT NOT NULL, -- pending, completed, failed
  error_message TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
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
  timezone TEXT DEFAULT 'UTC',
  recipients TEXT[] NOT NULL, -- Array of email addresses
  format TEXT NOT NULL, -- csv, pdf
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
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
  file_size_bytes BIGINT,
  record_count INTEGER,
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
  compression_type TEXT DEFAULT 'gzip',
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
  auto_delete_after_archive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_site_data_type UNIQUE (site_id, data_type)
);

-- Data quality monitoring
CREATE TABLE data_quality_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  check_type TEXT NOT NULL, -- completeness, accuracy, consistency, timeliness
  table_name TEXT NOT NULL,
  column_name TEXT,
  check_query TEXT NOT NULL,
  expected_result JSONB,
  actual_result JSONB,
  status TEXT NOT NULL, -- passed, failed, warning
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  user_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make api_usage a hypertable
SELECT create_hypertable('api_usage', 'timestamp', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add retention policy for API usage (30 days)
SELECT add_retention_policy('api_usage', INTERVAL '30 days');

-- Create indexes for common queries
CREATE INDEX idx_raw_events_site_timestamp ON raw_events(site_id, timestamp DESC);
CREATE INDEX idx_raw_events_session ON raw_events(session_id);
CREATE INDEX idx_raw_events_user ON raw_events(user_id);
CREATE INDEX idx_raw_events_notification ON raw_events(notification_id);
CREATE INDEX idx_raw_events_event_type ON raw_events(event_type, timestamp DESC);

CREATE INDEX idx_user_sessions_site_start ON user_sessions(site_id, session_start DESC);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_anonymous ON user_sessions(anonymous_id);

CREATE INDEX idx_page_views_site_timestamp ON page_views(site_id, timestamp DESC);
CREATE INDEX idx_page_views_session ON page_views(session_id);
CREATE INDEX idx_page_views_url ON page_views(page_url);

CREATE INDEX idx_daily_metrics_site_time ON daily_metrics(site_id, time DESC);
CREATE INDEX idx_daily_metrics_notification ON daily_metrics(notification_id);
CREATE INDEX idx_daily_metrics_metric ON daily_metrics(metric_name, time DESC);

CREATE INDEX idx_hourly_metrics_site_time ON hourly_metrics(site_id, time DESC);
CREATE INDEX idx_hourly_metrics_notification ON hourly_metrics(notification_id);

CREATE INDEX idx_user_segments_site ON user_segments(site_id);
CREATE INDEX idx_user_segment_memberships_segment ON user_segment_memberships(segment_id);
CREATE INDEX idx_user_segment_memberships_user ON user_segment_memberships(user_id);

CREATE INDEX idx_funnels_site_id ON funnels(site_id);
CREATE INDEX idx_funnel_steps_funnel_id ON funnel_steps(funnel_id);
CREATE INDEX idx_funnel_analysis_funnel_date ON funnel_analysis(funnel_id, analysis_date);

CREATE INDEX idx_cohorts_site_id ON cohorts(site_id);
CREATE INDEX idx_cohort_analysis_cohort_period ON cohort_analysis(cohort_id, cohort_period);

CREATE INDEX idx_ab_test_results_notification ON ab_test_results(notification_id);
CREATE INDEX idx_attribution_models_site ON attribution_models(site_id);
CREATE INDEX idx_attribution_results_model ON attribution_results(attribution_model_id);

CREATE INDEX idx_custom_events_site ON custom_events(site_id);
CREATE INDEX idx_goals_site ON goals(site_id);
CREATE INDEX idx_goal_progress_goal ON goal_progress(goal_id);

CREATE INDEX idx_report_configs_site_id ON report_configs(site_id);
CREATE INDEX idx_report_history_config ON report_history(report_config_id);
CREATE INDEX idx_scheduled_reports_report_config ON scheduled_reports(report_config_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE;

CREATE INDEX idx_export_history_site_id ON export_history(site_id);
CREATE INDEX idx_archived_data_site_id ON archived_data(site_id);
CREATE INDEX idx_data_retention_policies_site_id ON data_retention_policies(site_id);

CREATE INDEX idx_data_quality_checks_site ON data_quality_checks(site_id);
CREATE INDEX idx_api_usage_site_timestamp ON api_usage(site_id, timestamp DESC);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint, timestamp DESC);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE analytics_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_segment_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Create function to get current user ID (to be implemented in application)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_user_id', TRUE)::UUID;
$$;

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

CREATE POLICY raw_events_access ON raw_events
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

-- Similar policies for other tables (abbreviated for brevity)
-- Each table with site_id should have a similar policy

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

-- Real-time events aggregate
CREATE MATERIALIZED VIEW realtime_events_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', timestamp) AS time_bucket,
  site_id,
  event_type,
  channel,
  COUNT(*) AS event_count,
  COUNT(DISTINCT session_id) AS unique_sessions,
  COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS unique_users
FROM raw_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY time_bucket, site_id, event_type, channel;

-- Refresh policy for real-time aggregate
SELECT add_continuous_aggregate_policy('realtime_events_5min',
  start_offset => INTERVAL '24 hours',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '1 minute');

-- User activity summary view
CREATE MATERIALIZED VIEW user_activity_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', timestamp) AS day,
  site_id,
  COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS daily_active_users,
  COUNT(DISTINCT session_id) AS total_sessions,
  COUNT(*) AS total_events,
  AVG(EXTRACT(EPOCH FROM (session_end - session_start))) AS avg_session_duration
FROM raw_events re
LEFT JOIN user_sessions us ON re.session_id = us.id
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY day, site_id;

-- Refresh policy for user activity aggregate
SELECT add_continuous_aggregate_policy('user_activity_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Function to calculate funnel conversion rates
CREATE OR REPLACE FUNCTION calculate_funnel_conversion(
  p_funnel_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  step_order INTEGER,
  step_name TEXT,
  users_entered BIGINT,
  users_completed BIGINT,
  conversion_rate FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH funnel_steps_ordered AS (
    SELECT fs.step_order, fs.name, fs.event_type, fs.event_criteria
    FROM funnel_steps fs
    WHERE fs.funnel_id = p_funnel_id
    ORDER BY fs.step_order
  ),
  step_events AS (
    SELECT 
      fs.step_order,
      fs.name,
      re.user_id,
      re.anonymous_id,
      re.timestamp,
      ROW_NUMBER() OVER (PARTITION BY fs.step_order, COALESCE(re.user_id, re.anonymous_id) ORDER BY re.timestamp) as rn
    FROM funnel_steps_ordered fs
    JOIN raw_events re ON re.event_type = fs.event_type
    WHERE re.timestamp BETWEEN p_start_date AND p_end_date + INTERVAL '1 day'
      AND (fs.event_criteria IS NULL OR re.properties @> fs.event_criteria)
  ),
  funnel_progression AS (
    SELECT 
      step_order,
      name,
      COUNT(DISTINCT COALESCE(user_id, anonymous_id)) as users_at_step
    FROM step_events
    WHERE rn = 1
    GROUP BY step_order, name
  )
  SELECT 
    fp.step_order,
    fp.name::TEXT,
    fp.users_at_step,
    COALESCE(LAG(fp.users_at_step) OVER (ORDER BY fp.step_order), fp.users_at_step),
    CASE 
      WHEN LAG(fp.users_at_step) OVER (ORDER BY fp.step_order) IS NULL THEN 1.0
      ELSE fp.users_at_step::FLOAT / LAG(fp.users_at_step) OVER (ORDER BY fp.step_order)
    END
  FROM funnel_progression fp
  ORDER BY fp.step_order;
END;
$$;

-- Function to calculate cohort retention
CREATE OR REPLACE FUNCTION calculate_cohort_retention(
  p_cohort_id UUID,
  p_cohort_period DATE
) RETURNS TABLE (
  period_number INTEGER,
  users_returned BIGINT,
  retention_rate FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
  cohort_definition JSONB;
  period_type TEXT;
  total_users INTEGER;
BEGIN
  -- Get cohort definition
  SELECT c.definition, c.period_type INTO cohort_definition, period_type
  FROM cohorts c WHERE c.id = p_cohort_id;
  
  -- Calculate total users in cohort for the period
  -- This is a simplified version - actual implementation would depend on cohort definition
  SELECT COUNT(*) INTO total_users
  FROM raw_events re
  WHERE re.timestamp >= p_cohort_period 
    AND re.timestamp < p_cohort_period + INTERVAL '1 day'
    AND re.properties @> cohort_definition;
  
  -- Return retention data for up to 12 periods
  RETURN QUERY
  WITH RECURSIVE period_series AS (
    SELECT 0 as period_num
    UNION ALL
    SELECT period_num + 1
    FROM period_series
    WHERE period_num < 11
  )
  SELECT 
    ps.period_num,
    COALESCE(COUNT(DISTINCT COALESCE(re.user_id, re.anonymous_id)), 0)::BIGINT,
    CASE 
      WHEN total_users > 0 THEN COALESCE(COUNT(DISTINCT COALESCE(re.user_id, re.anonymous_id)), 0)::FLOAT / total_users
      ELSE 0.0
    END
  FROM period_series ps
  LEFT JOIN raw_events re ON 
    re.timestamp >= p_cohort_period + (ps.period_num || ' ' || period_type)::INTERVAL
    AND re.timestamp < p_cohort_period + ((ps.period_num + 1) || ' ' || period_type)::INTERVAL
    AND re.properties @> cohort_definition
  GROUP BY ps.period_num, total_users
  ORDER BY ps.period_num;
END;
$$;

-- Function to migrate data to ClickHouse (placeholder)
CREATE OR REPLACE FUNCTION migrate_data_to_clickhouse(
  p_date_from DATE,
  p_date_to DATE
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Implementation would connect to ClickHouse and transfer data
  -- This is a placeholder for the actual implementation
  RAISE NOTICE 'Migrating data from % to % to ClickHouse', p_date_from, p_date_to;
END;
$$;

-- Function to archive old data
CREATE OR REPLACE FUNCTION archive_old_data(
  p_site_id UUID,
  p_data_type TEXT,
  p_cutoff_date DATE
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  archive_record RECORD;
  s3_key TEXT;
  record_count INTEGER;
BEGIN
  -- Generate S3 key
  s3_key := format('analytics/%s/%s/%s/%s.gz', 
    p_site_id, p_data_type, 
    EXTRACT(YEAR FROM p_cutoff_date), 
    EXTRACT(MONTH FROM p_cutoff_date));
  
  -- Count records to be archived
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE site_id = $1 AND created_at < $2', p_data_type)
  INTO record_count
  USING p_site_id, p_cutoff_date;
  
  -- Insert archive record
  INSERT INTO archived_data (
    site_id, data_type, date_from, date_to, 
    s3_bucket, s3_key, record_count, archive_status
  ) VALUES (
    p_site_id, p_data_type, p_cutoff_date - INTERVAL '1 month', p_cutoff_date,
    'analytics-archive-bucket', s3_key, record_count, 'pending'
  );
  
  RAISE NOTICE 'Archive job created for % records of type % for site %', 
    record_count, p_data_type, p_site_id;
END;
$$;

-- Function to clean up expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM export_history 
  WHERE expires_at < NOW() 
    AND status = 'completed';
  
  DELETE FROM report_history 
  WHERE expires_at < NOW();
  
  RAISE NOTICE 'Cleaned up expired exports and reports';
END;
$$;

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_user_segments_updated_at BEFORE UPDATE ON user_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_funnels_updated_at BEFORE UPDATE ON funnels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cohorts_updated_at BEFORE UPDATE ON cohorts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attribution_models_updated_at BEFORE UPDATE ON attribution_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_events_updated_at BEFORE UPDATE ON custom_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_configs_updated_at BEFORE UPDATE ON report_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON data_retention_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create initial data retention policies
INSERT INTO data_retention_policies (site_id, data_type, retention_days, archive_enabled) 
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'raw_events', 90, true),
  ('00000000-0000-0000-0000-000000000000', 'user_sessions', 365, true),
  ('00000000-0000-0000-0000-000000000000', 'page_views', 90, true),
  ('00000000-0000-0000-0000-000000000000', 'api_usage', 30, false)
ON CONFLICT (site_id, data_type) DO NOTHING; 