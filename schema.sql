-- ============================================================================
-- SCHEMA.SQL - Fomo-Style Social-Proof Notification Platform
-- ============================================================================
-- Comprehensive PostgreSQL schema for core tables supporting multi-tenant
-- real-time social proof notification platform with A/B testing capabilities
-- ============================================================================

-- Create updated_at trigger function (used for multiple tables)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create enum types
CREATE TYPE notification_status AS ENUM (
  'draft',
  'active',
  'paused',
  'archived',
  'scheduled'
);

CREATE TYPE notification_channel AS ENUM (
  'web_popup',
  'email',
  'push'
);

CREATE TYPE verification_status AS ENUM (
  'pending_verification',
  'verified',
  'failed',
  'suspended'
);

CREATE TYPE verification_method AS ENUM (
  'dns_txt',
  'dns_cname', 
  'file_upload',
  'meta_tag'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'analyst',
  'designer'
);

CREATE TYPE subscription_tier AS ENUM (
  'free_shopify',
  'starter',
  'business',
  'pro',
  'unlimited'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'pending',
  'paid',
  'failed',
  'canceled'
);

CREATE TYPE ab_test_status AS ENUM (
  'running',
  'completed',
  'stopped'
);

-- Webhook delivery status for tracking outbound notifications
CREATE TYPE webhook_delivery_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'retrying'
);

-- ============================================================================
-- USERS TABLE
-- Primary user account information
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_encrypted BYTEA NOT NULL,
  email_encryption_key_id UUID REFERENCES encryption_keys(id),
  full_name_encrypted BYTEA,
  full_name_encryption_key_id UUID REFERENCES encryption_keys(id),
  avatar_url TEXT,
  hashed_password TEXT,
  auth_provider TEXT,                    -- 'email', 'clerk', 'saml', etc.
  auth_provider_id TEXT,                 -- ID from third-party auth provider
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  preferred_language TEXT DEFAULT 'en',
  preferred_timezone TEXT DEFAULT 'UTC',
  role user_role NOT NULL DEFAULT 'user',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Index for email lookups (using functional index)
CREATE UNIQUE INDEX idx_users_email_encrypted ON users(sha256(email_encrypted::text));

-- ============================================================================
-- ENCRYPTION TRIGGERS
-- Automatically encrypt PII fields on insert/update
-- ============================================================================

-- User email encryption function and trigger
CREATE OR REPLACE FUNCTION encrypt_user_email()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key_id UUID;
  encrypted_value BYTEA;
BEGIN
  -- Get the active encryption key for the tenant
  SELECT id INTO encryption_key_id FROM encryption_keys 
  WHERE active = TRUE 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    RAISE EXCEPTION 'No active encryption key found';
  END IF;
  
  -- Encrypt the email (passed as a parameter to the trigger)
  encrypted_value := encrypt_column_value(NEW.email, encryption_key_id);
  
  -- Store encrypted value and key reference
  NEW.email_encrypted := encrypted_value;
  NEW.email_encryption_key_id := encryption_key_id;
  
  -- Remove the email parameter after encryption
  NEW.email := NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User full_name encryption function and trigger
CREATE OR REPLACE FUNCTION encrypt_user_full_name()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key_id UUID;
  encrypted_value BYTEA;
BEGIN
  -- Only encrypt if full_name is provided
  IF NEW.full_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the active encryption key for the tenant
  SELECT id INTO encryption_key_id FROM encryption_keys 
  WHERE active = TRUE 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    RAISE EXCEPTION 'No active encryption key found';
  END IF;
  
  -- Encrypt the full_name
  encrypted_value := encrypt_column_value(NEW.full_name, encryption_key_id);
  
  -- Store encrypted value and key reference
  NEW.full_name_encrypted := encrypted_value;
  NEW.full_name_encryption_key_id := encryption_key_id;
  
  -- Remove the full_name parameter after encryption
  NEW.full_name := NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to users table
