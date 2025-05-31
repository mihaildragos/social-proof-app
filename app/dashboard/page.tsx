import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Users,
  MousePointer,
  TrendingUp,
  Bell,
  Globe,
  Activity,
  Plus,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard Overview | Social Proof",
  description: "Overview of your social proof performance and metrics",
};

// Mock data - in real app this would come from API
const mockMetrics = {
  totalNotifications: 12847,
  totalClicks: 3421,
  conversionRate: 2.67,
  activeSites: 8,
  recentActivity: [
    {
      id: 1,
      type: "notification_created",
      message: 'New notification "Recent Purchase" created for example.com',
      timestamp: "2 minutes ago",
      status: "success",
    },
    {
      id: 2,
      type: "site_connected",
      message: "Shopify integration connected for store.example.com",
      timestamp: "1 hour ago",
      status: "success",
    },
    {
      id: 3,
      type: "campaign_ended",
      message: 'Campaign "Black Friday Sale" ended with 847 conversions',
      timestamp: "3 hours ago",
      status: "info",
    },
    {
      id: 4,
      type: "payment_received",
      message: "Monthly subscription payment received",
      timestamp: "1 day ago",
      status: "success",
    },
  ],
  topPerformingSites: [
    { name: "example.com", notifications: 4521, clicks: 1203, ctr: 26.6 },
    { name: "store.example.com", notifications: 3847, clicks: 892, ctr: 23.2 },
    { name: "app.example.com", notifications: 2156, clicks: 445, ctr: 20.6 },
  ],
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here's what's happening with your social proof.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="default">
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
          <Button>
            <Bell className="mr-2 h-4 w-4" />
            Create Notification
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockMetrics.totalNotifications.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+8.2%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+0.3%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.activeSites}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+2</span> new this month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest updates from your social proof campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMetrics.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3"
                >
                  <div
                    className={`mt-1 h-2 w-2 rounded-full ${
                      activity.status === "success" ? "bg-green-500"
                      : activity.status === "info" ? "bg-blue-500"
                      : "bg-gray-500"
                    }`}
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button
                variant="default"
                size="sm"
                className="w-full"
              >
                View All Activity
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Sites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Top Performing Sites
            </CardTitle>
            <CardDescription>Sites with the highest engagement rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMetrics.topPerformingSites.map((site, index) => (
                <div
                  key={site.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{site.name}</p>
                      <p className="text-xs text-gray-500">
                        {site.notifications.toLocaleString()} notifications
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{site.ctr}% CTR</Badge>
                    <p className="mt-1 text-xs text-gray-500">
                      {site.clicks.toLocaleString()} clicks
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button
                variant="default"
                size="sm"
                className="w-full"
              >
                View All Sites
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="default"
              className="h-20 flex-col space-y-2"
            >
              <Bell className="h-6 w-6" />
              <span>Create Notification</span>
            </Button>
            <Button
              variant="default"
              className="h-20 flex-col space-y-2"
            >
              <Globe className="h-6 w-6" />
              <span>Add New Site</span>
            </Button>
            <Button
              variant="default"
              className="h-20 flex-col space-y-2"
            >
              <Users className="h-6 w-6" />
              <span>Invite Team Member</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
