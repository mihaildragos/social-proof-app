import { useAuth } from "@clerk/nextjs";
import {
  ApiResponse,
  Subscription,
  Plan,
  PlanWithDetails,
  SubscriptionWithPlan,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  Invoice,
  PaymentMethod,
  UsageMetrics,
} from "./billing-types";

// Base configuration
const BILLING_SERVICE_URL = process.env.NEXT_PUBLIC_BILLING_SERVICE_URL || "http://localhost:3006";
const API_BASE_URL = `${BILLING_SERVICE_URL}/api`;

// Error classes
export class BillingApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "BillingApiError";
  }
}

class BillingClientClass {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication headers from Clerk
   */
  private async getAuthHeaders(getToken: () => Promise<string | null>): Promise<Record<string, string>> {
    const token = await getToken();

    if (!token) {
      throw new BillingApiError("Authentication required", 401, "UNAUTHORIZED");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string, 
    getToken: () => Promise<string | null>,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders(getToken);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new BillingApiError(
          data.message || "API request failed",
          response.status,
          data.code,
          data.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof BillingApiError) {
        throw error;
      }

      // Network or parsing errors
      throw new BillingApiError("Network error occurred", 0, "NETWORK_ERROR", error);
    }
  }

  /**
   * GET request helper
   */
  private async get<T>(endpoint: string, getToken: () => Promise<string | null>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, getToken, { method: "GET" });
  }

  /**
   * POST request helper
   */
  private async post<T>(endpoint: string, getToken: () => Promise<string | null>, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, getToken, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request helper
   */
  private async put<T>(endpoint: string, getToken: () => Promise<string | null>, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, getToken, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request helper
   */
  private async delete<T>(endpoint: string, getToken: () => Promise<string | null>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, getToken, { method: "DELETE" });
  }

  // Subscription methods
  /**
   * Get subscription for organization
   */
  async getSubscription(organizationId: string, getToken: () => Promise<string | null>): Promise<SubscriptionWithPlan> {
    const response = await this.get<SubscriptionWithPlan>(`/subscriptions/${organizationId}`, getToken);
    return response.data!;
  }

  /**
   * Create new subscription
   */
  async createSubscription(data: CreateSubscriptionRequest, getToken: () => Promise<string | null>): Promise<Subscription> {
    const response = await this.post<Subscription>("/subscriptions", getToken, data);
    return response.data!;
  }

  /**
   * Update subscription
   */
  async updateSubscription(id: string, data: UpdateSubscriptionRequest, getToken: () => Promise<string | null>): Promise<Subscription> {
    const response = await this.put<Subscription>(`/subscriptions/${id}`, getToken, data);
    return response.data!;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: string, getToken: () => Promise<string | null>, immediate: boolean = false): Promise<Subscription> {
    const endpoint = `/subscriptions/${id}${immediate ? "?immediate=true" : ""}`;
    const response = await this.delete<Subscription>(endpoint, getToken);
    return response.data!;
  }

  // Plan methods
  /**
   * Get all available plans
   */
  async getPlans(getToken: () => Promise<string | null>): Promise<PlanWithDetails[]> {
    const response = await this.get<PlanWithDetails[]>("/plans", getToken);
    return response.data!;
  }

  /**
   * Get specific plan details
   */
  async getPlan(id: string, getToken: () => Promise<string | null>): Promise<PlanWithDetails> {
    const response = await this.get<PlanWithDetails>(`/plans/${id}`, getToken);
    return response.data!;
  }

  /**
   * Get plan features
   */
  async getPlanFeatures(id: string, getToken: () => Promise<string | null>): Promise<any[]> {
    const response = await this.get<any[]>(`/plans/${id}/features`, getToken);
    return response.data!;
  }

  /**
   * Get plan limits
   */
  async getPlanLimits(id: string, getToken: () => Promise<string | null>): Promise<any[]> {
    const response = await this.get<any[]>(`/plans/${id}/limits`, getToken);
    return response.data!;
  }

  // Usage methods (to be implemented when usage tracking is added)
  /**
   * Get usage metrics for organization
   */
  async getUsage(organizationId: string, getToken: () => Promise<string | null>): Promise<UsageMetrics> {
    // This will be implemented when usage tracking is added to the billing service
    throw new BillingApiError("Usage tracking not yet implemented", 501, "NOT_IMPLEMENTED");
  }

  // Invoice methods (to be implemented when invoice management is added)
  /**
   * Get invoices for organization
   */
  async getInvoices(organizationId: string, getToken: () => Promise<string | null>, limit?: number, offset?: number): Promise<Invoice[]> {
    // This will be implemented when invoice management is added to the billing service
    throw new BillingApiError("Invoice management not yet implemented", 501, "NOT_IMPLEMENTED");
  }

  /**
   * Get specific invoice
   */
  async getInvoice(id: string, getToken: () => Promise<string | null>): Promise<Invoice> {
    // This will be implemented when invoice management is added to the billing service
    throw new BillingApiError("Invoice management not yet implemented", 501, "NOT_IMPLEMENTED");
  }

  // Payment method methods (to be implemented when payment method management is added)
  /**
   * Get payment methods for organization
   */
  async getPaymentMethods(organizationId: string, getToken: () => Promise<string | null>): Promise<PaymentMethod[]> {
    // This will be implemented when payment method management is added to the billing service
    throw new BillingApiError(
      "Payment method management not yet implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(organizationId: string, paymentMethodId: string, getToken: () => Promise<string | null>): Promise<PaymentMethod> {
    // This will be implemented when payment method management is added to the billing service
    throw new BillingApiError(
      "Payment method management not yet implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(id: string, getToken: () => Promise<string | null>): Promise<void> {
    // This will be implemented when payment method management is added to the billing service
    throw new BillingApiError(
      "Payment method management not yet implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(id: string, getToken: () => Promise<string | null>): Promise<PaymentMethod> {
    // This will be implemented when payment method management is added to the billing service
    throw new BillingApiError(
      "Payment method management not yet implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }
}

// Export singleton instance
export const billingClient = new BillingClientClass();

// Export class for testing or custom configurations
export { BillingClientClass as BillingClient };
