-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites reference (shadows main sites table)
CREATE TABLE billing_sites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations reference (shadows main organizations table)
CREATE TABLE billing_organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan definitions
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  stripe_product_id TEXT,
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan features
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  feature_type TEXT NOT NULL, -- boolean, number, text
  value JSONB NOT NULL, -- for boolean: true/false, for number: actual value, for text: description
  is_highlighted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan limits
CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- notifications, sites, teammates, etc.
  max_value INTEGER NOT NULL, -- -1 for unlimited
  overage_price DECIMAL(10, 2), -- NULL if no overage allowed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_plan_resource UNIQUE (plan_id, resource_type)
);

-- Pre-populate core plans
INSERT INTO plans (
  name, display_name, description, price_monthly, price_yearly, sort_order
) VALUES 
  ('free', 'Free for Shopify', 'Basic plan for Shopify stores', 0, 0, 1),
  ('starter', 'Starter', 'For small businesses getting started', 49, 490, 2),
  ('business', 'Business', 'For growing businesses with increased needs', 99, 990, 3),
  ('pro', 'Pro', 'For businesses requiring advanced features', 199, 1990, 4),
  ('unlimited', 'Unlimited', 'Enterprise-grade with unlimited usage', 499, 4990, 5);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id),
  billing_cycle TEXT NOT NULL, -- monthly, yearly
  status TEXT NOT NULL, -- active, canceled, past_due, trialing, unpaid
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancels_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  brand TEXT NOT NULL, -- visa, mastercard, etc.
  last4 TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  stripe_invoice_id TEXT,
  number TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL, -- draft, open, paid, uncollectible, void
  invoice_pdf_url TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL, -- subscription, one_time, usage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage records for metered billing
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  resource_type TEXT NOT NULL, -- notifications, sites, teammates, etc.
  quantity INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly usage summary for billing
CREATE TABLE usage_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  resource_type TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  included_quantity INTEGER NOT NULL,
  used_quantity INTEGER NOT NULL DEFAULT 0,
  overage_quantity INTEGER DEFAULT 0,
  overage_unit_price DECIMAL(10, 2),
  overage_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT NOT NULL, -- pending, billed, waived
  stripe_usage_record_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing contact information
CREATE TABLE billing_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  vat_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotion codes and coupons
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL, -- percentage, fixed_amount
  discount_value DECIMAL(10, 2) NOT NULL,
  duration TEXT NOT NULL, -- once, repeating, forever
  duration_months INTEGER, -- for repeating
  max_redemptions INTEGER, -- NULL for unlimited
  redemption_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  stripe_promotion_code_id TEXT,
  stripe_coupon_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotion redemptions
CREATE TABLE promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan change requests (for trials, downgrades, etc.)
CREATE TABLE plan_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  current_plan_id UUID NOT NULL REFERENCES plans(id),
  requested_plan_id UUID NOT NULL REFERENCES plans(id),
  change_type TEXT NOT NULL, -- upgrade, downgrade, trial_extension
  requested_by UUID NOT NULL, -- User ID
  reason TEXT,
  status TEXT NOT NULL, -- pending, approved, rejected, cancelled
  processed_by UUID, -- Admin User ID
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription change history
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  previous_plan_id UUID REFERENCES plans(id),
  new_plan_id UUID REFERENCES plans(id),
  previous_status TEXT,
  new_status TEXT,
  change_type TEXT NOT NULL, -- created, renewed, upgraded, downgraded, canceled, trial_extended
  change_reason TEXT,
  changed_by UUID, -- User ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_payment_methods_organization_id ON payment_methods(organization_id);
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_usage_records_organization_id ON usage_records(organization_id);
CREATE INDEX idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_resource_type ON usage_records(resource_type);
CREATE INDEX idx_usage_summary_organization_id ON usage_summary(organization_id);
CREATE INDEX idx_usage_summary_subscription_id ON usage_summary(subscription_id);
CREATE INDEX idx_usage_summary_period ON usage_summary(period_start, period_end);
CREATE INDEX idx_billing_contacts_organization_id ON billing_contacts(organization_id);
CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_active ON promotions(is_active, valid_from, valid_until);
CREATE INDEX idx_plan_change_requests_organization_id ON plan_change_requests(organization_id);
CREATE INDEX idx_plan_change_requests_status ON plan_change_requests(status);
CREATE INDEX idx_subscription_history_organization_id ON subscription_history(organization_id);
CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE billing_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Create policies for data access (assuming organization_members table exists)
-- TODO: Uncomment these policies once organization_members table is created
-- CREATE POLICY billing_organization_access ON billing_organizations
--   FOR ALL USING (
--     id IN (
--       SELECT organization_id FROM organization_members 
--       WHERE user_id = current_user_id()
--     )
--   );

-- CREATE POLICY subscription_access ON subscriptions
--   FOR ALL USING (
--     organization_id IN (
--       SELECT organization_id FROM organization_members 
--       WHERE user_id = current_user_id()
--     )
--   );

-- Create function to get current user ID (to be implemented in application)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_user_id', TRUE)::UUID;
$$;

-- Function to determine if the current usage exceeds plan limits
CREATE OR REPLACE FUNCTION is_usage_within_limits(
  p_organization_id UUID,
  p_resource_type TEXT,
  p_quantity INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_plan_id UUID;
  v_max_value INTEGER;
BEGIN
  -- Get the current plan for the organization
  SELECT plan_id INTO v_plan_id
  FROM subscriptions
  WHERE organization_id = p_organization_id
    AND status = 'active'
  ORDER BY current_period_end DESC
  LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    RETURN FALSE; -- No active subscription
  END IF;
  
  -- Get the limit for the resource type
  SELECT max_value INTO v_max_value
  FROM plan_limits
  WHERE plan_id = v_plan_id
    AND resource_type = p_resource_type;
  
  IF v_max_value IS NULL THEN
    RETURN TRUE; -- No limit defined for this resource
  END IF;
  
  IF v_max_value = -1 THEN
    RETURN TRUE; -- Unlimited usage
  END IF;
  
  -- Check if usage is within limits
  RETURN p_quantity <= v_max_value;
END;
$$;

-- Event trigger function for usage tracking
CREATE OR REPLACE FUNCTION track_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- This function would be called from other services via a database trigger
  -- or through a direct API call to record usage events
  
  -- For example, when a notification is sent, this would record it
  -- INSERT INTO usage_records (organization_id, subscription_id, resource_type, quantity)
  -- VALUES (NEW.organization_id, v_subscription_id, 'notifications', 1);
  
  RETURN NEW;
END;
$$; 