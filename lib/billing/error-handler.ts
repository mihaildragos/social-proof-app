import { BillingApiError } from "../api/billing-client";

// Error types for billing operations
export enum BillingErrorType {
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  VALIDATION = "VALIDATION",
  PAYMENT = "PAYMENT",
  SUBSCRIPTION = "SUBSCRIPTION",
  NETWORK = "NETWORK",
  SERVER = "SERVER",
  UNKNOWN = "UNKNOWN",
}

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  UNAUTHORIZED: "Please sign in to access billing information.",
  FORBIDDEN: "You don't have permission to perform this action.",

  // Subscription errors
  SUBSCRIPTION_NOT_FOUND: "No subscription found for your organization.",
  SUBSCRIPTION_ALREADY_EXISTS: "Your organization already has an active subscription.",
  PLAN_NOT_FOUND: "The selected plan is not available.",
  INVALID_BILLING_CYCLE: "Please select a valid billing cycle.",

  // Payment errors
  PAYMENT_METHOD_REQUIRED: "Please add a payment method to continue.",
  PAYMENT_FAILED: "Payment could not be processed. Please try again.",
  CARD_DECLINED: "Your card was declined. Please try a different payment method.",
  INSUFFICIENT_FUNDS: "Insufficient funds. Please try a different payment method.",
  EXPIRED_CARD: "Your card has expired. Please update your payment method.",

  // Stripe errors
  STRIPE_ERROR: "Payment processing error. Please try again.",
  INVALID_PAYMENT_METHOD: "Invalid payment method. Please try again.",

  // Validation errors
  VALIDATION_ERROR: "Please check your input and try again.",
  MISSING_REQUIRED_FIELDS: "Please fill in all required fields.",
  INVALID_EMAIL: "Please enter a valid email address.",
  INVALID_PHONE: "Please enter a valid phone number.",

  // Network errors
  NETWORK_ERROR: "Connection error. Please check your internet connection.",
  TIMEOUT_ERROR: "Request timed out. Please try again.",

  // Server errors
  INTERNAL_ERROR: "Something went wrong. Please try again later.",
  SERVICE_UNAVAILABLE: "Service is temporarily unavailable. Please try again later.",

  // Default
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
};

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Processed error interface
export interface ProcessedBillingError {
  type: BillingErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  code?: string;
  details?: any;
  retryable: boolean;
  actionRequired: boolean;
  suggestedAction?: string;
}

/**
 * Process and categorize billing errors
 */
export function processBillingError(error: unknown): ProcessedBillingError {
  // Handle BillingApiError
  if (error instanceof BillingApiError) {
    return processBillingApiError(error);
  }

  // Handle generic Error
  if (error instanceof Error) {
    return processGenericError(error);
  }

  // Handle unknown error types
  return {
    type: BillingErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    title: "Unexpected Error",
    message: ERROR_MESSAGES.UNKNOWN_ERROR,
    retryable: true,
    actionRequired: false,
  };
}

/**
 * Process BillingApiError instances
 */
