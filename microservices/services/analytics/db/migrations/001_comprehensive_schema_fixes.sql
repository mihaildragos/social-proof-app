-- Comprehensive Schema Fixes for Analytics Service
-- Consolidates all schema compatibility fixes into one migration

-- =============================================================================
-- PART 1: Create Simple Analytics Tables Expected by Service Code
-- =============================================================================

-- Create analytics_events table that the service code expects
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  site_id TEXT,
  event_type TEXT NOT NULL,
  event_name TEXT,
  user_id TEXT,
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  source TEXT,
  campaign TEXT,
  medium TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics_funnels table expected by the service
CREATE TABLE IF NOT EXISTS analytics_funnels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics_reports table expected by the service
CREATE TABLE IF NOT EXISTS analytics_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  type TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 2: Create Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_site ON analytics_events(organization_id, site_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);

CREATE INDEX IF NOT EXISTS idx_analytics_funnels_org ON analytics_funnels(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_org ON analytics_reports(organization_id);

-- =============================================================================
-- PART 3: Create Update Triggers
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
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS update_analytics_funnels_updated_at ON analytics_funnels;
    DROP TRIGGER IF EXISTS update_analytics_reports_updated_at ON analytics_reports;
    
    -- Create new triggers
    CREATE TRIGGER update_analytics_funnels_updated_at 
      BEFORE UPDATE ON analytics_funnels 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_analytics_reports_updated_at 
      BEFORE UPDATE ON analytics_reports 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =============================================================================
-- PART 4: Create Bridge Views and Sync Functions
-- =============================================================================

-- Create bridge views only if the source tables exist
DO $$
BEGIN
    -- Create bridge view for analytics_funnels to existing funnels table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'funnels') THEN
        DROP VIEW IF EXISTS analytics_funnels_bridge;
        CREATE VIEW analytics_funnels_bridge AS 
        SELECT 
          id,
          organization_id,
          name,
          description,
          steps,
          created_at
        FROM funnels;
    END IF;

    -- Create bridge view for analytics_reports to existing report_configs table  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_configs') THEN
        DROP VIEW IF EXISTS analytics_reports_bridge;
        CREATE VIEW analytics_reports_bridge AS
        SELECT 
          id,
          organization_id,
          name,
          description,
          config,
          created_at
        FROM report_configs;
    END IF;
END $$;

-- =============================================================================
-- PART 5: Add Organization ID to Existing Tables
-- =============================================================================

DO $$
BEGIN
    -- Check if organization_id column exists in raw_events and add if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_events') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'raw_events' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE raw_events ADD COLUMN organization_id UUID;
            CREATE INDEX IF NOT EXISTS idx_raw_events_organization_id ON raw_events(organization_id);
        END IF;
    END IF;
    
    -- Check if organization_id column exists in funnels and add if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'funnels') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'funnels' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE funnels ADD COLUMN organization_id UUID;
            CREATE INDEX IF NOT EXISTS idx_funnels_organization_id ON funnels(organization_id);
        END IF;
    END IF;
    
    -- Check if organization_id column exists in report_configs and add if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_configs') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'report_configs' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE report_configs ADD COLUMN organization_id UUID;
            CREATE INDEX IF NOT EXISTS idx_report_configs_organization_id ON report_configs(organization_id);
        END IF;
    END IF;
END $$;

-- =============================================================================
-- PART 6: Create Sync Function for Raw Events
-- =============================================================================

-- Create function to sync events from raw_events to analytics_events
CREATE OR REPLACE FUNCTION sync_analytics_events()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into analytics_events when new raw_events are created
    IF TG_OP = 'INSERT' THEN
        INSERT INTO analytics_events (
            organization_id,
            site_id,
            event_type,
            event_name,
            user_id,
            session_id,
            properties,
            source,
            campaign,
            medium,
            created_at
        ) VALUES (
            COALESCE(NEW.organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
            NEW.site_id,
            NEW.event_type,
            NEW.event_name,
            NEW.user_id,
            NEW.session_id,
            COALESCE(NEW.properties, '{}'::jsonb),
            NEW.source,
            NEW.campaign,
            NEW.medium,
            NEW.created_at
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync new raw events to analytics_events (only if raw_events table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_events') THEN
        DROP TRIGGER IF EXISTS sync_raw_events_to_analytics ON raw_events;
        CREATE TRIGGER sync_raw_events_to_analytics
            AFTER INSERT ON raw_events
            FOR EACH ROW
            EXECUTE FUNCTION sync_analytics_events();
    END IF;
END $$;