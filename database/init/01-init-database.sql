-- Initialize TimescaleDB and create database schema
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create core tables
CREATE TABLE
    IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        clerk_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        organization_id UUID REFERENCES organizations (id),
        role VARCHAR(50) DEFAULT 'analyst',
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        organization_id UUID REFERENCES organizations (id),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    IF NOT EXISTS notification_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'popup', 'email', 'push'
        template_data JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    IF NOT EXISTS events (
        id UUID DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL,
        customer_data JSONB,
        source VARCHAR(100) NOT NULL, -- 'shopify', 'woocommerce', etc.
        timestamp TIMESTAMPTZ DEFAULT NOW () NOT NULL,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        PRIMARY KEY (id, timestamp)
    );

-- Convert events table to TimescaleDB hypertable
SELECT
    create_hypertable ('events', 'timestamp', if_not_exists => TRUE);

CREATE TABLE
    IF NOT EXISTS notifications (
        id UUID DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        template_id UUID REFERENCES notification_templates (id),
        event_id UUID,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        recipient_data JSONB,
        content JSONB NOT NULL,
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW () NOT NULL,
        PRIMARY KEY (id, created_at)
    );

-- Convert notifications table to TimescaleDB hypertable
SELECT
    create_hypertable (
        'notifications',
        'created_at',
        if_not_exists => TRUE
    );

CREATE TABLE
    IF NOT EXISTS analytics_sessions (
        id UUID DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        session_id VARCHAR(255) NOT NULL,
        visitor_id VARCHAR(255),
        page_url TEXT,
        referrer TEXT,
        user_agent TEXT,
        ip_address INET,
        started_at TIMESTAMPTZ DEFAULT NOW () NOT NULL,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        PRIMARY KEY (id, started_at)
    );

-- Convert analytics_sessions table to TimescaleDB hypertable
SELECT
    create_hypertable (
        'analytics_sessions',
        'started_at',
        if_not_exists => TRUE
    );

CREATE TABLE
    IF NOT EXISTS widget_interactions (
        id UUID DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        session_id VARCHAR(255),
        notification_id UUID,
        interaction_type VARCHAR(50) NOT NULL, -- 'impression', 'click', 'close'
        widget_position JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW () NOT NULL,
        PRIMARY KEY (id, timestamp)
    );

-- Convert widget_interactions table to TimescaleDB hypertable
SELECT
    create_hypertable (
        'widget_interactions',
        'timestamp',
        if_not_exists => TRUE
    );

CREATE TABLE
    IF NOT EXISTS ab_tests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        site_id UUID REFERENCES sites (id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        variants JSONB NOT NULL,
        traffic_allocation JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    IF NOT EXISTS ab_test_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        test_id UUID REFERENCES ab_tests (id),
        visitor_id VARCHAR(255) NOT NULL,
        variant VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMPTZ DEFAULT NOW (),
        UNIQUE (test_id, visitor_id)
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_site_id_timestamp ON events (site_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type);

CREATE INDEX IF NOT EXISTS idx_notifications_site_id_created_at ON notifications (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_site_id_started_at ON analytics_sessions (site_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_widget_interactions_site_id_timestamp ON widget_interactions (site_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);

CREATE INDEX IF NOT EXISTS idx_sites_api_key ON sites (api_key);

-- Set up retention policies (90 days for events, 365 days for analytics)
SELECT
    add_retention_policy (
        'events',
        INTERVAL '90 days',
        if_not_exists => TRUE
    );

SELECT
    add_retention_policy (
        'analytics_sessions',
        INTERVAL '365 days',
        if_not_exists => TRUE
    );

SELECT
    add_retention_policy (
        'widget_interactions',
        INTERVAL '365 days',
        if_not_exists => TRUE
    );

-- Insert sample data for MVP testing
INSERT INTO
    organizations (id, name, domain)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Sample Store',
        'sample-store.myshopify.com'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    users (
        id,
        clerk_id,
        email,
        first_name,
        last_name,
        organization_id,
        role
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'user_mock_clerk_id_001',
        'admin@sample-store.com',
        'Admin',
        'User',
        '550e8400-e29b-41d4-a716-446655440001',
        'admin'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    sites (id, organization_id, name, domain, api_key)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440001',
        'Sample Store Frontend',
        'sample-store.com',
        'mvp_test_api_key_12345'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    notification_templates (id, site_id, name, type, template_data)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440004',
        '550e8400-e29b-41d4-a716-446655440003',
        'Recent Purchase Popup',
        'popup',
        '{"message": "Someone just purchased {product_name} from {location}", "style": {"position": "bottom-left", "theme": "modern"}}'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440005',
        '550e8400-e29b-41d4-a716-446655440003',
        'Low Stock Alert',
        'popup',
        '{"message": "Only {stock_count} left of {product_name}!", "style": {"position": "top-right", "theme": "urgent"}}'
    ) ON CONFLICT DO NOTHING;

-- NOTE: After running this initialization script, run the schema migration fixes:
-- node scripts/fix-schema-mismatches.js
-- 
-- This will apply all necessary schema compatibility fixes for microservices