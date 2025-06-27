import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Globe,
  Plus,
  Search,
  Settings,
  BarChart3,
  ExternalLink,
  Copy,
  MoreHorizontal,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Sites | Social Proof Dashboard",
  description: "Manage your websites and their social proof notifications",
};

// Mock data - in real app this would come from API
const mockSites = [
  {
    id: 1,
    name: "Main Website",
    domain: "example.com",
    status: "active",
    notifications: 4521,
    clicks: 1203,
    conversionRate: 26.6,
    lastActivity: "2 minutes ago",
    integrations: ["shopify", "stripe"],
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "E-commerce Store",
    domain: "store.example.com",
    status: "active",
    notifications: 3847,
    clicks: 892,
    conversionRate: 23.2,
    lastActivity: "1 hour ago",
    integrations: ["woocommerce", "stripe"],
    createdAt: "2024-01-10",
  },
  {
    id: 3,
    name: "Mobile App Landing",
    domain: "app.example.com",
    status: "active",
    notifications: 2156,
    clicks: 445,
    conversionRate: 20.6,
    lastActivity: "3 hours ago",
    integrations: ["custom"],
    createdAt: "2024-01-05",
  },
  {
    id: 4,
    name: "Beta Testing Site",
    domain: "beta.example.com",
    status: "paused",
    notifications: 156,
    clicks: 23,
    conversionRate: 14.7,
    lastActivity: "2 days ago",
    integrations: [],
    createdAt: "2023-12-20",
  },
];

function SiteCard({ site }: { site: (typeof mockSites)[0] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{site.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>{site.domain}</span>
                <ExternalLink className="h-3 w-3" />
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={site.status === "active" ? "default" : "secondary"}>
              {site.status}
            </Badge>
            <Button size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {site.notifications.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Notifications</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{site.clicks.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Clicks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{site.conversionRate}%</div>
            <div className="text-xs text-gray-500">Conversion</div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
          <span>Last activity: {site.lastActivity}</span>
          <span>Created: {new Date(site.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {site.integrations.map((integration) => (
              <Badge
                key={integration}
                variant="secondary"
                className="text-xs"
              >
                {integration}
              </Badge>
            ))}
            {site.integrations.length === 0 && (
              <span className="text-xs text-gray-400">No integrations</span>
            )}
          </div>
          <div className="flex space-x-2">
            <Button size="sm">
              <BarChart3 className="mr-1 h-3 w-3" />
              Analytics
            </Button>
            <Button size="sm">
              <Settings className="mr-1 h-3 w-3" />
              Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SitesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sites</h1>
          <p className="text-gray-600">Manage your websites and their social proof notifications</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New Site
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search sites..."
                className="pl-10"
              />
            </div>
            <Button>Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sites Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {mockSites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
          />
        ))}
      </div>

      {/* Empty State (when no sites) */}
      {mockSites.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No sites yet</h3>
            <p className="mb-6 max-w-sm text-center text-gray-500">
              Get started by adding your first website to begin showing social proof notifications.
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Site
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Installation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Installation Instructions</CardTitle>
          <CardDescription>
            Add this script to your website to start showing social proof notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-gray-50 p-4">
            <code className="text-sm text-gray-800">
              {`<script src="https://cdn.socialproof.com/widget.js" data-site-id="your-site-id"></script>`}
            </code>
            <Button
              size="sm"
              className="ml-2"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Replace "your-site-id" with your actual site ID from the site settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
