-- Migration 002: Prisma Compatibility
-- Ensures existing schema is compatible with Prisma expectations

-- =============================================================================
-- PART 1: Update Existing Tables for Prisma Compatibility
-- =============================================================================

-- Ensure analytics_events table has proper structure
DO $$
BEGIN
    -- Check if analytics_events exists and has the right structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
        -- Add any missing columns that Prisma expects
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_events' AND column_name = 'id'
        ) THEN
            ALTER TABLE analytics_events ADD COLUMN id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text;
        END IF;
        
        -- Ensure proper column names (camelCase in Prisma, snake_case in DB)
        -- Prisma will automatically map between them
        
        -- Ensure timestamp column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_events' AND column_name = 'timestamp'
        ) THEN
            ALTER TABLE analytics_events ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        -- Update properties column to be proper JSONB
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_events' AND column_name = 'properties' AND data_type = 'text'
        ) THEN
            ALTER TABLE analytics_events ALTER COLUMN properties TYPE JSONB USING properties::jsonb;
        END IF;
    END IF;
END $$;

-- Ensure analytics_funnels table has proper structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_funnels') THEN
        -- Add missing columns for Prisma compatibility
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_funnels' AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE analytics_funnels ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        -- Ensure is_active column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_funnels' AND column_name = 'is_active'
        ) THEN
            ALTER TABLE analytics_funnels ADD COLUMN is_active BOOLEAN DEFAULT true;
        END IF;
        
        -- Update steps column to be proper JSONB
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_funnels' AND column_name = 'steps' AND data_type = 'text'
        ) THEN
            ALTER TABLE analytics_funnels ALTER COLUMN steps TYPE JSONB USING steps::jsonb;
        END IF;
    END IF;
END $$;

-- Ensure analytics_reports table has proper structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_reports') THEN
        -- Add missing columns for Prisma compatibility
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_reports' AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE analytics_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        -- Add type column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_reports' AND column_name = 'type'
        ) THEN
            ALTER TABLE analytics_reports ADD COLUMN type TEXT;
        END IF;
        
        -- Add is_public column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_reports' AND column_name = 'is_public'
        ) THEN
            ALTER TABLE analytics_reports ADD COLUMN is_public BOOLEAN DEFAULT false;
        END IF;
        
        -- Update config column to be proper JSONB
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'analytics_reports' AND column_name = 'config' AND data_type = 'text'
        ) THEN
            ALTER TABLE analytics_reports ALTER COLUMN config TYPE JSONB USING config::jsonb;
        END IF;
    END IF;
END $$;

-- =============================================================================
-- PART 2: Create Missing Tables for Prisma Schema
-- =============================================================================

-- Create analytics_report_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS analytics_report_schedules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL,
    report_id TEXT NOT NULL,
    frequency TEXT NOT NULL,
    recipients JSONB DEFAULT '[]'::jsonb,
    format TEXT DEFAULT 'pdf',
    enabled BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (report_id) REFERENCES analytics_reports(id) ON DELETE CASCADE
);

-- =============================================================================
-- PART 3: Update Triggers for Prisma Compatibility
-- =============================================================================

-- Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers for tables with updated_at columns
DO $$
BEGIN
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS update_analytics_funnels_updated_at ON analytics_funnels;
    DROP TRIGGER IF EXISTS update_analytics_reports_updated_at ON analytics_reports;
    DROP TRIGGER IF EXISTS update_analytics_report_schedules_updated_at ON analytics_report_schedules;
    
    -- Create new triggers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_funnels') THEN
        CREATE TRIGGER update_analytics_funnels_updated_at 
          BEFORE UPDATE ON analytics_funnels 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_reports') THEN
        CREATE TRIGGER update_analytics_reports_updated_at 
          BEFORE UPDATE ON analytics_reports 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    CREATE TRIGGER update_analytics_report_schedules_updated_at 
      BEFORE UPDATE ON analytics_report_schedules 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =============================================================================
-- PART 4: Add Prisma-specific Indexes
-- =============================================================================

-- Add indexes for better performance with Prisma queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_organization_id_created_at 
  ON analytics_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type 
  ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id 
  ON analytics_events(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id 
  ON analytics_events(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_funnels_organization_id 
  ON analytics_funnels(organization_id);

CREATE INDEX IF NOT EXISTS idx_analytics_funnels_is_active 
  ON analytics_funnels(is_active);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_organization_id 
  ON analytics_reports(organization_id);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_type 
  ON analytics_reports(type) WHERE type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_report_id 
  ON analytics_report_schedules(report_id);

CREATE INDEX IF NOT EXISTS idx_analytics_report_schedules_enabled 
  ON analytics_report_schedules(enabled);

-- =============================================================================
-- PART 5: Data Migration and Cleanup
-- =============================================================================

-- Ensure all existing records have proper default values
UPDATE analytics_events 
SET properties = '{}'::jsonb 
WHERE properties IS NULL;

UPDATE analytics_funnels 
SET 
    steps = '[]'::jsonb WHERE steps IS NULL,
    is_active = true WHERE is_active IS NULL,
    updated_at = created_at WHERE updated_at IS NULL;

UPDATE analytics_reports 
SET 
    config = '{}'::jsonb WHERE config IS NULL,
    is_public = false WHERE is_public IS NULL,
    updated_at = created_at WHERE updated_at IS NULL;

-- =============================================================================
-- PART 6: Add Constraints for Data Integrity
-- =============================================================================

-- Add check constraints that Prisma expects
DO $$
BEGIN
    -- Add constraint for analytics_events if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'analytics_events' AND constraint_name = 'analytics_events_organization_id_check'
    ) THEN
        ALTER TABLE analytics_events 
        ADD CONSTRAINT analytics_events_organization_id_check 
        CHECK (organization_id IS NOT NULL AND length(organization_id) > 0);
    END IF;
    
    -- Add constraint for analytics_funnels if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'analytics_funnels' AND constraint_name = 'analytics_funnels_name_check'
    ) THEN
        ALTER TABLE analytics_funnels 
        ADD CONSTRAINT analytics_funnels_name_check 
        CHECK (name IS NOT NULL AND length(name) > 0);
    END IF;
    
    -- Add constraint for analytics_reports if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'analytics_reports' AND constraint_name = 'analytics_reports_name_check'
    ) THEN
        ALTER TABLE analytics_reports 
        ADD CONSTRAINT analytics_reports_name_check 
        CHECK (name IS NOT NULL AND length(name) > 0);
    END IF;
END $$;