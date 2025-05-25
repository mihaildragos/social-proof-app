// Billing entity types based on the database schema

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  is_public: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlanFeature {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  feature_type: "boolean" | "number" | "text";
  value: any; // JSONB field
  is_highlighted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PlanLimit {
  id: string;
  plan_id: string;
  resource_type: string;
  max_value: number; // -1 for unlimited
  overage_price: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  status: "active" | "canceled" | "past_due" | "trialing" | "unpaid";
  trial_ends_at: Date | null;
  current_period_start: Date;
  current_period_end: Date;
  cancels_at_period_end: boolean;
  canceled_at: Date | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  organization_id: string;
  subscription_id: string;
  stripe_invoice_id: string | null;
  number: string | null;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  invoice_pdf_url: string | null;
  period_start: Date;
  period_end: Date;
  due_date: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRecord {
  id: string;
  organization_id: string;
  subscription_id: string;
  resource_type: string;
  quantity: number;
  recorded_at: Date;
}

export interface UsageSummary {
  id: string;
  organization_id: string;
  subscription_id: string;
  resource_type: string;
  period_start: Date;
  period_end: Date;
  included_quantity: number;
  used_quantity: number;
  overage_quantity: number;
  overage_unit_price: number | null;
  overage_amount: number;
  status: "pending" | "billed" | "waived";
  stripe_usage_record_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  stripe_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

// API request/response types
export interface CreateSubscriptionRequest {
  organization_id: string;
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  payment_method_id?: string;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  billing_cycle?: "monthly" | "yearly";
}

export interface TrackUsageRequest {
  organization_id: string;
  resource_type: string;
  quantity: number;
}

export interface UsageValidationRequest {
  organization_id: string;
  resource_type: string;
  quantity: number;
}

export interface UsageValidationResponse {
  is_valid: boolean;
  current_usage: number;
  limit: number;
  overage_allowed: boolean;
  overage_price?: number;
}

// API response wrapper
export interface ApiResponse<T = any> {
  status: "success" | "error";
  data?: T;
  message?: string;
  code?: string;
  details?: any;
} 