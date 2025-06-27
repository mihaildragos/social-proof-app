"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";
import { useSubscription, useUsage } from "@/hooks/use-billing";
import { formatCurrency, formatDate } from "@/lib/utils";
import { UsageMetrics, type SubscriptionWithPlan } from "@/lib/api/billing-types";

interface SubscriptionOverviewProps {
  className?: string;
}

export function SubscriptionOverview({ className }: SubscriptionOverviewProps) {
  const { subscription, isLoading, error } = useSubscription();
  const { usage } = useUsage();

  if (isLoading) {
    return <SubscriptionOverviewSkeleton />;
  }

  if (error) {
    return <SubscriptionOverviewError error={error} />;
  }

  if (!subscription) {
    return <NoSubscriptionState />;
  }

  return (
    <div className={className}>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Subscription Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Status</CardTitle>
            <StatusIcon status={subscription.subscription.status} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <StatusBadge status={subscription.subscription.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {subscription.subscription.status === "active" ?
                "Active subscription"
              : "Subscription inactive"}
            </p>
          </CardContent>
        </Card>

        {/* Current Plan Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscription.plan.display_name}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(
                subscription.subscription.billing_cycle === "monthly" ?
                  subscription.plan.price_monthly
                : subscription.plan.price_yearly,
                subscription.plan.currency
              )}{" "}
              / {subscription.subscription.billing_cycle === "monthly" ? "month" : "year"}
            </p>
          </CardContent>
        </Card>

        {/* Next Billing Date Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(subscription.subscription.current_period_end)}
            </div>
            <p className="text-xs text-muted-foreground">
              {subscription.subscription.cancels_at_period_end ?
                "Subscription ends"
              : "Next payment due"}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Spend Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Period</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                subscription.subscription.billing_cycle === "monthly" ?
                  subscription.plan.price_monthly
                : subscription.plan.price_yearly,
                subscription.plan.currency
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {usage?.total_overage_amount ?
                `+${formatCurrency(usage.total_overage_amount, subscription.plan.currency)} overage`
              : "No overage charges"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Subscription Details */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
            <CardDescription>
              Manage your subscription settings and billing information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plan</span>
              <span className="text-sm">{subscription.plan.display_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Billing Cycle</span>
              <span className="text-sm capitalize">{subscription.subscription.billing_cycle}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusBadge status={subscription.subscription.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Started</span>
              <span className="text-sm">{formatDate(subscription.subscription.created_at)}</span>
            </div>
            {subscription.subscription.trial_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trial Ends</span>
                <span className="text-sm">
                  {formatDate(subscription.subscription.trial_ends_at)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
              >
                Change Plan
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
              >
                Update Billing
              </Button>
            </div>

            {subscription.subscription.status === "active" &&
              !subscription.subscription.cancels_at_period_end && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  Cancel Subscription
                </Button>
              )}
          </CardContent>
        </Card>

        {/* Usage Overview */}
        {usage && (
          <UsageOverviewCard
            usage={usage}
            limits={subscription.limits}
            subscription={subscription}
          />
        )}
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    canceled: "outline",
    unpaid: "destructive",
  };

  return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>;
}

// Status Icon Component
function StatusIcon({ status }: { status: string }) {
  const icons = {
    active: <CheckCircle className="h-4 w-4 text-green-600" />,
    trialing: <Activity className="h-4 w-4 text-blue-600" />,
    past_due: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
    canceled: <XCircle className="h-4 w-4 text-red-600" />,
    unpaid: <AlertTriangle className="h-4 w-4 text-red-600" />,
  };

  return icons[status as keyof typeof icons] || <Activity className="h-4 w-4 text-gray-600" />;
}

// Usage Overview Card Component
function UsageOverviewCard({
  usage,
  limits,
  subscription,
}: {
  usage: UsageMetrics;
  limits: any[];
  subscription: SubscriptionWithPlan;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Overview</CardTitle>
        <CardDescription>Current usage for this billing period</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage.resources.map((resource) => {
          const limit = limits.find((l) => l.resource_type === resource.resource_type);
          const isUnlimited = limit?.max_value === -1;

          return (
            <div
              key={resource.resource_type}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {resource.resource_type.replace("_", " ")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {resource.used_quantity.toLocaleString()}
                  {!isUnlimited && ` / ${resource.included_quantity.toLocaleString()}`}
                  {isUnlimited && " (unlimited)"}
                </span>
              </div>
              {!isUnlimited && (
                <Progress
                  value={resource.usage_percentage}
                  className={`h-2 ${resource.is_over_limit ? "bg-red-100" : ""}`}
                />
              )}
              {resource.overage_quantity > 0 && (
                <p className="text-xs text-orange-600">
                  {resource.overage_quantity.toLocaleString()} overage units
                  {resource.overage_amount > 0 &&
                    ` (${formatCurrency(resource.overage_amount, subscription?.plan?.currency || "USD")})`}
                </p>
              )}
            </div>
          );
        })}

        {usage.total_overage_amount > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Total Overage</span>
              <span className="text-orange-600">
                {formatCurrency(usage.total_overage_amount, subscription?.plan?.currency || "USD")}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function SubscriptionOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="mb-2 h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="mb-2 h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-60 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(4)].map((_, j) => (
                  <div
                    key={j}
                    className="h-4 w-full animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Error State
function SubscriptionOverviewError({ error }: { error: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Unable to Load Subscription
        </CardTitle>
        <CardDescription>
          {error.message || "There was an error loading your subscription information."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

// No Subscription State
function NoSubscriptionState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No Active Subscription</CardTitle>
        <CardDescription>
          You don't have an active subscription. Choose a plan to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button>View Plans</Button>
      </CardContent>
    </Card>
  );
}
