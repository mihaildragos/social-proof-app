-- Migration: 005_add_missing_notification_columns.sql
-- Description: Add missing columns to notifications table for notification service compatibility
-- Created: 2025-05-26

BEGIN;

-- Add missing columns to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON notifications(template_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);

COMMIT; 