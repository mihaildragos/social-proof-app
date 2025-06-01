// Re-export types from billing service
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
  value: any;
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

// Frontend-specific types
export interface BillingState {
  subscription: Subscription | null;
  plans: Plan[];
  usage: UsageMetrics | null;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  error: string | null;
}

export interface UsageMetrics {
  organization_id: string;
  period_start: Date;
  period_end: Date;
  resources: ResourceUsage[];
  total_overage_amount: number;
}

export interface ResourceUsage {
  resource_type: string;
  included_quantity: number;
  used_quantity: number;
  overage_quantity: number;
  overage_unit_price: number | null;
  overage_amount: number;
  usage_percentage: number;
  is_over_limit: boolean;
}

export interface PlanWithDetails {
  plan: Plan;
  features: PlanFeature[];
  limits: PlanLimit[];
}

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: Plan;
  features: PlanFeature[];
  limits: PlanLimit[];
}

// API Request/Response types
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

export interface ApiResponse<T = any> {
  status: "success" | "error";
  data?: T;
  message?: string;
  code?: string;
  details?: any;
}

// Form types for frontend
export interface PlanSelectionForm {
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  payment_method_id?: string;
  promo_code?: string;
}

export interface PaymentMethodForm {
  card_number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
  cardholder_name: string;
  billing_address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

// UI State types
export interface BillingLoadingState {
  subscription: boolean;
  plans: boolean;
  usage: boolean;
  invoices: boolean;
  paymentMethods: boolean;
  createSubscription: boolean;
  updateSubscription: boolean;
  cancelSubscription: boolean;
  addPaymentMethod: boolean;
}

export interface BillingErrorState {
  subscription: string | null;
  plans: string | null;
  usage: string | null;
  invoices: string | null;
  paymentMethods: string | null;
  createSubscription: string | null;
  updateSubscription: string | null;
  cancelSubscription: string | null;
  addPaymentMethod: string | null;
}

// Notification types
export interface BillingNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Chart data types for analytics
export interface UsageChartData {
  date: string;
  usage: number;
  limit: number;
  overage: number;
}

export interface RevenueChartData {
  month: string;
  mrr: number;
  new_revenue: number;
  churned_revenue: number;
  expansion_revenue: number;
}

// Billing event types for real-time updates
export interface BillingEvent {
  type:
    | "subscription_updated"
    | "usage_updated"
    | "invoice_created"
    | "payment_succeeded"
    | "payment_failed";
  organization_id: string;
  data: any;
  timestamp: Date;
}