-- Important: These triggers work with a transition structure where email and full_name
-- are passed as parameters on INSERT and UPDATE, then encrypted and removed
CREATE TRIGGER users_email_encrypt_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
WHEN (NEW.email IS NOT NULL)
EXECUTE FUNCTION encrypt_user_email();

CREATE TRIGGER users_full_name_encrypt_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
WHEN (NEW.full_name IS NOT NULL)
EXECUTE FUNCTION encrypt_user_full_name();

-- Helper functions to decrypt PII data when needed
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  email_encrypted BYTEA;
  key_id UUID;
  key_material BYTEA;
  decrypted_email TEXT;
BEGIN
  -- Get the encrypted email and key ID
  SELECT u.email_encrypted, u.email_encryption_key_id 
  INTO email_encrypted, key_id
  FROM users u
  WHERE u.id = user_id;
  
  IF email_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  SELECT key_material INTO key_material
  FROM encryption_keys
  WHERE id = key_id;
  
  IF key_material IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Decrypt the email
  decrypted_email := decrypt_column_value(email_encrypted, key_id);
  
  RETURN decrypted_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_full_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  full_name_encrypted BYTEA;
  key_id UUID;
  key_material BYTEA;
  decrypted_full_name TEXT;
BEGIN
  -- Get the encrypted full_name and key ID
  SELECT u.full_name_encrypted, u.full_name_encryption_key_id 
  INTO full_name_encrypted, key_id
  FROM users u
  WHERE u.id = user_id;
  
  IF full_name_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  SELECT key_material INTO key_material
  FROM encryption_keys
  WHERE id = key_id;
  
  IF key_material IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Decrypt the full_name
  decrypted_full_name := decrypt_column_value(full_name_encrypted, key_id);
  
  RETURN decrypted_full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ACCOUNTS TABLE (Organizations)
-- Top-level entity representing a customer organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,    -- Account-wide settings
  subscription_tier subscription_tier DEFAULT 'free_shopify',
  subscription_id TEXT,                  -- Reference to Stripe subscription
  audit_log_retention_days INTEGER DEFAULT 90,
  raw_event_retention_days INTEGER DEFAULT 90,
  custom_domain TEXT,                    -- For white-label enterprise accounts
  data_region data_region NOT NULL DEFAULT 'us',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- ACCOUNT_USERS (Join table for account memberships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'analyst',
  is_owner BOOLEAN DEFAULT FALSE,
  invited_by UUID REFERENCES users(id),
  invite_accepted_at TIMESTAMPTZ,
  invite_token TEXT,                     -- For pending invitations
  invite_expires_at TIMESTAMPTZ,         -- Invitation expiry timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, user_id)            -- User can only be in an account once
);

CREATE TRIGGER account_users_updated_at
BEFORE UPDATE ON account_users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- SITES TABLE
-- Represents a merchant website connected to the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending_verification',
  is_production BOOLEAN DEFAULT TRUE,    -- False for staging environments
  verification_token TEXT,
  embed_code TEXT,                       -- Generated JS snippet
  settings JSONB DEFAULT '{}'::jsonb,    -- Site-specific settings
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, domain)             -- One unique domain per account
);

CREATE TRIGGER sites_updated_at
BEFORE UPDATE ON sites
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Indexes
CREATE INDEX idx_sites_account_id ON sites(account_id);
CREATE INDEX idx_sites_domain ON sites(domain);

-- ============================================================================
-- SITE_VERIFICATIONS TABLE
-- Tracks verification attempts for site ownership
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  method verification_method NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending_verification',
  verification_data JSONB,
  verified_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER site_verifications_updated_at
BEFORE UPDATE ON site_verifications
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- TEMPLATES TABLE
-- Notification templates for styling notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_built_in BOOLEAN DEFAULT FALSE,     -- System-provided templates
  html_content TEXT,                     -- HTML structure
  css_content TEXT,                      -- CSS styling
  preview_image_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,    -- Template-specific settings
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER templates_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Index for faster template lookup
CREATE INDEX idx_templates_account_site ON templates(account_id, site_id);

