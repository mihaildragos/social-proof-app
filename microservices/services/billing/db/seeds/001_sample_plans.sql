-- Seed data for billing service plans
-- This file contains sample plans, features, and limits
BEGIN;

-- Insert sample plans
INSERT INTO
    plans (
        id,
        name,
        display_name,
        description,
        price_monthly,
        price_yearly,
        currency,
        is_public,
        sort_order
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'starter',
        'Starter',
        'Perfect for small teams getting started with social proof',
        29.00,
        290.00,
        'USD',
        true,
        1
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'pro',
        'Professional',
        'Advanced features for growing businesses',
        99.00,
        990.00,
        'USD',
        true,
        2
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'enterprise',
        'Enterprise',
        'Custom solutions for large organizations',
        299.00,
        2990.00,
        'USD',
        true,
        3
    );

-- Insert plan features for Starter plan
INSERT INTO
    plan_features (
        plan_id,
        name,
        description,
        feature_type,
        value,
        is_highlighted
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Real-time Notifications',
        'Display live social proof notifications',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Basic Templates',
        'Access to 5 notification templates',
        'number',
        '5',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Email Support',
        'Standard email support',
        'boolean',
        'true',
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Basic Analytics',
        'View basic notification metrics',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'Custom Branding',
        'Remove Fomo branding',
        'boolean',
        'false',
        false
    );

-- Insert plan features for Pro plan
INSERT INTO
    plan_features (
        plan_id,
        name,
        description,
        feature_type,
        value,
        is_highlighted
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Real-time Notifications',
        'Display live social proof notifications',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Premium Templates',
        'Access to 25+ notification templates',
        'number',
        '25',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Priority Support',
        'Priority email and chat support',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Advanced Analytics',
        'Detailed analytics and conversion tracking',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Custom Branding',
        'Remove Fomo branding and add your own',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'A/B Testing',
        'Test different notification styles',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'API Access',
        'Full API access for custom integrations',
        'boolean',
        'true',
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Webhooks',
        'Real-time webhooks for events',
        'boolean',
        'true',
        false
    );

-- Insert plan features for Enterprise plan
INSERT INTO
    plan_features (
        plan_id,
        name,
        description,
        feature_type,
        value,
        is_highlighted
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Real-time Notifications',
        'Display live social proof notifications',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Unlimited Templates',
        'Access to all templates + custom design',
        'text',
        'Unlimited',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Dedicated Support',
        '24/7 dedicated support manager',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Enterprise Analytics',
        'Advanced analytics with custom reports',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'White Label',
        'Complete white-label solution',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'A/B Testing',
        'Advanced A/B testing with statistical significance',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'API Access',
        'Full API access with higher rate limits',
        'boolean',
        'true',
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Webhooks',
        'Real-time webhooks with custom endpoints',
        'boolean',
        'true',
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'SSO Integration',
        'Single sign-on with SAML/OAuth',
        'boolean',
        'true',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'Custom Integrations',
        'Custom integrations and development',
        'boolean',
        'true',
        false
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'SLA Guarantee',
        '99.9% uptime SLA with credits',
        'boolean',
        'true',
        false
    );

-- Insert plan limits for Starter plan
INSERT INTO
    plan_limits (plan_id, resource_type, max_value, overage_price)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'notifications_per_month',
        10000,
        0.001
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'websites',
        1,
        NULL
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'team_members',
        3,
        5.00
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'api_requests_per_month',
        50000,
        0.0001
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'data_retention_days',
        30,
        NULL
    );

-- Insert plan limits for Pro plan
INSERT INTO
    plan_limits (plan_id, resource_type, max_value, overage_price)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'notifications_per_month',
        100000,
        0.0008
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'websites',
        5,
        NULL
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'team_members',
        10,
        5.00
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'api_requests_per_month',
        500000,
        0.0001
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'data_retention_days',
        90,
        NULL
    );

-- Insert plan limits for Enterprise plan
INSERT INTO
    plan_limits (plan_id, resource_type, max_value, overage_price)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'notifications_per_month',
        -1,
        NULL
    ), -- Unlimited
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'websites',
        -1,
        NULL
    ), -- Unlimited
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'team_members',
        -1,
        NULL
    ), -- Unlimited
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'api_requests_per_month',
        -1,
        NULL
    ), -- Unlimited
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'data_retention_days',
        365,
        NULL
    );

-- Insert sample promo codes
INSERT INTO
    promo_codes (
        code,
        name,
        description,
        discount_type,
        discount_value,
        currency,
        max_redemptions,
        valid_from,
        valid_until,
        is_active
    )
VALUES
    (
        'WELCOME20',
        'Welcome Discount',
        '20% off first month for new customers',
        'percentage',
        20.00,
        'USD',
        1000,
        NOW (),
        NOW () + INTERVAL '3 months',
        true
    ),
    (
        'SAVE50',
        'Annual Savings',
        '$50 off annual plans',
        'fixed',
        50.00,
        'USD',
        500,
        NOW (),
        NOW () + INTERVAL '6 months',
        true
    ),
    (
        'BLACKFRIDAY',
        'Black Friday Special',
        '30% off all plans',
        'percentage',
        30.00,
        'USD',
        10000,
        NOW (),
        NOW () + INTERVAL '1 week',
        false
    );

COMMIT;