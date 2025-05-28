import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  Mail,
  Webhook,
  Key,
  Globe,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations | Social Proof Dashboard",
  description: "Connect your favorite tools and platforms",
};

// Mock data - in real app this would come from API
const availableIntegrations = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Connect your Shopify store to show real-time purchase notifications",
    category: "E-commerce",
    icon: ShoppingBag,
    color: "bg-green-100 text-green-600",
    connected: true,
    popular: true,
    features: ["Purchase notifications", "Product data sync", "Customer analytics"],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Integrate with your WordPress WooCommerce store",
    category: "E-commerce",
    icon: ShoppingBag,
    color: "bg-purple-100 text-purple-600",
    connected: false,
    popular: true,
    features: ["Order notifications", "Product sync", "Customer tracking"],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Show payment notifications from your Stripe account",
    category: "Payments",
    icon: Zap,
    color: "bg-blue-100 text-blue-600",
    connected: true,
    popular: true,
    features: ["Payment notifications", "Subscription tracking", "Revenue analytics"],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send notification emails through SendGrid",
    category: "Email",
    icon: Mail,
    color: "bg-blue-100 text-blue-600",
    connected: false,
    popular: false,
    features: ["Email notifications", "Template management", "Delivery tracking"],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect with 3000+ apps through Zapier automation",
    category: "Automation",
    icon: Zap,
    color: "bg-orange-100 text-orange-600",
    connected: false,
    popular: true,
    features: ["Custom triggers", "Multi-app workflows", "Data transformation"],
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send data to any endpoint with custom webhooks",
    category: "Developer",
    icon: Webhook,
    color: "bg-gray-100 text-gray-600",
    connected: false,
    popular: false,
    features: ["Custom endpoints", "Real-time data", "Flexible payload"],
  },
];

const connectedIntegrations = availableIntegrations.filter((integration) => integration.connected);

function IntegrationCard({ integration }: { integration: (typeof availableIntegrations)[0] }) {
  const Icon = integration.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${integration.color}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <span>{integration.name}</span>
                {integration.popular && <Badge variant="secondary">Popular</Badge>}
              </CardTitle>
              <CardDescription>{integration.category}</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {integration.connected ?
              <Badge
                variant="default"
                className="bg-green-100 text-green-800"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            : <Badge variant="secondary">Not Connected</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-gray-600">{integration.description}</p>

        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-gray-900">Features:</p>
          <ul className="space-y-1">
            {integration.features.map((feature, index) => (
              <li
                key={index}
                className="flex items-center space-x-2 text-sm text-gray-600"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex space-x-2">
          {integration.connected ?
            <>
              <Button size="sm">
                <Settings className="mr-1 h-3 w-3" />
                Configure
              </Button>
              <Button size="sm">Disconnect</Button>
            </>
          : <Button
              size="sm"
              className="w-full"
            >
              <Plus className="mr-1 h-3 w-3" />
              Connect
            </Button>
          }
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectedIntegrationCard({
  integration,
}: {
  integration: (typeof availableIntegrations)[0];
}) {
  const Icon = integration.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${integration.color}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{integration.name}</p>
              <p className="text-sm text-gray-500">Connected • Active</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant="default"
              className="bg-green-100 text-green-800"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Active
            </Badge>
            <Button size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const categories = Array.from(new Set(availableIntegrations.map((i) => i.category)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Connect your favorite tools and platforms</p>
        </div>
        <Button>
          <Key className="mr-2 h-4 w-4" />
          API Keys
        </Button>
      </div>

      {/* Integration Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedIntegrations.length}</div>
            <p className="text-xs text-muted-foreground">
              of {availableIntegrations.length} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">integration types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Synced</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.7k</div>
            <p className="text-xs text-muted-foreground">events this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">active endpoints</p>
          </CardContent>
        </Card>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Connected Integrations</h2>
          <div className="space-y-4">
            {connectedIntegrations.map((integration) => (
              <ConnectedIntegrationCard
                key={integration.id}
                integration={integration}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Integrations by Category */}
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-4 text-xl font-semibold text-gray-900">{category}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableIntegrations
              .filter((integration) => integration.category === category)
              .map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                />
              ))}
          </div>
        </div>
      ))}

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Developer Resources</CardTitle>
          <CardDescription>Build custom integrations with our API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">API Documentation</h3>
              <p className="text-sm text-gray-600">Complete reference for our REST API endpoints</p>
              <Button size="sm">
                <ExternalLink className="mr-1 h-3 w-3" />
                View Docs
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Webhook Guide</h3>
              <p className="text-sm text-gray-600">Learn how to receive real-time notifications</p>
              <Button size="sm">
                <ExternalLink className="mr-1 h-3 w-3" />
                Learn More
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">SDKs & Libraries</h3>
              <p className="text-sm text-gray-600">
                Official libraries for popular programming languages
              </p>
              <Button size="sm">
                <ExternalLink className="mr-1 h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Integration Request */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Plus className="mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Need a Custom Integration?</h3>
          <p className="mb-6 max-w-sm text-center text-gray-500">
            Don't see the integration you need? Let us know and we'll consider adding it to our
            roadmap.
          </p>
          <Button>Request Integration</Button>
        </CardContent>
      </Card>
    </div>
  );
}
 