-- ============================================================================
-- TRANSLATIONS TABLE
-- Supports internationalization of notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,           -- e.g., 'en', 'fr', 'es'
  namespace TEXT NOT NULL,               -- Grouping for translations, e.g., 'notifications', 'emails'
  key TEXT NOT NULL,                     -- Translation key
  value TEXT NOT NULL,                   -- Translated content
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, language_code, namespace, key) -- Unique translation per site/language/namespace/key
);

CREATE TRIGGER translations_updated_at
BEFORE UPDATE ON translations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Indexes
CREATE INDEX idx_translations_site_lang ON translations(site_id, language_code);
CREATE INDEX idx_translations_account ON translations(account_id);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- Main notification campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status notification_status NOT NULL DEFAULT 'draft',
  template_id UUID REFERENCES templates(id),
  channels notification_channel[] NOT NULL DEFAULT '{web_popup}',
  targeting_rules JSONB,                 -- JSON blob of targeting rules (geo, UTM, behavior)
  dynamic_variables JSONB,               -- Variables like {{name}}, {{product}}
  schedule JSONB,                        -- Schedule data for non-immediate notifications
  ai_optimized_timing BOOLEAN DEFAULT FALSE, -- Whether to use AI to determine send time
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  start_at TIMESTAMPTZ,                  -- When to start showing notifications
  end_at TIMESTAMPTZ                     -- When to stop showing notifications
);

CREATE TRIGGER notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Indexes
CREATE INDEX idx_notifications_site ON notifications(site_id);
CREATE INDEX idx_notifications_account ON notifications(account_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- ============================================================================
-- AB_TESTS TABLE
-- Tracks different variant configurations being tested
-- ============================================================================
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status ab_test_status NOT NULL DEFAULT 'running',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  traffic_allocation REAL NOT NULL DEFAULT 1.0, -- 0.0 to 1.0 representing percentage
  winner_variant_id UUID REFERENCES ab_test_variants(id),
  winner_selected_at TIMESTAMPTZ,
  winner_selected_by UUID REFERENCES users(id),
  auto_optimize BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER ab_tests_updated_at
BEFORE UPDATE ON ab_tests
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- AB_TEST_VARIANTS TABLE
-- Individual variants in an A/B test
-- ============================================================================
CREATE TABLE IF NOT EXISTS ab_test_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., "Variant A", "Green Button", etc.
  description TEXT,
  content JSONB NOT NULL,                -- Variant-specific content/styling
  traffic_allocation FLOAT NOT NULL DEFAULT 0.5, -- Traffic percentage (between 0 and 1)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER ab_test_variants_updated_at
BEFORE UPDATE ON ab_test_variants
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- NOTIFICATION_EVENTS TABLE
-- Time-series data for notification events (partitioned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  notification_id UUID,                  -- Can be NULL for general site events
  variant_id UUID,                       -- A/B test variant (if applicable)
  event_type TEXT NOT NULL,              -- 'impression', 'click', 'conversion', etc.
  user_id TEXT,                          -- Website visitor ID (anonymous)
  session_id TEXT,                       -- Website visitor session
  geo_data JSONB,                        -- Country, city, region data
  device_data JSONB,                     -- Browser, OS, device info
  referrer TEXT,                         -- Where the user came from
  url TEXT,                              -- Page URL when event occurred
  metadata JSONB,                        -- Additional event data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitioning function
CREATE OR REPLACE FUNCTION create_notification_events_partition()
RETURNS TRIGGER AS $$
DECLARE
  partition_date TEXT;
  partition_name TEXT;
BEGIN
  -- Format: notification_events_YYYY_MM
  partition_date := TO_CHAR(NEW.created_at, 'YYYY_MM');
  partition_name := 'notification_events_' || partition_date;
  
  -- Create partition if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF notification_events
       FOR VALUES FROM (%L) TO (%L)
       PARTITION BY HASH (site_id);',
      partition_name,
      date_trunc('month', NEW.created_at),
      date_trunc('month', NEW.created_at) + interval '1 month'
    );
    
    -- Create 8 hash partitions for each site_id
    FOR i IN 0..7 LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES WITH (MODULUS 8, REMAINDER %s);',
        partition_name || '_site_' || i,
        partition_name,
        i
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create partitions
CREATE TRIGGER notification_events_insert_trigger
BEFORE INSERT ON notification_events
FOR EACH ROW
EXECUTE FUNCTION create_notification_events_partition();

-- Create initial monthly partition for current month
DO $$
DECLARE
  current_month_start DATE := date_trunc('month', CURRENT_DATE);
  next_month_start DATE := current_month_start + interval '1 month';
  partition_name TEXT := 'notification_events_' || TO_CHAR(CURRENT_DATE, 'YYYY_MM');
BEGIN
  -- Create monthly partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF notification_events
     FOR VALUES FROM (%L) TO (%L)
     PARTITION BY HASH (site_id);',
    partition_name,
    current_month_start,
    next_month_start
  );
  
  -- Create hash partitions for site_id
  FOR i IN 0..7 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
       FOR VALUES WITH (MODULUS 8, REMAINDER %s);',
      partition_name || '_site_' || i,
      partition_name,
      i
    );
  END LOOP;
