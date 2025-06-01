-- Comprehensive Schema Fixes for Billing Service
-- Consolidates all schema compatibility fixes into one migration

-- =============================================================================
-- PART 1: Fix Plans Table Schema Mismatches
-- =============================================================================

-- Add is_active column to plans table for compatibility with tests
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for performance on is_active queries
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans (is_active);

-- Create view for active plans compatibility
DROP VIEW IF EXISTS active_plans;
CREATE VIEW active_plans AS
SELECT *
FROM plans
WHERE is_active = true;

-- Update existing plans to be active by default
UPDATE plans
SET is_active = true
WHERE is_active IS NULL;

-- Make is_active not null after setting defaults
DO $$
BEGIN
    -- Only alter if the column exists and is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'is_active' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE plans
        ALTER COLUMN is_active SET NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- PART 2: Add Missing Tables Expected by Service Code
-- =============================================================================

-- Create payments table if it doesn't exist (expected by service code)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoices table if it doesn't exist (expected by service code)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id VARCHAR(255),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  line_items JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage_records table if it doesn't exist (expected by service code)
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,4),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  billing_period DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 3: Add Compatibility Columns to Existing Tables
-- =============================================================================

-- Add organization_id to subscriptions if missing (for backward compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN organization_id UUID;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
    END IF;
END $$;

-- Add user_id to subscriptions for backward compatibility with older code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN user_id UUID;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    END IF;
END $$;

-- =============================================================================
-- PART 4: Create Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_period ON invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_organization_id ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric_type ON usage_records(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_billing_period ON usage_records(billing_period);
CREATE INDEX IF NOT EXISTS idx_usage_records_recorded_at ON usage_records(recorded_at);

-- =============================================================================
-- PART 5: Create Update Triggers
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
    DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
    DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
    
    -- Create new triggers
    CREATE TRIGGER update_payments_updated_at 
      BEFORE UPDATE ON payments 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_invoices_updated_at 
      BEFORE UPDATE ON invoices 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- =============================================================================
-- PART 6: Create Helper Functions
-- =============================================================================

-- Create function to generate unique invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    invoice_num TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(counter::TEXT, 6, '0');
        
        -- Check if this number already exists
        IF NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = invoice_num) THEN
            RETURN invoice_num;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 999999 THEN
            RAISE EXCEPTION 'Unable to generate unique invoice number';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate total amount including tax
CREATE OR REPLACE FUNCTION calculate_invoice_total(
    base_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2) DEFAULT 0
)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN base_amount + COALESCE(tax_amount, 0);
END;
$$ LANGUAGE plpgsql;