function processBillingApiError(error: BillingApiError): ProcessedBillingError {
  const { status, code, message } = error;

  // Authentication errors (401)
  if (status === 401) {
    return {
      type: BillingErrorType.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      title: "Authentication Required",
      message: ERROR_MESSAGES.UNAUTHORIZED,
      code,
      retryable: false,
      actionRequired: true,
      suggestedAction: "Please sign in to continue.",
    };
  }

  // Authorization errors (403)
  if (status === 403) {
    return {
      type: BillingErrorType.AUTHORIZATION,
      severity: ErrorSeverity.HIGH,
      title: "Access Denied",
      message: ERROR_MESSAGES.FORBIDDEN,
      code,
      retryable: false,
      actionRequired: true,
      suggestedAction: "Contact your administrator for access.",
    };
  }

  // Validation errors (400)
  if (status === 400) {
    return {
      type: BillingErrorType.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      title: "Invalid Request",
      message: getValidationErrorMessage(code, message),
      code,
      retryable: false,
      actionRequired: true,
      suggestedAction: "Please check your input and try again.",
    };
  }

  // Not found errors (404)
  if (status === 404) {
    return {
      type: BillingErrorType.SUBSCRIPTION,
      severity: ErrorSeverity.MEDIUM,
      title: "Not Found",
      message: getNotFoundErrorMessage(code, message),
      code,
      retryable: false,
      actionRequired: true,
    };
  }

  // Conflict errors (409)
  if (status === 409) {
    return {
      type: BillingErrorType.SUBSCRIPTION,
      severity: ErrorSeverity.MEDIUM,
      title: "Conflict",
      message: ERROR_MESSAGES.SUBSCRIPTION_ALREADY_EXISTS,
      code,
      retryable: false,
      actionRequired: true,
    };
  }

  // Server errors (5xx)
  if (status >= 500) {
    return {
      type: BillingErrorType.SERVER,
      severity: ErrorSeverity.HIGH,
      title: "Server Error",
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      code,
      retryable: true,
      actionRequired: false,
      suggestedAction: "Please try again in a few minutes.",
    };
  }

  // Network errors (status 0)
  if (status === 0) {
    return {
      type: BillingErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      title: "Connection Error",
      message: ERROR_MESSAGES.NETWORK_ERROR,
      code,
      retryable: true,
      actionRequired: false,
      suggestedAction: "Please check your internet connection.",
    };
  }

  // Default case
  return {
    type: BillingErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    title: "Error",
    message: message || ERROR_MESSAGES.UNKNOWN_ERROR,
    code,
    retryable: true,
    actionRequired: false,
  };
}

/**
 * Process generic Error instances
 */
function processGenericError(error: Error): ProcessedBillingError {
  const message = error.message.toLowerCase();

  // Network-related errors
  if (message.includes("network") || message.includes("fetch")) {
    return {
      type: BillingErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      title: "Connection Error",
      message: ERROR_MESSAGES.NETWORK_ERROR,
      retryable: true,
      actionRequired: false,
    };
  }

  // Timeout errors
  if (message.includes("timeout")) {
    return {
      type: BillingErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      title: "Timeout Error",
      message: ERROR_MESSAGES.TIMEOUT_ERROR,
      retryable: true,
      actionRequired: false,
    };
  }

  // Default generic error
  return {
    type: BillingErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    title: "Error",
    message: error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
    retryable: true,
    actionRequired: false,
  };
}

/**
 * Get user-friendly validation error message
 */
function getValidationErrorMessage(code?: string, message?: string): string {
  if (!code) return message || ERROR_MESSAGES.VALIDATION_ERROR;

  const errorMap: Record<string, string> = {
    BAD_REQUEST: ERROR_MESSAGES.VALIDATION_ERROR,
    MISSING_REQUIRED_FIELDS: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
    INVALID_EMAIL: ERROR_MESSAGES.INVALID_EMAIL,
    INVALID_PHONE: ERROR_MESSAGES.INVALID_PHONE,
    STRIPE_ERROR: ERROR_MESSAGES.STRIPE_ERROR,
    PAYMENT_METHOD_REQUIRED: ERROR_MESSAGES.PAYMENT_METHOD_REQUIRED,
  };

  return errorMap[code] || message || ERROR_MESSAGES.VALIDATION_ERROR;
}

/**
 * Get user-friendly not found error message
 */
function getNotFoundErrorMessage(code?: string, message?: string): string {
  if (!code) return message || "Resource not found.";

  const errorMap: Record<string, string> = {
    SUBSCRIPTION_NOT_FOUND: ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND,
    PLAN_NOT_FOUND: ERROR_MESSAGES.PLAN_NOT_FOUND,
    NOT_FOUND: "The requested resource was not found.",
  };

  return errorMap[code] || message || "Resource not found.";
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ProcessedBillingError): boolean {
  return (
    error.retryable && [BillingErrorType.NETWORK, BillingErrorType.SERVER].includes(error.type)
  );
}

/**
 * Check if error requires user action
 */
export function requiresUserAction(error: ProcessedBillingError): boolean {
  return error.actionRequired;
}

/**
 * Get retry delay for retryable errors (exponential backoff)
 */
export function getRetryDelay(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}