END $$;

-- Create indexes on the parent table (inherited by partitions)
CREATE INDEX idx_notification_events_site_id ON notification_events(site_id, created_at);
CREATE INDEX idx_notification_events_notification_id ON notification_events(notification_id, created_at);
CREATE INDEX idx_notification_events_event_type ON notification_events(event_type, created_at);

-- ============================================================================
-- BILLING_INVOICES TABLE
-- Tracks billing invoices for accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'draft',
  billing_reason TEXT,                   -- 'subscription_create', 'subscription_update', etc.
  invoice_pdf_url TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  subscription_tier subscription_tier,
  line_items JSONB,                      -- Detailed breakdown of charges
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER billing_invoices_updated_at
BEFORE UPDATE ON billing_invoices
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Indexes
CREATE INDEX idx_billing_invoices_account ON billing_invoices(account_id);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- For tracking important system events for compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                  -- 'create', 'update', 'delete', 'login', etc.
  entity_type TEXT NOT NULL,             -- 'user', 'site', 'notification', etc.
  entity_id UUID,                        -- ID of the affected entity
  metadata JSONB,                        -- Additional context about the action
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_account ON audit_logs(account_id, created_at);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- INTEGRATIONS TABLE
-- Stores third-party integration configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                -- 'shopify', 'woocommerce', 'zapier', etc.
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  credentials JSONB,                     -- IMPORTANT: Encrypted at rest
  settings JSONB DEFAULT '{}'::jsonb,    -- Integration-specific settings
  webhook_url TEXT,                      -- For receiving events from third-party
  webhook_secret TEXT,                   -- HMAC signing key
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER integrations_updated_at
BEFORE UPDATE ON integrations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- WEBHOOK_DELIVERIES TABLE
-- Tracks the lifecycle of outbound webhook notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  event_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
  webhook_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB NOT NULL,
  status webhook_delivery_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER webhook_deliveries_updated_at
BEFORE UPDATE ON webhook_deliveries
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX idx_webhook_deliveries_integration ON webhook_deliveries(integration_id);

-- ============================================================================
-- VISITOR_PROFILES TABLE
-- Stores denormalized, anonymized visitor data for targeting
-- ============================================================================
CREATE TABLE IF NOT EXISTS visitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 1,
  total_page_views INTEGER NOT NULL DEFAULT 0,
  total_notifications_seen INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  countries TEXT[],
  devices TEXT[],
  referrers TEXT[],
  tags JSONB DEFAULT '{}'::jsonb,
  utm_sources TEXT[],
  behavior_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, visitor_id)
);

