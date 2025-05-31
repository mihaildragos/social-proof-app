"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization, useAuth } from "@clerk/nextjs";
import { billingClient } from "../lib/api/billing-client";
import { processBillingError } from "../lib/billing/error-handler";
import { useToast } from "./use-toast";
import {
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from "../lib/api/billing-types";

// Query keys for React Query
export const billingKeys = {
  all: ["billing"] as const,
  subscription: (orgId: string) => [...billingKeys.all, "subscription", orgId] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  plan: (id: string) => [...billingKeys.all, "plan", id] as const,
  usage: (orgId: string) => [...billingKeys.all, "usage", orgId] as const,
  invoices: (orgId: string) => [...billingKeys.all, "invoices", orgId] as const,
  paymentMethods: (orgId: string) => [...billingKeys.all, "paymentMethods", orgId] as const,
};

/**
 * Hook for managing subscription data
 */
export function useSubscription() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const organizationId = organization?.id;

  // Query for subscription data
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.subscription(organizationId || ""),
    queryFn: () => billingClient.getSubscription(organizationId!, getToken),
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      const processedError = processBillingError(error);
      return processedError.retryable && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Mutation for creating subscription
  const createSubscription = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => billingClient.createSubscription(data, getToken),
    onSuccess: (newSubscription) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription(organizationId || "") });
      toast({
        title: "Subscription Created",
        description: "Your subscription has been successfully created.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating subscription
  const updateSubscription = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionRequest }) =>
      billingClient.updateSubscription(id, data, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription(organizationId || "") });
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been successfully updated.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for canceling subscription
  const cancelSubscription = useMutation({
    mutationFn: ({ id, immediate }: { id: string; immediate?: boolean }) =>
      billingClient.cancelSubscription(id, getToken, immediate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription(organizationId || "") });
      toast({
        title: "Subscription Canceled",
        description: "Your subscription has been canceled.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  return {
    subscription,
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
    createSubscription,
    updateSubscription,
    cancelSubscription,
  };
}

/**
 * Hook for managing plans data
 */
export function usePlans() {
  const { getToken } = useAuth();
  const { toast } = useToast();

  const {
    data: plans,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.plans(),
    queryFn: () => billingClient.getPlans(getToken),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      const processedError = processBillingError(error);
      return processedError.retryable && failureCount < 3;
    },
  });

  return {
    plans: plans || [],
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
  };
}

/**
 * Hook for getting a specific plan
 */
export function usePlan(planId: string) {
  const { getToken } = useAuth();
  const { toast } = useToast();

  const {
    data: plan,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.plan(planId),
    queryFn: () => billingClient.getPlan(planId, getToken),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    plan,
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
  };
}

/**
 * Hook for managing usage data
 */
export function useUsage() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const organizationId = organization?.id;

  const {
    data: usage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.usage(organizationId || ""),
    queryFn: () => billingClient.getUsage(organizationId!, getToken),
    enabled: !!organizationId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: (failureCount, error) => {
      const processedError = processBillingError(error);
      return processedError.retryable && failureCount < 3;
    },
  });

  return {
    usage,
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
  };
}

/**
 * Hook for managing invoices
 */
export function useInvoices() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const organizationId = organization?.id;

  const {
    data: invoices,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.invoices(organizationId || ""),
    queryFn: () => billingClient.getInvoices(organizationId!, getToken),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    invoices: invoices || [],
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
  };
}

/**
 * Hook for managing payment methods
 */
export function usePaymentMethods() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const organizationId = organization?.id;

  // Query for payment methods
  const {
    data: paymentMethods,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: billingKeys.paymentMethods(organizationId || ""),
    queryFn: () => billingClient.getPaymentMethods(organizationId!, getToken),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation for adding payment method
  const addPaymentMethod = useMutation({
    mutationFn: (paymentMethodId: string) =>
      billingClient.addPaymentMethod(organizationId!, paymentMethodId, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.paymentMethods(organizationId || "") });
      toast({
        title: "Payment Method Added",
        description: "Your payment method has been successfully added.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for removing payment method
  const removePaymentMethod = useMutation({
    mutationFn: (paymentMethodId: string) => billingClient.removePaymentMethod(paymentMethodId, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.paymentMethods(organizationId || "") });
      toast({
        title: "Payment Method Removed",
        description: "Your payment method has been removed.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for setting default payment method
  const setDefaultPaymentMethod = useMutation({
    mutationFn: (paymentMethodId: string) => billingClient.setDefaultPaymentMethod(paymentMethodId, getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.paymentMethods(organizationId || "") });
      toast({
        title: "Default Payment Method Updated",
        description: "Your default payment method has been updated.",
      });
    },
    onError: (error) => {
      const processedError = processBillingError(error);
      toast({
        title: processedError.title,
        description: processedError.message,
        variant: "destructive",
      });
    },
  });

  return {
    paymentMethods: paymentMethods || [],
    isLoading,
    error: error ? processBillingError(error) : null,
    refetch,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  };
}

/**
 * Hook for comprehensive billing state
 */
export function useBilling() {
  const subscription = useSubscription();
  const plans = usePlans();
  const usage = useUsage();
  const invoices = useInvoices();
  const paymentMethods = usePaymentMethods();

  const isLoading =
    subscription.isLoading ||
    plans.isLoading ||
    usage.isLoading ||
    invoices.isLoading ||
    paymentMethods.isLoading;

  const hasError = !!(
    subscription.error ||
    plans.error ||
    usage.error ||
    invoices.error ||
    paymentMethods.error
  );

  return {
    subscription: subscription.subscription,
    plans: plans.plans,
    usage: usage.usage,
    invoices: invoices.invoices,
    paymentMethods: paymentMethods.paymentMethods,
    isLoading,
    hasError,
    errors: {
      subscription: subscription.error,
      plans: plans.error,
      usage: usage.error,
      invoices: invoices.error,
      paymentMethods: paymentMethods.error,
    },
    actions: {
      subscription: {
        create: subscription.createSubscription,
        update: subscription.updateSubscription,
        cancel: subscription.cancelSubscription,
        refetch: subscription.refetch,
      },
      plans: {
        refetch: plans.refetch,
      },
      usage: {
        refetch: usage.refetch,
      },
      invoices: {
        refetch: invoices.refetch,
      },
      paymentMethods: {
        add: paymentMethods.addPaymentMethod,
        remove: paymentMethods.removePaymentMethod,
        setDefault: paymentMethods.setDefaultPaymentMethod,
        refetch: paymentMethods.refetch,
      },
    },
  };
}
