-- Migration: 004_add_missing_template_columns.sql
-- Description: Add missing columns to templates table for notification service compatibility
-- Created: 2025-05-26

BEGIN;

-- Add missing columns to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['web']::TEXT[];
ALTER TABLE templates ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS css TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS html TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS event_types TEXT[] DEFAULT ARRAY['order.created']::TEXT[];
ALTER TABLE templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing templates to populate the new columns from existing data
UPDATE templates SET 
  css = css_content,
  html = html_content,
  channels = CASE 
    WHEN config->'channels' IS NOT NULL THEN 
      ARRAY(SELECT jsonb_array_elements_text(config->'channels'))
    ELSE ARRAY['web']::TEXT[]
  END,
  event_types = CASE 
    WHEN config->'eventTypes' IS NOT NULL THEN 
      ARRAY(SELECT jsonb_array_elements_text(config->'eventTypes'))
    ELSE ARRAY['order.created']::TEXT[]
  END,
  content = COALESCE(config->'variables', '{}'::jsonb),
  status = CASE WHEN is_default THEN 'active' ELSE 'draft' END
WHERE css IS NULL OR html IS NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_event_types ON templates USING GIN(event_types);
CREATE INDEX IF NOT EXISTS idx_templates_channels ON templates USING GIN(channels);

COMMIT; 