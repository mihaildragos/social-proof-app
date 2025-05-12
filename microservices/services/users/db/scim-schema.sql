-- SCIM Provisioning Schema Extensions

-- SCIM Tokens for authentication
CREATE TABLE scim_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- SCIM Groups for mapping to roles
CREATE TABLE scim_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  display_name TEXT NOT NULL,
  description TEXT,
  role TEXT NOT NULL, -- Maps to internal role
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_display_name UNIQUE (organization_id, display_name),
  CONSTRAINT unique_org_external_id UNIQUE (organization_id, external_id) DEFERRABLE INITIALLY DEFERRED
);

-- SCIM user mappings
CREATE TABLE scim_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  scim_username TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_external_id UNIQUE (organization_id, external_id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT unique_org_username UNIQUE (organization_id, scim_username)
);

-- SCIM group memberships
CREATE TABLE scim_user_groups (
  user_id UUID NOT NULL REFERENCES scim_users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- SCIM operations audit
CREATE TABLE scim_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  resource_type TEXT NOT NULL, -- 'User', 'Group'
  resource_id TEXT NOT NULL,
  performed_by TEXT, -- Token description or user ID
  request_payload JSONB,
  response_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_scim_tokens_org_id ON scim_tokens(organization_id);
CREATE INDEX idx_scim_tokens_token ON scim_tokens(token);
CREATE INDEX idx_scim_groups_org_id ON scim_groups(organization_id);
CREATE INDEX idx_scim_users_user_id ON scim_users(user_id);
CREATE INDEX idx_scim_users_org_id ON scim_users(organization_id);
CREATE INDEX idx_scim_audit_logs_org_id ON scim_audit_logs(organization_id);
CREATE INDEX idx_scim_audit_logs_resource ON scim_audit_logs(resource_type, resource_id);

-- Add RLS policies
ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY scim_tokens_org_access ON scim_tokens
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY scim_groups_org_access ON scim_groups
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY scim_users_org_access ON scim_users
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY scim_user_groups_access ON scim_user_groups
  FOR ALL USING (
    group_id IN (
      SELECT id FROM scim_groups WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
      )
    )
  );

CREATE POLICY scim_audit_logs_org_access ON scim_audit_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  ); 