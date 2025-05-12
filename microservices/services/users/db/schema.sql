-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Create extension for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table to store encryption keys for PII fields
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE
);

-- Users with PII encryption
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_encrypted BYTEA NOT NULL,
  email_encryption_key_id UUID REFERENCES encryption_keys(id),
  full_name_encrypted BYTEA,
  full_name_encryption_key_id UUID REFERENCES encryption_keys(id),
  hashed_password TEXT,
  auth_provider TEXT,
  auth_provider_id TEXT,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  preferred_language TEXT DEFAULT 'en',
  preferred_timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  account_status TEXT DEFAULT 'active',
  CONSTRAINT unique_auth_provider_id UNIQUE (auth_provider, auth_provider_id)
);

-- Organizations for multi-tenant support
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data_region TEXT DEFAULT 'us',
  settings JSONB DEFAULT '{}'::jsonb
);

-- User to organization mapping with roles
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_per_org UNIQUE (user_id, organization_id)
);

-- Invitations for team members
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  CONSTRAINT unique_invitation UNIQUE (organization_id, email)
);

-- Detailed permissions for RBAC
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_permission UNIQUE (resource, action)
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Audit logging for security tracking
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security functions for PII handling
CREATE OR REPLACE FUNCTION encrypt_pii(
  p_plaintext TEXT,
  OUT encrypted_value BYTEA,
  OUT key_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
  v_key_record encryption_keys%ROWTYPE;
BEGIN
  -- Get the latest active encryption key
  SELECT * INTO v_key_record FROM encryption_keys WHERE active = TRUE ORDER BY created_at DESC LIMIT 1;
  
  -- If no active key exists, create one
  IF v_key_record IS NULL THEN
    INSERT INTO encryption_keys (key_value) VALUES (encode(gen_random_bytes(32), 'hex')) RETURNING * INTO v_key_record;
  END IF;
  
  -- Encrypt the value
  encrypted_value := pgp_sym_encrypt(p_plaintext, v_key_record.key_value);
  key_id := v_key_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_pii(
  p_encrypted BYTEA,
  p_key_id UUID
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_key_value TEXT;
  v_plaintext TEXT;
BEGIN
  -- Get the encryption key
  SELECT key_value INTO v_key_value FROM encryption_keys WHERE id = p_key_id;
  
  IF v_key_value IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Decrypt the value
  v_plaintext := pgp_sym_decrypt(p_encrypted, v_key_value);
  RETURN v_plaintext;
END;
$$;

-- Helper functions for PII
CREATE OR REPLACE FUNCTION get_user_email(
  p_user_id UUID
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT decrypt_pii(email_encrypted, email_encryption_key_id) INTO v_email 
  FROM users WHERE id = p_user_id;
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_full_name(
  p_user_id UUID
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  SELECT decrypt_pii(full_name_encrypted, full_name_encryption_key_id) INTO v_full_name 
  FROM users WHERE id = p_user_id;
  RETURN v_full_name;
END;
$$;

-- Triggers for PII encryption
CREATE OR REPLACE FUNCTION encrypt_user_pii()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_email_result RECORD;
  v_name_result RECORD;
BEGIN
  -- Only process if there's an email to encrypt
  IF NEW.email IS NOT NULL THEN
    SELECT * INTO v_email_result FROM encrypt_pii(NEW.email);
    NEW.email_encrypted := v_email_result.encrypted_value;
    NEW.email_encryption_key_id := v_email_result.key_id;
    NEW.email := NULL; -- Remove plaintext
  END IF;
  
  -- Only process if there's a full name to encrypt
  IF NEW.full_name IS NOT NULL THEN
    SELECT * INTO v_name_result FROM encrypt_pii(NEW.full_name);
    NEW.full_name_encrypted := v_name_result.encrypted_value;
    NEW.full_name_encryption_key_id := v_name_result.key_id;
    NEW.full_name := NULL; -- Remove plaintext
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add a temporary column for plaintext email and name during inserts
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create the trigger on users table
CREATE TRIGGER encrypt_user_pii_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION encrypt_user_pii();

-- Create indexes for common queries
CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for organization access
CREATE POLICY organization_member_select ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = current_user_id()
    )
  );

CREATE POLICY organization_member_access ON organization_members
  FOR ALL USING (
    user_id = current_user_id() OR 
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

-- Create function to get current user ID (to be implemented in application)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_user_id', TRUE)::UUID;
$$; 