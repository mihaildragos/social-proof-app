-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Create extension for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sites reference (shadows main sites table)
CREATE TABLE integration_sites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration types
CREATE TABLE integration_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  documentation_url TEXT,
  requires_oauth BOOLEAN DEFAULT FALSE,
  requires_api_key BOOLEAN DEFAULT FALSE,
  requires_webhook BOOLEAN DEFAULT FALSE,
  is_native BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate common integration types
INSERT INTO integration_types 
  (name, description, requires_oauth, requires_api_key, requires_webhook, is_native) VALUES
  ('shopify', 'Shopify connector for e-commerce data', TRUE, FALSE, TRUE, TRUE),
  ('woocommerce', 'WooCommerce connector for WordPress sites', TRUE, TRUE, TRUE, TRUE),
  ('zapier', 'Zapier integration for connecting to 3000+ apps', FALSE, TRUE, TRUE, TRUE),
  ('webhook', 'Generic webhook endpoint for custom integrations', FALSE, FALSE, TRUE, FALSE),
  ('rest-api', 'REST API for custom data sources', FALSE, TRUE, FALSE, FALSE),
  ('graphql', 'GraphQL API for custom data sources', FALSE, TRUE, FALSE, FALSE);

-- Integrations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  integration_type_id UUID NOT NULL REFERENCES integration_types(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive', -- inactive, active, error
  error_message TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth credentials (encrypted)
CREATE TABLE integration_oauth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  access_token_encrypted BYTEA,
  refresh_token_encrypted BYTEA,
  token_type TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Key credentials (encrypted)
CREATE TABLE integration_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  api_key_encrypted BYTEA NOT NULL,
  api_secret_encrypted BYTEA,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook configurations
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  topics TEXT[] NOT NULL, -- Array of event types to send
  secret_key_encrypted BYTEA, -- For HMAC signing
  headers JSONB DEFAULT '{}'::jsonb,
  format TEXT NOT NULL DEFAULT 'json', -- json, xml, form
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inbound webhook endpoints
CREATE TABLE inbound_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_path TEXT NOT NULL UNIQUE, -- Random path component for security
  secret_key_encrypted BYTEA NOT NULL, -- For HMAC verification
  topics TEXT[] NOT NULL, -- Array of event types to accept
  transformation_script TEXT, -- Optional JS transformation
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery tracking
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  request_headers JSONB,
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- pending, success, failed, retrying
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inbound webhook events
CREATE TABLE inbound_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inbound_webhook_id UUID NOT NULL REFERENCES inbound_webhooks(id) ON DELETE CASCADE,
  source_ip TEXT,
  headers JSONB,
  payload JSONB,
  signature TEXT,
  is_signature_valid BOOLEAN,
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL, -- pending, processed, failed
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled sync tasks
CREATE TABLE sync_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- full, incremental
  cron_expression TEXT NOT NULL, -- Cron syntax for scheduling
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync task history
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES sync_schedules(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL, -- full, incremental
  status TEXT NOT NULL, -- pending, running, completed, failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  log_details TEXT
);

-- Data mapping configurations
CREATE TABLE data_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transformation_type TEXT, -- none, string, number, boolean, date, custom
  transformation_rule TEXT, -- For custom transformations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_field_mapping UNIQUE (integration_id, source_field, target_field)
);

-- Rate limit tracking
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  limit_type TEXT NOT NULL, -- api_calls, webhooks
  limit_value INTEGER NOT NULL,
  current_usage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions for encryption/decryption
CREATE OR REPLACE FUNCTION encrypt_value(
  p_plaintext TEXT,
  p_key TEXT DEFAULT NULL
) RETURNS BYTEA LANGUAGE plpgsql AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Use provided key or get from secure location/environment
  IF p_key IS NULL THEN
    -- In production, this would use a secure key management system
    v_key := 'app_integration_secret_key';
  ELSE
    v_key := p_key;
  END IF;
  
  -- Encrypt the value
  RETURN pgp_sym_encrypt(p_plaintext, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_value(
  p_encrypted BYTEA,
  p_key TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_key TEXT;
  v_plaintext TEXT;
BEGIN
  -- Use provided key or get from secure location/environment
  IF p_key IS NULL THEN
    -- In production, this would use a secure key management system
    v_key := 'app_integration_secret_key';
  ELSE
    v_key := p_key;
  END IF;
  
  -- Decrypt the value
  v_plaintext := pgp_sym_decrypt(p_encrypted, v_key);
  RETURN v_plaintext;
END;
$$;

-- Helper function for HMAC signing
CREATE OR REPLACE FUNCTION generate_hmac_signature(
  p_payload TEXT,
  p_secret TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN encode(hmac(p_payload::bytea, p_secret::bytea, 'sha256'), 'hex');
END;
$$;

-- Helper function to verify HMAC signatures
CREATE OR REPLACE FUNCTION verify_hmac_signature(
  p_payload TEXT,
  p_signature TEXT,
  p_secret TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_calculated_signature TEXT;
BEGIN
  v_calculated_signature := generate_hmac_signature(p_payload, p_secret);
  RETURN v_calculated_signature = p_signature;
END;
$$;

-- Create indexes for common queries
CREATE INDEX idx_integrations_site_id ON integrations(site_id);
CREATE INDEX idx_integrations_type_id ON integrations(integration_type_id);
CREATE INDEX idx_integrations_status ON integrations(status);
CREATE INDEX idx_integration_oauth_integration_id ON integration_oauth(integration_id);
CREATE INDEX idx_webhooks_integration_id ON webhooks(integration_id);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_inbound_webhooks_site_id ON inbound_webhooks(site_id);
CREATE INDEX idx_inbound_webhook_events_webhook_id ON inbound_webhook_events(inbound_webhook_id);
CREATE INDEX idx_inbound_webhook_events_created_at ON inbound_webhook_events(created_at DESC);
CREATE INDEX idx_sync_schedules_integration_id ON sync_schedules(integration_id);
CREATE INDEX idx_sync_schedules_next_run ON sync_schedules(next_run_at) WHERE is_active = TRUE;
CREATE INDEX idx_sync_history_integration_id ON sync_history(integration_id);
CREATE INDEX idx_sync_history_completed_at ON sync_history(completed_at);
CREATE INDEX idx_data_mappings_integration_id ON data_mappings(integration_id);
CREATE INDEX idx_rate_limits_integration_window ON rate_limits(integration_id, window_end);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE integration_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for data access
CREATE POLICY integration_site_access ON integration_sites
  FOR ALL USING (
    id IN (
      SELECT site_id FROM organization_sites
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_user_id()
      )
    )
  );

CREATE POLICY integration_access ON integrations
  FOR ALL USING (
    site_id IN (
      SELECT id FROM integration_sites
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