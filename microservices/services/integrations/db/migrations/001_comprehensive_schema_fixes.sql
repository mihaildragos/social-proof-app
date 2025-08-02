-- Comprehensive Schema Fixes for Integrations Service
-- Consolidates all schema compatibility fixes into one migration

-- =============================================================================
-- PART 1: Add Service Compatibility Columns
-- =============================================================================

-- Add compatibility columns to integrations table
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS provider_account_id TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- =============================================================================
-- PART 2: Create Missing Tables Expected by Service Code
-- =============================================================================

-- Create webhook_events table that WebhookService expects
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  topic TEXT NOT NULL,
  payload JSONB,
  headers JSONB,
  signature TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'retrying')),
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 3: Create Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_provider_account_id ON integrations(provider_account_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_topic ON webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

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

-- Create trigger for webhook_events
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;
    
    CREATE TRIGGER update_webhook_events_updated_at 
      BEFORE UPDATE ON webhook_events 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =============================================================================
-- PART 5: Data Migration and Compatibility
-- =============================================================================

-- Copy provider information from integration_types to provider column for existing records
UPDATE integrations 
SET provider = (
  SELECT name 
  FROM integration_types 
  WHERE integration_types.id = integrations.integration_type_id
)
WHERE provider IS NULL
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_types');

-- =============================================================================
-- PART 6: OAuth Token Sync Functions
-- =============================================================================

-- Create function to sync OAuth tokens between tables
CREATE OR REPLACE FUNCTION sync_oauth_tokens() 
RETURNS TRIGGER AS $$
BEGIN
    -- When integrations table is updated with OAuth tokens, sync to integration_oauth table
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If OAuth tokens are provided in the main table, sync to oauth table (if it exists)
        IF NEW.access_token IS NOT NULL OR NEW.refresh_token IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_oauth') THEN
                INSERT INTO integration_oauth (
                    integration_id,
                    access_token_encrypted,
                    refresh_token_encrypted,
                    expires_at,
                    scope,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    CASE WHEN NEW.access_token IS NOT NULL 
                         THEN pgp_sym_encrypt(NEW.access_token, 'oauth_encryption_key') 
                         ELSE NULL END,
                    CASE WHEN NEW.refresh_token IS NOT NULL 
                         THEN pgp_sym_encrypt(NEW.refresh_token, 'oauth_encryption_key') 
                         ELSE NULL END,
                    NEW.expires_at,
                    NEW.scope,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (integration_id) DO UPDATE SET
                    access_token_encrypted = CASE WHEN NEW.access_token IS NOT NULL 
                                                  THEN pgp_sym_encrypt(NEW.access_token, 'oauth_encryption_key') 
                                                  ELSE integration_oauth.access_token_encrypted END,
                    refresh_token_encrypted = CASE WHEN NEW.refresh_token IS NOT NULL 
                                                   THEN pgp_sym_encrypt(NEW.refresh_token, 'oauth_encryption_key') 
                                                   ELSE integration_oauth.refresh_token_encrypted END,
                    expires_at = COALESCE(NEW.expires_at, integration_oauth.expires_at),
                    scope = COALESCE(NEW.scope, integration_oauth.scope),
                    updated_at = NOW();
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync OAuth tokens (only if integration_oauth table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_oauth') THEN
        DROP TRIGGER IF EXISTS sync_integration_oauth ON integrations;
        CREATE TRIGGER sync_integration_oauth 
            AFTER INSERT OR UPDATE ON integrations 
            FOR EACH ROW 
            EXECUTE FUNCTION sync_oauth_tokens();
    END IF;
END $$;

-- =============================================================================
-- PART 7: Helper Functions for OAuth Token Management
-- =============================================================================

-- Create function to retrieve OAuth tokens with decryption
CREATE OR REPLACE FUNCTION get_oauth_tokens(integration_uuid UUID)
RETURNS TABLE (
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT
) AS $$
BEGIN
    -- Check if integration_oauth table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_oauth') THEN
        RETURN QUERY
        SELECT 
            CASE WHEN io.access_token_encrypted IS NOT NULL 
                 THEN pgp_sym_decrypt(io.access_token_encrypted, 'oauth_encryption_key')
                 ELSE i.access_token END as access_token,
            CASE WHEN io.refresh_token_encrypted IS NOT NULL 
                 THEN pgp_sym_decrypt(io.refresh_token_encrypted, 'oauth_encryption_key')
                 ELSE i.refresh_token END as refresh_token,
            COALESCE(io.expires_at, i.expires_at) as expires_at,
            COALESCE(io.scope, i.scope) as scope
        FROM integrations i
        LEFT JOIN integration_oauth io ON i.id = io.integration_id
        WHERE i.id = integration_uuid;
    ELSE
        -- Fallback to main integrations table if oauth table doesn't exist
        RETURN QUERY
        SELECT 
            i.access_token,
            i.refresh_token,
            i.expires_at,
            i.scope
        FROM integrations i
        WHERE i.id = integration_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to safely update OAuth tokens
CREATE OR REPLACE FUNCTION update_oauth_tokens(
    integration_uuid UUID,
    new_access_token TEXT DEFAULT NULL,
    new_refresh_token TEXT DEFAULT NULL,
    new_expires_at TIMESTAMPTZ DEFAULT NULL,
    new_scope TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the main integrations table
    UPDATE integrations 
    SET 
        access_token = COALESCE(new_access_token, access_token),
        refresh_token = COALESCE(new_refresh_token, refresh_token),
        expires_at = COALESCE(new_expires_at, expires_at),
        scope = COALESCE(new_scope, scope),
        updated_at = NOW()
    WHERE id = integration_uuid;
    
    -- The trigger will automatically sync to integration_oauth table if it exists
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 8: Webhook Event Helper Functions
-- =============================================================================

-- Create function to process webhook events
CREATE OR REPLACE FUNCTION process_webhook_event(
    event_id UUID,
    new_status TEXT DEFAULT 'processing'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE webhook_events 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to retry failed webhook events
CREATE OR REPLACE FUNCTION retry_webhook_event(
    event_id UUID,
    error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE webhook_events 
    SET 
        status = 'retrying',
        retry_count = retry_count + 1,
        last_error = COALESCE(error_message, last_error),
        updated_at = NOW()
    WHERE id = event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;