CREATE TRIGGER visitor_profiles_updated_at
BEFORE UPDATE ON visitor_profiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_visitor_profiles_site_visitor ON visitor_profiles(site_id, visitor_id);
CREATE INDEX idx_visitor_profiles_behavior ON visitor_profiles(site_id, behavior_score);

-- ============================================================================
-- CUSTOM FIELDS TABLES
-- Allows merchants to define and use custom fields in notifications
-- ============================================================================
CREATE TYPE custom_field_type AS ENUM (
  'text',
  'number',
  'boolean',
  'date',
  'select',
  'multi_select',
  'json'
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  field_type custom_field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  default_value TEXT,
  options JSONB, -- For select/multi-select types
  validation_rules JSONB,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, site_id, key)
);

CREATE TRIGGER custom_field_definitions_updated_at
BEFORE UPDATE ON custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'notification', 'template', etc.
  entity_id UUID NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_definition_id, entity_type, entity_id)
);

CREATE TRIGGER custom_field_values_updated_at
BEFORE UPDATE ON custom_field_values
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_custom_field_values_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_custom_field_definitions_account ON custom_field_definitions(account_id, site_id);

-- ============================================================================
-- SECURITY & COMPLIANCE ENHANCEMENTS
-- Field-level encryption and key management
-- ============================================================================

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management table
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  key_identifier TEXT NOT NULL UNIQUE,
  key_material BYTEA NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

-- Create encryption and decryption functions
CREATE OR REPLACE FUNCTION encrypt_column_value(value TEXT, key_id UUID)
RETURNS BYTEA AS $$
DECLARE
  encryption_key BYTEA;
  encrypted_value BYTEA;
BEGIN
  -- Get the encryption key material
  SELECT key_material INTO encryption_key
  FROM encryption_keys
  WHERE id = key_id AND active = TRUE;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found or not active';
  END IF;
  
  -- Perform encryption using pgcrypto
  encrypted_value := pgp_sym_encrypt(value, encode(encryption_key, 'hex'));
  
  RETURN encrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_column_value(encrypted_value BYTEA, key_id UUID)
RETURNS TEXT AS $$
DECLARE
  encryption_key BYTEA;
  decrypted_text TEXT;
BEGIN
  -- Get the encryption key material
  SELECT key_material INTO encryption_key
  FROM encryption_keys
  WHERE id = key_id;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Perform decryption using pgcrypto
  decrypted_text := pgp_sym_decrypt(encrypted_value, encode(encryption_key, 'hex'));
  
  RETURN decrypted_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on the PII encryption approach
COMMENT ON TABLE users IS 'User account information with PII fields encrypted at rest.
The email and full_name fields are stored only in encrypted form (email_encrypted and full_name_encrypted).
To access these values, use the get_user_email() and get_user_full_name() functions.
For inserts/updates, provide email and full_name as parameters, and triggers will handle encryption.';

-- ============================================================================
-- ACCESS CONTROL FRAMEWORK
-- Fine-grained permissions beyond basic roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource_type TEXT NOT NULL, -- 'notification', 'site', 'billing', etc.
  action TEXT NOT NULL, -- 'read', 'write', 'delete', 'manage', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_id, permission_id)
);

CREATE INDEX idx_user_permissions_user_account ON user_permissions(user_id, account_id);

