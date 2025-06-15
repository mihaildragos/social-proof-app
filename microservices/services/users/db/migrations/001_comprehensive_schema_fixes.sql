-- Comprehensive Schema Fixes for Users Service
-- Consolidates all schema compatibility fixes into one migration

-- =============================================================================
-- PART 1: Add Compatibility Columns
-- =============================================================================

-- Add firstName, lastName, and organizationId columns expected by Prisma schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add additional columns expected by the service code
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Add encryption key ID columns for PII encryption
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_encryption_key_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name_encryption_key_id TEXT;

-- =============================================================================
-- PART 2: Create Supporting Tables
-- =============================================================================

-- Create organization_members table for many-to-many relationship
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 3: Create Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);

-- =============================================================================
-- PART 4: Create Update Triggers
-- =============================================================================

-- Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
    DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
    
    CREATE TRIGGER update_organization_members_updated_at 
      BEFORE UPDATE ON organization_members 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_organizations_updated_at 
      BEFORE UPDATE ON organizations 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =============================================================================
-- PART 5: Name Field Synchronization
-- =============================================================================

-- Create trigger function to sync encrypted and plain name fields
CREATE OR REPLACE FUNCTION sync_name_fields() 
RETURNS TRIGGER AS $$
BEGIN
    -- When first_name or last_name is updated, update full_name_encrypted
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If plain name fields are provided, use them to update encrypted field
        IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
            -- Only encrypt if pgcrypto is available
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
                NEW.full_name_encrypted = pgp_sym_encrypt(
                    COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''), 
                    'encryption_key'
                );
            END IF;
        END IF;
        
        -- If encrypted field is being updated and plain fields are empty, try to decrypt
        IF NEW.full_name_encrypted IS NOT NULL AND 
           (NEW.first_name IS NULL AND NEW.last_name IS NULL) AND
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
            DECLARE
                decrypted_name TEXT;
                name_parts TEXT[];
            BEGIN
                decrypted_name := pgp_sym_decrypt(NEW.full_name_encrypted, 'encryption_key');
                name_parts := string_to_array(decrypted_name, ' ');
                
                IF array_length(name_parts, 1) >= 1 THEN
                    NEW.first_name := name_parts[1];
                END IF;
                
                IF array_length(name_parts, 1) >= 2 THEN
                    NEW.last_name := name_parts[2];
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Ignore decryption errors
                NULL;
            END;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for name synchronization
DO $$
BEGIN
    DROP TRIGGER IF EXISTS sync_names ON users;
    CREATE TRIGGER sync_names 
        BEFORE INSERT OR UPDATE ON users 
        FOR EACH ROW 
        EXECUTE FUNCTION sync_name_fields();
END $$;

-- =============================================================================
-- PART 6: Data Migration and Compatibility
-- =============================================================================

-- Update existing users to have organization_id for backward compatibility
UPDATE users SET organization_id = id WHERE organization_id IS NULL;

-- Create default organization memberships for existing users
INSERT INTO organization_members (user_id, organization_id, role)
SELECT u.id, u.organization_id, 'owner'
FROM users u
WHERE u.organization_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.user_id = u.id AND om.organization_id = u.organization_id
);

-- =============================================================================
-- PART 7: Helper Functions
-- =============================================================================

-- Create function to get user's primary organization
CREATE OR REPLACE FUNCTION get_user_primary_organization(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    primary_org_id UUID;
BEGIN
    -- First try direct organization_id
    SELECT organization_id INTO primary_org_id
    FROM users
    WHERE id = user_uuid AND organization_id IS NOT NULL;
    
    -- If not found, get from organization_members with highest role
    IF primary_org_id IS NULL THEN
        SELECT organization_id INTO primary_org_id
        FROM organization_members
        WHERE user_id = user_uuid
        ORDER BY 
            CASE role 
                WHEN 'owner' THEN 1 
                WHEN 'admin' THEN 2 
                WHEN 'member' THEN 3 
                WHEN 'viewer' THEN 4 
            END,
            joined_at ASC
        LIMIT 1;
    END IF;
    
    RETURN primary_org_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
    user_uuid UUID,
    org_uuid UUID,
    required_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    role_level INTEGER;
    required_level INTEGER;
BEGIN
    -- Get user's role in the organization
    SELECT role INTO user_role
    FROM organization_members
    WHERE user_id = user_uuid AND organization_id = org_uuid;
    
    -- If no membership found, check direct organization_id
    IF user_role IS NULL THEN
        SELECT 
            CASE 
                WHEN organization_id = org_uuid AND role IS NOT NULL THEN role
                ELSE 'viewer'
            END INTO user_role
        FROM users
        WHERE id = user_uuid;
    END IF;
    
    -- Convert roles to numeric levels for comparison
    role_level := CASE user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    required_level := CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    RETURN role_level >= required_level;
END;
$$ LANGUAGE plpgsql;