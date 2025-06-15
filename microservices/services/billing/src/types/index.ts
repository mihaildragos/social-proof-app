// Billing entity types based on the database schema

import { Decimal } from "@prisma/client/runtime/library";

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: Decimal;
  priceYearly: Decimal;
  currency: string;
  isPublic: boolean;
  sortOrder: number;
  stripeProductId: string | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  id: string;
  planId: string;
  name: string;
  description: string | null;
  featureType: string;
  value: any; // JSONB field
  isHighlighted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanLimit {
  id: string;
  planId: string;
  resourceType: string;
  maxValue: number; // -1 for unlimited
  overagePrice: Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  billingCycle: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelsAtPeriodEnd: boolean;
  canceledAt: Date | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  stripeInvoiceId: string | null;
  number: string | null;
  currency: string;
  subtotal: Decimal;
  tax: Decimal;
  total: Decimal;
  status: string;
  invoicePdfUrl: string | null;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  subscriptionId: string;
  resourceType: string;
  quantity: number;
  recordedAt: Date;
}

export interface UsageSummary {
  id: string;
  organizationId: string;
  subscriptionId: string;
  resourceType: string;
  periodStart: Date;
  periodEnd: Date;
  includedQuantity: number;
  usedQuantity: number;
  overageQuantity: number;
  overageUnitPrice: number | null;
  overageAmount: number;
  status: "pending" | "billed" | "waived";
  stripeUsageRecordId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  organizationId: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API request/response types
export interface CreateSubscriptionRequest {
  organizationId: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
  paymentMethodId?: string;
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  billingCycle?: "monthly" | "yearly";
}

export interface TrackUsageRequest {
  organizationId: string;
  resourceType: string;
  quantity: number;
}

export interface UsageValidationRequest {
  organizationId: string;
  resourceType: string;
  quantity: number;
}

export interface UsageValidationResponse {
  isValid: boolean;
  currentUsage: number;
  limit: number;
  overageAllowed: boolean;
  overagePrice?: number;
}

// API response wrapper
export interface ApiResponse<T = any> {
  status: "success" | "error";
  data?: T;
  message?: string;
  code?: string;
  details?: any;
}
