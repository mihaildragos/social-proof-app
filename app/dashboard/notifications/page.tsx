import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Plus,
  Search,
  BarChart3,
  Play,
  Pause,
  Copy,
  Edit,
  Eye,
  Target,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Notifications | Social Proof Dashboard",
  description: "Manage your social proof notifications, templates, and campaigns",
};

// Mock data - in real app this would come from API
const mockNotifications = [
  {
    id: 1,
    name: "Recent Purchase Alert",
    type: "purchase",
    status: "active",
    site: "example.com",
    template: "Purchase Template",
    displays: 1203,
    clicks: 321,
    conversions: 45,
    ctr: 26.7,
    lastActivity: "2 minutes ago",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "New User Signup",
    type: "signup",
    status: "active",
    site: "app.example.com",
    template: "Signup Template",
    displays: 892,
    clicks: 156,
    conversions: 23,
    ctr: 17.5,
    lastActivity: "1 hour ago",
    createdAt: "2024-01-12",
  },
  {
    id: 3,
    name: "Limited Time Offer",
    type: "custom",
    status: "paused",
    site: "store.example.com",
    template: "Urgency Template",
    displays: 445,
    clicks: 89,
    conversions: 12,
    ctr: 20.0,
    lastActivity: "3 hours ago",
    createdAt: "2024-01-10",
  },
];

const mockTemplates = [
  {
    id: 1,
    name: "Purchase Template",
    type: "purchase",
    description: "Show recent purchases to build trust",
    usage: 12,
    preview: "John from New York just purchased Premium Plan",
  },
  {
    id: 2,
    name: "Signup Template",
    type: "signup",
    description: "Display new user registrations",
    usage: 8,
    preview: "Sarah just joined 2 minutes ago",
  },
  {
    id: 3,
    name: "Urgency Template",
    type: "custom",
    description: "Create urgency with limited time offers",
    usage: 5,
    preview: "Only 3 spots left! 15 people viewing this page",
  },
];

const mockCampaigns = [
  {
    id: 1,
    name: "Black Friday Sale",
    status: "active",
    notifications: 3,
    startDate: "2024-01-01",
    endDate: "2024-01-31",
    totalDisplays: 15420,
    totalClicks: 3240,
    conversions: 156,
  },
  {
    id: 2,
    name: "New Product Launch",
    status: "scheduled",
    notifications: 2,
    startDate: "2024-02-01",
    endDate: "2024-02-15",
    totalDisplays: 0,
    totalClicks: 0,
    conversions: 0,
  },
];

function NotificationCard({ notification }: { notification: (typeof mockNotifications)[0] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{notification.name}</CardTitle>
              <CardDescription>
                {notification.site} • {notification.template}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={notification.status === "active" ? "default" : "secondary"}>
              {notification.status}
            </Badge>
            <Button size="sm">
              {notification.status === "active" ?
                <Pause className="h-4 w-4" />
              : <Play className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {notification.displays.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Displays</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {notification.clicks.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Clicks</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{notification.conversions}</div>
            <div className="text-xs text-gray-500">Conversions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{notification.ctr}%</div>
            <div className="text-xs text-gray-500">CTR</div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
          <span>Last activity: {notification.lastActivity}</span>
          <span>Created: {new Date(notification.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="text-xs"
          >
            {notification.type}
          </Badge>
          <div className="flex space-x-2">
            <Button size="sm">
              <Eye className="mr-1 h-3 w-3" />
              Preview
            </Button>
            <Button size="sm">
              <BarChart3 className="mr-1 h-3 w-3" />
              Analytics
            </Button>
            <Button size="sm">
              <Edit className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template }: { template: (typeof mockTemplates)[0] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <Badge variant="secondary">{template.usage} uses</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg bg-gray-50 p-3">
          <p className="text-sm text-gray-700">{template.preview}</p>
        </div>
        <div className="flex space-x-2">
          <Button size="sm">
            <Copy className="mr-1 h-3 w-3" />
            Use Template
          </Button>
          <Button size="sm">
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campaign }: { campaign: (typeof mockCampaigns)[0] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <CardDescription>
                {campaign.notifications} notifications •{" "}
                {new Date(campaign.startDate).toLocaleDateString()} -{" "}
                {new Date(campaign.endDate).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={
              campaign.status === "active" ? "default"
              : campaign.status === "scheduled" ?
                "secondary"
              : "destructive"
            }
          >
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {campaign.totalDisplays.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Displays</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">
              {campaign.totalClicks.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Clicks</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{campaign.conversions}</div>
            <div className="text-xs text-gray-500">Conversions</div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button size="sm">
            <BarChart3 className="mr-1 h-3 w-3" />
            View Results
          </Button>
          <Button size="sm">
            <Edit className="mr-1 h-3 w-3" />
            Edit Campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">
            Manage your social proof notifications, templates, and campaigns
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Notification
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="notifications"
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent
          value="notifications"
          className="space-y-6"
        >
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search notifications..."
                    className="pl-10"
                  />
                </div>
                <Button>Filter</Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Grid */}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {mockNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="templates"
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-gray-600">Pre-built templates to get you started quickly</p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="campaigns"
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              Organize notifications into campaigns for better management
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {mockCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
