-- Migration: 006_fix_notification_constraints.sql
-- Description: Fix NOT NULL constraints on notifications table for notification service compatibility
-- Created: 2025-05-26

BEGIN;

-- Make name column nullable and add default value
ALTER TABLE notifications ALTER COLUMN name DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN name SET DEFAULT 'Auto-generated notification';

-- Make created_by column nullable 
ALTER TABLE notifications ALTER COLUMN created_by DROP NOT NULL;

-- Add description column default
ALTER TABLE notifications ALTER COLUMN description SET DEFAULT '';

COMMIT; 