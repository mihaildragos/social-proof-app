-- Comprehensive Schema Fixes for Notifications Service
-- Consolidates all schema compatibility fixes into one migration

-- =============================================================================
-- PART 1: Fix Schema Mismatches
-- =============================================================================

-- Add organization_id column to sites table for compatibility with code expectations
ALTER TABLE sites ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add audit columns to sites and templates tables
ALTER TABLE sites ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Create indexes for organization-based queries
CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_site_id ON templates(site_id);

-- Update existing sites to have organization_id equal to owner_id for backward compatibility
UPDATE sites SET organization_id = owner_id WHERE organization_id IS NULL;

-- =============================================================================
-- PART 2: Add Missing Tables
-- =============================================================================

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  targeting_rules JSONB DEFAULT '{}',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ab_tests table
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  control_template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  variant_template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  traffic_split INTEGER DEFAULT 50 CHECK (traffic_split >= 0 AND traffic_split <= 100),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  hypothesis TEXT,
  success_metric TEXT,
  minimum_sample_size INTEGER DEFAULT 1000,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ab_test_results table
CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ab_test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  confidence_interval DECIMAL(5,4) DEFAULT 0,
  statistical_significance DECIMAL(5,4) DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ab_test_id, template_id, date)
);

-- =============================================================================
-- PART 3: Create Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_site_id ON campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);

CREATE INDEX IF NOT EXISTS idx_ab_tests_site_id ON ab_tests(site_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ab_tests(start_date);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_ab_test_id ON ab_test_results(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_date ON ab_test_results(date);

-- =============================================================================
-- PART 4: Add Update Triggers
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
    DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
    DROP TRIGGER IF EXISTS update_ab_tests_updated_at ON ab_tests;
    
    -- Create new triggers
    CREATE TRIGGER update_campaigns_updated_at 
      BEFORE UPDATE ON campaigns 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_ab_tests_updated_at 
      BEFORE UPDATE ON ab_tests 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;