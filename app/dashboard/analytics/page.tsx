import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  Users,
  Target,
  Calendar,
  Download,
  Filter,
  RefreshCw,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Analytics | Social Proof Dashboard",
  description: "Analyze your social proof performance and user engagement",
};

// Mock data - in real app this would come from API
const mockAnalytics = {
  overview: {
    totalViews: 45672,
    totalClicks: 12847,
    totalConversions: 1234,
    conversionRate: 2.7,
    avgEngagementTime: 4.2,
    bounceRate: 23.5,
    trends: {
      views: 12.5,
      clicks: 8.2,
      conversions: 15.3,
      conversionRate: 0.3,
    },
  },
  topNotifications: [
    { name: "Recent Purchase Alert", views: 12847, clicks: 3421, ctr: 26.6, conversions: 456 },
    { name: "New User Signup", views: 8934, clicks: 2156, ctr: 24.1, conversions: 234 },
    { name: "Limited Time Offer", views: 6723, clicks: 1456, ctr: 21.7, conversions: 189 },
    { name: "Product Review", views: 4521, clicks: 892, ctr: 19.7, conversions: 123 },
  ],
  topSites: [
    { domain: "example.com", views: 18934, clicks: 4521, conversions: 567, revenue: 12450 },
    { domain: "store.example.com", views: 15672, clicks: 3847, conversions: 445, revenue: 9870 },
    { domain: "app.example.com", views: 11234, clicks: 2156, conversions: 222, revenue: 5430 },
  ],
  timeData: [
    { date: "2024-01-01", views: 1234, clicks: 345, conversions: 23 },
    { date: "2024-01-02", views: 1456, clicks: 389, conversions: 28 },
    { date: "2024-01-03", views: 1678, clicks: 423, conversions: 31 },
    { date: "2024-01-04", views: 1345, clicks: 367, conversions: 25 },
    { date: "2024-01-05", views: 1789, clicks: 456, conversions: 34 },
    { date: "2024-01-06", views: 1567, clicks: 398, conversions: 29 },
    { date: "2024-01-07", views: 1890, clicks: 478, conversions: 37 },
  ],
};

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  change: number;
  icon: any;
  trend: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <p className="flex items-center text-xs text-muted-foreground">
          {trend === "up" ?
            <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
          : <TrendingDown className="mr-1 h-3 w-3 text-red-600" />}
          <span className={trend === "up" ? "text-green-600" : "text-red-600"}>
            {change > 0 ? "+" : ""}
            {change}%
          </span>
          <span className="ml-1">from last month</span>
        </p>
      </CardContent>
    </Card>
  );
}

function SimpleChart({ data, title }: { data: any[]; title: string }) {
  const maxValue = Math.max(...data.map((d) => d.views));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>Last 7 days performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex items-center space-x-3"
            >
              <div className="w-16 text-xs text-gray-500">
                {new Date(item.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2 rounded bg-blue-500"
                    style={{ width: `${(item.views / maxValue) * 100}%` }}
                  />
                  <span className="text-sm text-gray-600">{item.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopPerformersTable({
  data,
  title,
  type,
}: {
  data: any[];
  title: string;
  type: "notifications" | "sites";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>Best performing {type} this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {type === "notifications" ? item.name : item.domain}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.views.toLocaleString()} views • {item.clicks.toLocaleString()} clicks
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary">
                  {type === "notifications" ?
                    `${item.ctr}% CTR`
                  : `$${item.revenue.toLocaleString()}`}
                </Badge>
                <p className="mt-1 text-xs text-gray-500">{item.conversions} conversions</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Analyze your social proof performance and user engagement</p>
        </div>
        <div className="flex space-x-3">
          <Select defaultValue="30d">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Views"
          value={mockAnalytics.overview.totalViews}
          change={mockAnalytics.overview.trends.views}
          icon={Eye}
          trend="up"
        />
        <MetricCard
          title="Total Clicks"
          value={mockAnalytics.overview.totalClicks}
          change={mockAnalytics.overview.trends.clicks}
          icon={MousePointer}
          trend="up"
        />
        <MetricCard
          title="Conversions"
          value={mockAnalytics.overview.totalConversions}
          change={mockAnalytics.overview.trends.conversions}
          icon={Target}
          trend="up"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${mockAnalytics.overview.conversionRate}%`}
          change={mockAnalytics.overview.trends.conversionRate}
          icon={TrendingUp}
          trend="up"
        />
      </div>

      {/* Charts and Tables */}
      <Tabs
        defaultValue="overview"
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <SimpleChart
              data={mockAnalytics.timeData}
              title="Views Over Time"
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Metrics</CardTitle>
                <CardDescription>User interaction statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Avg. Engagement Time</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.avgEngagementTime}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Bounce Rate</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.bounceRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Click-through Rate</span>
                    <span className="text-sm font-medium">
                      {(
                        (mockAnalytics.overview.totalClicks / mockAnalytics.overview.totalViews) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Conversion Rate</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.conversionRate}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="notifications"
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <TopPerformersTable
              data={mockAnalytics.topNotifications}
              title="Top Notifications"
              type="notifications"
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Types</CardTitle>
                <CardDescription>Performance by notification type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="text-sm">Purchase Alerts</span>
                    </div>
                    <span className="text-sm font-medium">45%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">Signup Notifications</span>
                    </div>
                    <span className="text-sm font-medium">30%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-yellow-500" />
                      <span className="text-sm">Custom Messages</span>
                    </div>
                    <span className="text-sm font-medium">25%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="sites"
          className="space-y-6"
        >
          <TopPerformersTable
            data={mockAnalytics.topSites}
            title="Top Performing Sites"
            type="sites"
          />
        </TabsContent>

        <TabsContent
          value="conversions"
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conversion Funnel</CardTitle>
                <CardDescription>User journey through notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notifications Shown</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.totalViews.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notifications Clicked</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.totalClicks.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Conversions</span>
                    <span className="text-sm font-medium">
                      {mockAnalytics.overview.totalConversions.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Impact</CardTitle>
                <CardDescription>Revenue attributed to social proof</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Revenue</span>
                    <span className="text-sm font-medium">$27,750</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Avg. Order Value</span>
                    <span className="text-sm font-medium">$22.50</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Revenue per Click</span>
                    <span className="text-sm font-medium">$2.16</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
