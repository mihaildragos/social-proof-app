"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Check, Star, Zap, Shield, Users, BarChart3 } from "lucide-react";
import { formatCurrency } from "../../lib/utils";
import { usePlans, useSubscription } from "../../hooks/use-billing";
import { PlanWithDetails } from "../../lib/api/billing-types";

interface PlanSelectionProps {
  onSelectPlan?: (planId: string, billingCycle: "monthly" | "yearly") => void;
  className?: string;
}

export function PlanSelection({ onSelectPlan, className }: PlanSelectionProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const { plans, isLoading, error } = usePlans();
  const { subscription } = useSubscription();

  if (isLoading) {
    return <PlanSelectionSkeleton />;
  }

  if (error) {
    return <PlanSelectionError error={error} />;
  }

  const handleSelectPlan = (planId: string) => {
    onSelectPlan?.(planId, billingCycle);
  };

  const currentPlanId = subscription?.plan.id;

  return (
    <div className={className}>
      {/* Billing Cycle Toggle */}
      <div className="mb-8 flex items-center justify-center space-x-4">
        <span
          className={`text-sm ${billingCycle === "monthly" ? "font-medium" : "text-muted-foreground"}`}
        >
          Monthly
        </span>
        <Switch
          checked={billingCycle === "yearly"}
          onCheckedChange={(checked) => setBillingCycle(checked ? "yearly" : "monthly")}
        />
        <span
          className={`text-sm ${billingCycle === "yearly" ? "font-medium" : "text-muted-foreground"}`}
        >
          Yearly
        </span>
        {billingCycle === "yearly" && (
          <Badge
            variant="secondary"
            className="ml-2"
          >
            Save 20%
          </Badge>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.plan.id}
            plan={plan}
            billingCycle={billingCycle}
            isCurrentPlan={plan.plan.id === currentPlanId}
            onSelect={() => handleSelectPlan(plan.plan.id)}
          />
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="mt-12">
        <h3 className="mb-6 text-lg font-semibold">Feature Comparison</h3>
        <FeatureComparison plans={plans} />
      </div>
    </div>
  );
}

// Individual Plan Card Component
interface PlanCardProps {
  plan: PlanWithDetails;
  billingCycle: "monthly" | "yearly";
  isCurrentPlan: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, billingCycle, isCurrentPlan, onSelect }: PlanCardProps) {
  // Convert string prices to numbers with safety checks
  const priceMonthly = typeof plan.plan.price_monthly === 'string' 
    ? parseFloat(plan.plan.price_monthly) 
    : plan.plan.price_monthly;
  const priceYearly = typeof plan.plan.price_yearly === 'string' 
    ? parseFloat(plan.plan.price_yearly) 
    : plan.plan.price_yearly;
  
  // Ensure we have valid numbers, fallback to 0 if not
  const validPriceMonthly = isNaN(priceMonthly) || priceMonthly == null ? 0 : priceMonthly;
  const validPriceYearly = isNaN(priceYearly) || priceYearly == null ? 0 : priceYearly;
  
  const price = billingCycle === "monthly" ? validPriceMonthly : validPriceYearly;
  const monthlyPrice = billingCycle === "yearly" ? price / 12 : price;
  const isPopular = plan.plan.name === "pro"; // Assuming "pro" is the popular plan
  const isEnterprise = plan.plan.name === "enterprise";

  return (
    <Card
      className={`relative ${isPopular ? "border-primary shadow-lg" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <Badge className="bg-primary text-primary-foreground">
            <Star className="mr-1 h-3 w-3" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center">
        <div className="mb-2 flex items-center justify-center">
          <PlanIcon planName={plan.plan.name} />
        </div>
        <CardTitle className="text-xl">{plan.plan.display_name}</CardTitle>
        <CardDescription>{plan.plan.description}</CardDescription>

        <div className="mt-4">
          <div className="text-3xl font-bold">
            ${monthlyPrice.toFixed(0)}
            <span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
          {billingCycle === "yearly" && (
            <div className="text-sm text-muted-foreground">Billed ${price.toFixed(0)} yearly</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Features */}
        <div className="space-y-2">
          {plan.features
            .filter((f) => f.is_highlighted)
            .map((feature) => (
              <div
                key={feature.id}
                className="flex items-center space-x-2"
              >
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm">{feature.name}</span>
              </div>
            ))}
        </div>

        {/* Limits */}
        <div className="space-y-2">
          {plan.limits.map((limit) => (
            <div
              key={limit.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="capitalize">{limit.resource_type.replace("_", " ")}</span>
              <span className="font-medium">
                {limit.max_value === -1 ? "Unlimited" : limit.max_value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Action Button */}
        <Button
          className="w-full"
          variant={
            isCurrentPlan ? "outline"
            : isPopular ?
              "default"
            : "outline"
          }
          onClick={onSelect}
          disabled={isCurrentPlan}
        >
          {isCurrentPlan ?
            "Current Plan"
          : isEnterprise ?
            "Contact Sales"
          : "Get Started"}
        </Button>

        {isEnterprise && (
          <p className="text-center text-xs text-muted-foreground">
            Custom pricing and features available
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Plan Icon Component
function PlanIcon({ planName }: { planName: string }) {
  const icons = {
    starter: <Zap className="h-6 w-6 text-blue-600" />,
    pro: <BarChart3 className="h-6 w-6 text-purple-600" />,
    enterprise: <Shield className="h-6 w-6 text-green-600" />,
  };

  return icons[planName as keyof typeof icons] || <Users className="h-6 w-6 text-gray-600" />;
}

// Feature Comparison Table
function FeatureComparison({ plans }: { plans: PlanWithDetails[] }) {
  // Get all unique features across all plans
  const allFeatures = Array.from(
    new Set(plans.flatMap((plan) => plan.features.map((f) => f.name)))
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-4 text-left font-medium">Features</th>
            {plans.map((plan) => (
              <th
                key={plan.plan.id}
                className="p-4 text-center font-medium"
              >
                {plan.plan.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allFeatures.map((featureName) => (
            <tr
              key={featureName}
              className="border-b"
            >
              <td className="p-4 font-medium">{featureName}</td>
              {plans.map((plan) => {
                const feature = plan.features.find((f) => f.name === featureName);
                return (
                  <td
                    key={plan.plan.id}
                    className="p-4 text-center"
                  >
                    {feature ?
                      feature.feature_type === "boolean" ?
                        feature.value ?
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        : <span className="text-muted-foreground">-</span>
                      : <span className="font-medium">{feature.value}</span>
                    : <span className="text-muted-foreground">-</span>}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Resource Limits */}
          {plans.length > 0 &&
            plans[0].limits.map((limit) => (
              <tr
                key={limit.resource_type}
                className="border-b"
              >
                <td className="p-4 font-medium capitalize">
                  {limit.resource_type.replace("_", " ")}
                </td>
                {plans.map((plan) => {
                  const planLimit = plan.limits.find(
                    (l) => l.resource_type === limit.resource_type
                  );
                  return (
                    <td
                      key={plan.plan.id}
                      className="p-4 text-center font-medium"
                    >
                      {planLimit?.max_value === -1 ?
                        "Unlimited"
                      : planLimit?.max_value?.toLocaleString() || "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// Loading Skeleton
function PlanSelectionSkeleton() {
  return (
    <div className="space-y-8">
      {/* Billing Toggle Skeleton */}
      <div className="flex items-center justify-center space-x-4">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-6 w-12 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>

      {/* Plans Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto h-6 w-6 animate-pulse rounded bg-muted" />
              <div className="mx-auto h-6 w-24 animate-pulse rounded bg-muted" />
              <div className="mx-auto h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mx-auto h-8 w-20 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div
                  key={j}
                  className="h-4 w-full animate-pulse rounded bg-muted"
                />
              ))}
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Error State
function PlanSelectionError({ error }: { error: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unable to Load Plans</CardTitle>
        <CardDescription>
          {error.message || "There was an error loading the available plans."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