-- Helper function to check permissions
CREATE OR REPLACE FUNCTION user_has_permission(
  check_user_id UUID,
  check_account_id UUID,
  check_resource_type TEXT,
  check_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_role user_role;
  has_permission BOOLEAN;
BEGIN
  -- Get user's role in the account
  SELECT role INTO user_role
  FROM account_users
  WHERE user_id = check_user_id AND account_id = check_account_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the role has the permission
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = user_role
    AND p.resource_type = check_resource_type
    AND p.action = check_action
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- Check if the user has an explicit permission grant
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = check_user_id
    AND up.account_id = check_account_id
    AND p.resource_type = check_resource_type
    AND p.action = check_action
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA RESIDENCY CONTROLS
-- Regional data storage for compliance
-- ============================================================================
CREATE TYPE data_region AS ENUM (
  'us',
  'eu',
  'ap',
  'global'
);

-- Function to verify data residency compliance
CREATE OR REPLACE FUNCTION verify_data_residency(account_id UUID, target_region data_region)
RETURNS BOOLEAN AS $$
DECLARE
  account_region data_region;
BEGIN
  SELECT data_region INTO account_region
  FROM accounts
  WHERE id = account_id;
  
  IF account_region = target_region OR account_region = 'global' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WEBHOOK TEMPLATES
-- Transformation system for webhook payloads
-- ============================================================================
CREATE TYPE transformation_format AS ENUM (
  'json',
  'xml',
  'form',
  'text'
);

CREATE TABLE IF NOT EXISTS webhook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  input_format transformation_format NOT NULL DEFAULT 'json',
  output_format transformation_format NOT NULL DEFAULT 'json',
  template_content TEXT NOT NULL,
  sample_input JSONB,
  sample_output TEXT,
  headers JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER webhook_templates_updated_at
BEFORE UPDATE ON webhook_templates
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_webhook_templates_account ON webhook_templates(account_id);

-- Link templates to integrations
ALTER TABLE integrations ADD COLUMN webhook_template_id UUID REFERENCES webhook_templates(id);

-- ============================================================================
-- INTEGRATION MARKETPLACE
-- Catalog of available integrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS integration_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_definition JSONB NOT NULL, -- Required fields, auth methods, etc.
  documentation_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, version)
);

CREATE TRIGGER integration_definitions_updated_at
BEFORE UPDATE ON integration_definitions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE IF NOT EXISTS integration_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_definition_id UUID NOT NULL REFERENCES integration_definitions(id) ON DELETE CASCADE,
  min_app_version TEXT,
  max_app_version TEXT,
  subscription_tier subscription_tier[], -- Which tiers have access
  features_required TEXT[], -- App features required
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER integration_compatibility_updated_at
BEFORE UPDATE ON integration_compatibility
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE IF NOT EXISTS integration_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_definition_id UUID NOT NULL REFERENCES integration_definitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  screenshots TEXT[],
  featured_order INTEGER,
  pricing_model TEXT,
  pricing_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER integration_marketplace_listings_updated_at
BEFORE UPDATE ON integration_marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Link integrations to definitions
ALTER TABLE integrations ADD COLUMN integration_definition_id UUID REFERENCES integration_definitions(id);

-- ============================================================================
-- DATABASE MONITORING
-- Track query performance and index usage
-- ============================================================================
CREATE TABLE IF NOT EXISTS db_query_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_at TIMESTAMPTZ NOT NULL,
  query_id BIGINT NOT NULL, -- pg_stat_statements.queryid
  query TEXT NOT NULL,
  calls BIGINT NOT NULL,
  total_time DOUBLE PRECISION NOT NULL,
  min_time DOUBLE PRECISION NOT NULL,
  max_time DOUBLE PRECISION NOT NULL,
  mean_time DOUBLE PRECISION NOT NULL,
  stddev_time DOUBLE PRECISION NOT NULL,
  rows BIGINT NOT NULL,
  shared_blks_hit BIGINT NOT NULL,
  shared_blks_read BIGINT NOT NULL,
  shared_blks_dirtied BIGINT NOT NULL,
  shared_blks_written BIGINT NOT NULL,
  local_blks_hit BIGINT NOT NULL,
  local_blks_read BIGINT NOT NULL,
  local_blks_dirtied BIGINT NOT NULL,
  local_blks_written BIGINT NOT NULL,
  temp_blks_read BIGINT NOT NULL,
  temp_blks_written BIGINT NOT NULL,
  blk_read_time DOUBLE PRECISION NOT NULL,
  blk_write_time DOUBLE PRECISION NOT NULL
);

