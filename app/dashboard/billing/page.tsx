"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  FileText,
  Settings,
  TrendingUp,
  AlertTriangle,
  Plus,
  Download,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { PlanSelection } from "@/components/billing/plan-selection";
import { useBilling } from "@/hooks/use-billing";
import { useOrganization } from "@clerk/nextjs";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Mock data - in real app this would come from API
const mockBilling = {
  subscription: {
    plan: "Professional",
    status: "active",
    price: 49,
    currency: "USD",
    interval: "month",
    currentPeriodStart: "2024-01-01",
    currentPeriodEnd: "2024-02-01",
    nextBillingDate: "2024-02-01",
    cancelAtPeriodEnd: false,
  },
  usage: {
    notifications: {
      used: 8547,
      limit: 10000,
      percentage: 85.47,
    },
    sites: {
      used: 3,
      limit: 5,
      percentage: 60,
    },
    teamMembers: {
      used: 4,
      limit: 10,
      percentage: 40,
    },
  },
  invoices: [
    {
      id: "inv_001",
      date: "2024-01-01",
      amount: 49,
      status: "paid",
      description: "Professional Plan - January 2024",
      downloadUrl: "#",
    },
    {
      id: "inv_002",
      date: "2023-12-01",
      amount: 49,
      status: "paid",
      description: "Professional Plan - December 2023",
      downloadUrl: "#",
    },
    {
      id: "inv_003",
      date: "2023-11-01",
      amount: 49,
      status: "paid",
      description: "Professional Plan - November 2023",
      downloadUrl: "#",
    },
  ],
  paymentMethod: {
    type: "card",
    last4: "4242",
    brand: "Visa",
    expiryMonth: 12,
    expiryYear: 2025,
  },
};

const plans = [
  {
    name: "Starter",
    price: 19,
    interval: "month",
    features: [
      "2,500 notifications/month",
      "2 sites",
      "3 team members",
      "Basic analytics",
      "Email support",
    ],
    current: false,
  },
  {
    name: "Professional",
    price: 49,
    interval: "month",
    features: [
      "10,000 notifications/month",
      "5 sites",
      "10 team members",
      "Advanced analytics",
      "Priority support",
      "A/B testing",
    ],
    current: true,
  },
  {
    name: "Enterprise",
    price: 149,
    interval: "month",
    features: [
      "Unlimited notifications",
      "Unlimited sites",
      "Unlimited team members",
      "Custom analytics",
      "Dedicated support",
      "Custom integrations",
    ],
    current: false,
  },
];

function UsageCard({
  title,
  used,
  limit,
  percentage,
  icon: Icon,
}: {
  title: string;
  used: number;
  limit: number | string;
  percentage: number;
  icon: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{used.toLocaleString()}</div>
        <p className="mb-3 text-xs text-muted-foreground">
          of {typeof limit === "number" ? limit.toLocaleString() : limit} used
        </p>
        <Progress
          value={percentage}
          className="h-2"
        />
        <p className="mt-2 text-xs text-muted-foreground">{percentage.toFixed(1)}% used</p>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan }: { plan: (typeof plans)[0] }) {
  return (
    <Card className={plan.current ? "border-blue-500 bg-blue-50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {plan.current && <Badge>Current Plan</Badge>}
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-gray-500">/{plan.interval}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="mb-6 space-y-2">
          {plan.features.map((feature, index) => (
            <li
              key={index}
              className="flex items-center space-x-2 text-sm"
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          disabled={plan.current}
        >
          {plan.current ? "Current Plan" : "Upgrade"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: (typeof mockBilling.invoices)[0] }) {
  return (
    <div className="flex items-center justify-between border-b py-4 last:border-b-0">
      <div className="flex items-center space-x-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <CreditCard className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{invoice.description}</p>
          <p className="text-sm text-gray-500">{new Date(invoice.date).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="font-medium text-gray-900">${invoice.amount}</p>
          <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
            {invoice.status}
          </Badge>
        </div>
        <Button
          variant="default"
          size="sm"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { organization } = useOrganization();
  const billing = useBilling();

  const handlePlanSelection = (planId: string, billingCycle: "monthly" | "yearly") => {
    // This would open a payment modal or redirect to checkout
    console.log("Selected plan:", planId, billingCycle);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription, billing, and usage for {organization?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="default"
            size="sm"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {billing.subscription?.plan.display_name || "No Plan"}
            </div>
            <p className="text-xs text-muted-foreground">
              {billing.subscription?.subscription.billing_cycle || "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(billing.subscription?.plan.price_monthly || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {billing.usage?.total_overage_amount ?
                `+${formatCurrency(billing.usage.total_overage_amount)} overage`
              : "No overage"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {billing.subscription?.subscription.current_period_end ?
                new Date(billing.subscription.subscription.current_period_end).toLocaleDateString()
              : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {billing.subscription?.subscription.cancels_at_period_end ?
                "Subscription ends"
              : "Next payment"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge
                variant={
                  billing.subscription?.subscription.status === "active" ? "default"
                  : billing.subscription?.subscription.status === "trialing" ?
                    "secondary"
                  : "destructive"
                }
              >
                {billing.subscription?.subscription.status || "No subscription"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Subscription status</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent
          value="overview"
          className="space-y-6"
        >
          <SubscriptionOverview />
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent
          value="plans"
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Choose Your Plan</h2>
              <p className="text-muted-foreground">Select the plan that best fits your needs</p>
            </div>
          </div>
          <PlanSelection onSelectPlan={handlePlanSelection} />
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent
          value="invoices"
          className="space-y-6"
        >
          <InvoicesSection invoices={billing.invoices} />
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent
          value="payment"
          className="space-y-6"
        >
          <PaymentMethodsSection paymentMethods={billing.paymentMethods} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Invoices Section Component
function InvoicesSection({ invoices }: { invoices: any[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-muted-foreground">View and download your billing history</p>
        </div>
        <Button variant="default">
          <Download className="mr-2 h-4 w-4" />
          Download All
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Your billing history and invoice downloads</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ?
            <div className="py-8 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No invoices yet</h3>
              <p className="text-muted-foreground">
                Your invoices will appear here once you have an active subscription
              </p>
            </div>
          : <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center space-x-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Invoice #{invoice.number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium">${invoice.total}</p>
                      <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}

// Payment Methods Section Component
function PaymentMethodsSection({ paymentMethods }: { paymentMethods: any[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment Methods</h2>
          <p className="text-muted-foreground">
            Manage your payment methods and billing information
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Payment Methods</CardTitle>
          <CardDescription>Your saved cards and payment methods</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ?
            <div className="py-8 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No payment methods</h3>
              <p className="mb-4 text-muted-foreground">
                Add a payment method to manage your subscription
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            </div>
          : <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center space-x-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {method.brand.toUpperCase()} •••• {method.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {method.is_default && <Badge variant="default">Default</Badge>}
                    <Button
                      variant="default"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
