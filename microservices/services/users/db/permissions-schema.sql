-- Permissions Schema for Role-Based Access Control

-- Roles table (predefined roles like admin, user, viewer, etc.)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES 
  ('owner', 'Organization owner with full permissions'),
  ('admin', 'Administrator with most permissions'),
  ('manager', 'Manager with elevated permissions'),
  ('user', 'Regular user with standard permissions'),
  ('viewer', 'Read-only access user');

-- Permissions table (granular permissions like read:users, write:notifications, etc.)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_resource_action UNIQUE (resource, action)
);

-- Insert common permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  ('read:users', 'users', 'read', 'Read user information'),
  ('write:users', 'users', 'write', 'Create or update users'),
  ('delete:users', 'users', 'delete', 'Delete users'),
  ('read:organizations', 'organizations', 'read', 'Read organization information'),
  ('write:organizations', 'organizations', 'write', 'Create or update organizations'),
  ('delete:organizations', 'organizations', 'delete', 'Delete organizations'),
  ('read:notifications', 'notifications', 'read', 'Read notifications'),
  ('write:notifications', 'notifications', 'write', 'Create or update notifications'),
  ('delete:notifications', 'notifications', 'delete', 'Delete notifications'),
  ('read:analytics', 'analytics', 'read', 'View analytics data'),
  ('read:billing', 'billing', 'read', 'View billing information'),
  ('write:billing', 'billing', 'write', 'Update billing information'),
  ('invite:members', 'members', 'invite', 'Invite organization members'),
  ('remove:members', 'members', 'remove', 'Remove organization members'),
  ('manage:roles', 'roles', 'manage', 'Manage role assignments');

-- Role-Permission mapping table
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Assign permissions to default roles
-- Owner gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'owner'),
  id
FROM permissions;

-- Admin gets most permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions;

-- Manager gets operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'manager'),
  id
FROM permissions
WHERE 
  name IN (
    'read:users', 'write:users', 
    'read:organizations', 
    'read:notifications', 'write:notifications', 'delete:notifications',
    'read:analytics', 'read:billing',
    'invite:members'
  );

-- Regular users get basic permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'user'),
  id
FROM permissions
WHERE 
  name IN (
    'read:users',
    'read:organizations',
    'read:notifications', 'write:notifications',
    'read:analytics'
  );

-- Viewers get read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'viewer'),
  id
FROM permissions
WHERE 
  name IN (
    'read:users',
    'read:organizations',
    'read:notifications',
    'read:analytics'
  );

-- User-Permission table for custom permission assignments
CREATE TABLE user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_id, organization_id)
);

-- Create indexes for performance
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_org_id ON user_permissions(organization_id);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Roles are visible to all authenticated users
CREATE POLICY roles_visibility ON roles
  FOR SELECT USING (true);

-- Permissions are visible to all authenticated users
CREATE POLICY permissions_visibility ON permissions
  FOR SELECT USING (true);

-- Role-permission mappings are visible to all authenticated users
CREATE POLICY role_permissions_visibility ON role_permissions
  FOR SELECT USING (true);

-- User permissions are protected
CREATE POLICY user_permissions_user_access ON user_permissions
  FOR SELECT USING (
    user_id = current_user_id() OR
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY user_permissions_admin_access ON user_permissions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = current_user_id() AND role IN ('admin', 'owner')
    )
  );

-- Function to get permissions for a user in an organization
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_organization_id UUID)
RETURNS TABLE (permission_name TEXT) AS $$
BEGIN
  RETURN QUERY
  -- Get permissions from user's role
  SELECT DISTINCT p.name
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id
  JOIN roles r ON rp.role_id = r.id
  JOIN organization_members om ON r.name = om.role
  WHERE om.user_id = p_user_id AND om.organization_id = p_organization_id
  
  UNION
  
  -- Get directly assigned permissions
  SELECT p.name
  FROM permissions p
  JOIN user_permissions up ON p.id = up.permission_id
  WHERE up.user_id = p_user_id AND up.organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql; 