CREATE INDEX idx_db_query_stats_collected ON db_query_stats(collected_at);
CREATE INDEX idx_db_query_stats_query_id ON db_query_stats(query_id);

CREATE TABLE IF NOT EXISTS db_index_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_at TIMESTAMPTZ NOT NULL,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  index_name TEXT NOT NULL,
  idx_scan BIGINT NOT NULL,
  idx_tup_read BIGINT NOT NULL,
  idx_tup_fetch BIGINT NOT NULL,
  idx_blks_read BIGINT NOT NULL,
  idx_blks_hit BIGINT NOT NULL,
  table_size BIGINT NOT NULL,
  index_size BIGINT NOT NULL
);

CREATE INDEX idx_db_index_usage_collected ON db_index_usage(collected_at);
CREATE INDEX idx_db_index_usage_table ON db_index_usage(schema_name, table_name);

-- ============================================================================
-- ARCHIVAL FRAMEWORK
-- Manage data retention and archiving
-- ============================================================================
CREATE TYPE archival_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'restoring'
);

CREATE TABLE IF NOT EXISTS archival_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  archive_type TEXT NOT NULL, -- 's3', 'glacier', 'delete'
  schedule_expression TEXT, -- cron expression
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER archival_policies_updated_at
BEFORE UPDATE ON archival_policies
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TABLE IF NOT EXISTS archival_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES archival_policies(id) ON DELETE SET NULL,
  status archival_status NOT NULL DEFAULT 'pending',
  table_name TEXT NOT NULL,
  where_clause TEXT NOT NULL,
  estimated_rows BIGINT,
  processed_rows BIGINT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER archival_jobs_updated_at
BEFORE UPDATE ON archival_jobs
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_archival_jobs_status ON archival_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS archived_data_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES archival_jobs(id) ON DELETE CASCADE,
  storage_type TEXT NOT NULL, -- 's3', 'glacier'
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  record_count BIGINT NOT NULL,
  metadata JSONB,
  checksum TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_archived_data_locations_job ON archived_data_locations(job_id);

-- Enable Row Level Security for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_query_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_index_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE archival_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE archival_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_data_locations ENABLE ROW LEVEL SECURITY;

-- Add notice about creating RLS policies
COMMENT ON SCHEMA public IS 'Default schema for Fomo-style notification platform. 
IMPORTANT: Create appropriate RLS policies for each table to isolate tenant data.';

-- Comment about TimescaleDB extension
COMMENT ON TABLE notification_events IS 'Consider using TimescaleDB hypertable for better time-series performance.
Example: SELECT create_hypertable(''notification_events'', ''created_at'', chunk_time_interval => interval ''1 day'');';

-- Comments on extended functionality
COMMENT ON TYPE webhook_delivery_status IS 'Tracks the lifecycle of outbound webhook notifications to third-party systems';
COMMENT ON TABLE visitor_profiles IS 'Stores aggregated visitor behavior data for advanced targeting';
COMMENT ON TABLE custom_field_definitions IS 'Allows merchants to define their own custom fields for notifications';
COMMENT ON FUNCTION encrypt_pii IS 'Provides field-level encryption for sensitive data using pgcrypto';
COMMENT ON TABLE permissions IS 'Enables fine-grained access control beyond role-based permissions';
COMMENT ON TABLE webhook_templates IS 'Transformation system for adapting notification data to external systems';
COMMENT ON TABLE integration_definitions IS 'Defines available third-party integrations for the marketplace';
COMMENT ON TABLE db_query_stats IS 'Stores query performance metrics for monitoring and optimization';
COMMENT ON TABLE archival_policies IS 'Manages data retention and archival to S3/Glacier'; 