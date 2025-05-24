-- ClickHouse Analytics Database Initialization
-- Create analytics database
CREATE DATABASE IF NOT EXISTS analytics;

USE analytics;

-- Events tracking table
CREATE TABLE
    IF NOT EXISTS events (
        event_id String,
        site_id String,
        event_type String,
        event_data String,
        customer_data String,
        source String,
        timestamp DateTime DEFAULT now (),
        processed_at DateTime,
        created_at DateTime DEFAULT now ()
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (timestamp)
ORDER BY
    (site_id, event_type, timestamp) TTL timestamp + INTERVAL 90 DAY DELETE SETTINGS index_granularity = 8192;

-- Notifications tracking table
CREATE TABLE
    IF NOT EXISTS notifications (
        notification_id String,
        site_id String,
        template_id String,
        event_id String,
        type String,
        status String,
        recipient_data String,
        content String,
        scheduled_at DateTime,
        sent_at DateTime,
        delivered_at DateTime,
        clicked_at DateTime,
        created_at DateTime DEFAULT now ()
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (created_at)
ORDER BY
    (site_id, type, status, created_at) TTL created_at + INTERVAL 365 DAY DELETE SETTINGS index_granularity = 8192;

-- Widget interactions tracking
CREATE TABLE
    IF NOT EXISTS widget_interactions (
        interaction_id String,
        site_id String,
        session_id String,
        notification_id String,
        interaction_type String,
        widget_position String,
        timestamp DateTime DEFAULT now ()
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (timestamp)
ORDER BY
    (site_id, interaction_type, timestamp) TTL timestamp + INTERVAL 365 DAY DELETE SETTINGS index_granularity = 8192;

-- Page views and sessions
CREATE TABLE
    IF NOT EXISTS page_views (
        view_id String,
        site_id String,
        session_id String,
        visitor_id String,
        page_url String,
        referrer String,
        user_agent String,
        ip_address String,
        timestamp DateTime DEFAULT now (),
        duration_seconds UInt32
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (timestamp)
ORDER BY
    (site_id, timestamp) TTL timestamp + INTERVAL 365 DAY DELETE SETTINGS index_granularity = 8192;

-- A/B test results
CREATE TABLE
    IF NOT EXISTS ab_test_results (
        test_id String,
        visitor_id String,
        variant String,
        site_id String,
        conversion_event String,
        converted Boolean DEFAULT false,
        assigned_at DateTime,
        converted_at DateTime,
        timestamp DateTime DEFAULT now ()
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (timestamp)
ORDER BY
    (test_id, variant, timestamp) TTL timestamp + INTERVAL 365 DAY DELETE SETTINGS index_granularity = 8192;

-- Revenue tracking
CREATE TABLE
    IF NOT EXISTS revenue_events (
        event_id String,
        site_id String,
        order_id String,
        customer_id String,
        product_id String,
        product_name String,
        quantity UInt32,
        unit_price Decimal(10, 2),
        total_amount Decimal(10, 2),
        currency String DEFAULT 'USD',
        timestamp DateTime DEFAULT now ()
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (timestamp)
ORDER BY
    (site_id, timestamp) TTL timestamp + INTERVAL 730 DAY DELETE SETTINGS index_granularity = 8192;

-- Create materialized views for common aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_events_summary ENGINE = SummingMergeTree ()
PARTITION BY
    toYYYYMM (date)
ORDER BY
    (site_id, event_type, date) AS
SELECT
    site_id,
    event_type,
    toDate (timestamp) as date,
    count() as event_count,
    uniq (customer_data) as unique_customers
FROM
    events
GROUP BY
    site_id,
    event_type,
    toDate (timestamp);

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_notifications_summary ENGINE = SummingMergeTree ()
PARTITION BY
    toYYYYMM (hour)
ORDER BY
    (site_id, type, status, hour) AS
SELECT
    site_id,
    type,
    status,
    toStartOfHour (created_at) as hour,
    count() as notification_count,
    avg(if (delivered_at > 0, delivered_at - sent_at, 0)) as avg_delivery_time
FROM
    notifications
WHERE
    sent_at > 0
GROUP BY
    site_id,
    type,
    status,
    toStartOfHour (created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS widget_interaction_rates ENGINE = SummingMergeTree ()
PARTITION BY
    toYYYYMM (date)
ORDER BY
    (site_id, interaction_type, date) AS
SELECT
    site_id,
    interaction_type,
    toDate (timestamp) as date,
    count() as interaction_count,
    uniq (session_id) as unique_sessions
FROM
    widget_interactions
GROUP BY
    site_id,
    interaction_type,
    toDate (timestamp);

-- Sample data will be inserted via API calls during testing