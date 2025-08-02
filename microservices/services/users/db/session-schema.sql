-- User Sessions Schema
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Token Blacklist for revoked JWTs
CREATE TABLE token_blacklist (
  token_id TEXT PRIMARY KEY, -- JWT jti claim
  blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- User Activity Log
CREATE TABLE user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- Add indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_org_id ON user_sessions(organization_id);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);

CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_org_id ON user_activity_logs(organization_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX idx_user_activity_logs_action_resource ON user_activity_logs(action, resource_type);

-- Add RLS policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for user sessions
CREATE POLICY user_sessions_user_access ON user_sessions
  FOR ALL USING (
    user_id = current_user_id() OR
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

-- RLS policies for user activity logs
CREATE POLICY user_activity_logs_user_access ON user_activity_logs
  FOR SELECT USING (
    user_id = current_user_id() OR
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

-- Cleanup function to remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM token_blacklist WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create cron job to clean up expired tokens (requires pg_cron extension)
-- Uncomment if pg_cron is available
-- SELECT cron.schedule('0 0 * * *', 'SELECT cleanup_expired_tokens()');

-- Audit trigger function for session changes
CREATE OR REPLACE FUNCTION audit_session_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    INSERT INTO user_activity_logs (
      user_id, organization_id, action, 
      resource_type, resource_id
    ) VALUES (
      NEW.user_id, NEW.organization_id, 'logout', 
      'session', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session auditing
CREATE TRIGGER session_audit_trigger
AFTER UPDATE ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION audit_session_changes(); 