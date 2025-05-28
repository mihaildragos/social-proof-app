"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Users,
  MousePointer,
  TrendingUp,
  Eye,
  Clock,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSSE } from "@/hooks/useSSE";

export interface AnalyticsData {
  timestamp: number;
  notifications: number;
  clicks: number;
  impressions: number;
  conversions: number;
  activeUsers: number;
  ctr: number;
  conversionRate: number;
}

export interface RealTimeMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  changeType: "increase" | "decrease" | "neutral";
  icon: React.ComponentType<any>;
  color: string;
  format: "number" | "percentage" | "currency" | "duration";
}

export interface RealTimeChartsProps {
  siteId: string;
  websocketUrl?: string;
  sseUrl?: string;
  refreshInterval?: number;
  maxDataPoints?: number;
}

const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.danger,
];

export function RealTimeCharts({
  siteId,
  websocketUrl = `/api/ws/analytics/${siteId}`,
  sseUrl = `/api/sse/analytics/${siteId}`,
  refreshInterval = 5000,
  maxDataPoints = 50,
}: RealTimeChartsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [metrics, setMetrics] = useState<RealTimeMetric[]>([]);
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // WebSocket connection for real-time analytics
  const { isConnected: wsConnected } = useWebSocket({
    url: websocketUrl,
    onMessage: (message) => {
      if (message.type === "analytics" && message.payload) {
        updateAnalyticsData(message.payload);
      }
    },
  });

  // SSE connection as fallback
  const { isConnected: sseConnected } = useSSE({
    url: sseUrl,
    onMessage: (message) => {
      if (message.type === "analytics" && message.data) {
        updateAnalyticsData(message.data);
      }
    },
  });

  const updateAnalyticsData = useCallback(
    (newData: AnalyticsData) => {
      setAnalyticsData((prev) => {
        const updated = [...prev, newData];

        // Keep only the latest data points
        if (updated.length > maxDataPoints) {
          return updated.slice(-maxDataPoints);
        }

        return updated;
      });

      setLastUpdate(new Date());
      updateMetrics(newData);
    },
    [maxDataPoints]
  );

  const updateMetrics = useCallback(
    (latestData: AnalyticsData) => {
      setMetrics((prev) => {
        const previousData = analyticsData[analyticsData.length - 1];

        const newMetrics: RealTimeMetric[] = [
          {
            id: "active-users",
            name: "Active Users",
            value: latestData.activeUsers,
            change: previousData ? latestData.activeUsers - previousData.activeUsers : 0,
            changeType:
              previousData && latestData.activeUsers > previousData.activeUsers ?
                "increase"
              : "decrease",
            icon: Users,
            color: CHART_COLORS.primary,
            format: "number",
          },
          {
            id: "notifications",
            name: "Notifications Shown",
            value: latestData.notifications,
            change: previousData ? latestData.notifications - previousData.notifications : 0,
            changeType:
              previousData && latestData.notifications > previousData.notifications ?
                "increase"
              : "neutral",
            icon: Activity,
            color: CHART_COLORS.secondary,
            format: "number",
          },
          {
            id: "clicks",
            name: "Clicks",
            value: latestData.clicks,
            change: previousData ? latestData.clicks - previousData.clicks : 0,
            changeType:
              previousData && latestData.clicks > previousData.clicks ? "increase" : "neutral",
            icon: MousePointer,
            color: CHART_COLORS.accent,
            format: "number",
          },
          {
            id: "ctr",
            name: "Click-Through Rate",
            value: latestData.ctr,
            change: previousData ? latestData.ctr - previousData.ctr : 0,
            changeType: previousData && latestData.ctr > previousData.ctr ? "increase" : "decrease",
            icon: TrendingUp,
            color: CHART_COLORS.purple,
            format: "percentage",
          },
          {
            id: "impressions",
            name: "Impressions",
            value: latestData.impressions,
            change: previousData ? latestData.impressions - previousData.impressions : 0,
            changeType:
              previousData && latestData.impressions > previousData.impressions ?
                "increase"
              : "neutral",
            icon: Eye,
            color: CHART_COLORS.pink,
            format: "number",
          },
          {
            id: "conversion-rate",
            name: "Conversion Rate",
            value: latestData.conversionRate,
            change: previousData ? latestData.conversionRate - previousData.conversionRate : 0,
            changeType:
              previousData && latestData.conversionRate > previousData.conversionRate ?
                "increase"
              : "decrease",
            icon: Zap,
            color: CHART_COLORS.danger,
            format: "percentage",
          },
        ];

        return newMetrics;
      });
    },
    [analyticsData]
  );

  const formatValue = (value: number, format: RealTimeMetric["format"]) => {
    switch (format) {
      case "percentage":
        return `${value.toFixed(2)}%`;
      case "currency":
        return `$${value.toLocaleString()}`;
      case "duration":
        return `${Math.round(value)}s`;
      default:
        return value.toLocaleString();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Generate mock data for demonstration
  useEffect(() => {
    if (!wsConnected && !sseConnected && isAutoRefresh) {
      const interval = setInterval(() => {
        const mockData: AnalyticsData = {
          timestamp: Date.now(),
          notifications: Math.floor(Math.random() * 100) + 50,
          clicks: Math.floor(Math.random() * 30) + 10,
          impressions: Math.floor(Math.random() * 200) + 100,
          conversions: Math.floor(Math.random() * 10) + 2,
          activeUsers: Math.floor(Math.random() * 500) + 200,
          ctr: Math.random() * 15 + 5,
          conversionRate: Math.random() * 5 + 1,
        };
        updateAnalyticsData(mockData);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [wsConnected, sseConnected, isAutoRefresh, refreshInterval, updateAnalyticsData]);

  const connectionStatus =
    wsConnected ? "WebSocket"
    : sseConnected ? "SSE"
    : "Offline";
  const isConnected = wsConnected || sseConnected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-Time Analytics</h2>
          <p className="text-muted-foreground">
            Live performance metrics for your notification campaigns
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-muted-foreground">{connectionStatus}</span>
          </div>

          <Select
            value={timeRange}
            onValueChange={(value: any) => setTimeRange(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isAutoRefresh ? "animate-spin" : ""}`} />
            {isAutoRefresh ? "Auto" : "Manual"}
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                    <p className="text-2xl font-bold">{formatValue(metric.value, metric.format)}</p>
                  </div>
                  <Icon
                    className="h-8 w-8"
                    style={{ color: metric.color }}
                  />
                </div>

                {metric.change !== 0 && (
                  <div className="mt-2 flex items-center">
                    <Badge
                      variant={metric.changeType === "increase" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {metric.changeType === "increase" ? "+" : ""}
                      {formatValue(metric.change, metric.format)}
                    </Badge>
                    <span className="ml-2 text-xs text-muted-foreground">vs previous</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notifications Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications Over Time</CardTitle>
            <CardDescription>Real-time notification delivery</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <AreaChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  interval="preserveStartEnd"
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [value, "Notifications"]}
                />
                <Area
                  type="monotone"
                  dataKey="notifications"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Click-Through Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Click-Through Rate</CardTitle>
            <CardDescription>CTR performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  interval="preserveStartEnd"
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "CTR"]}
                />
                <Line
                  type="monotone"
                  dataKey="ctr"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.accent, strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Metrics</CardTitle>
            <CardDescription>Clicks vs Impressions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <BarChart data={analyticsData.slice(-10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                <Bar
                  dataKey="impressions"
                  fill={CHART_COLORS.secondary}
                  name="Impressions"
                />
                <Bar
                  dataKey="clicks"
                  fill={CHART_COLORS.accent}
                  name="Clicks"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Distribution</CardTitle>
            <CardDescription>Current session breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "Impressions",
                      value: analyticsData[analyticsData.length - 1]?.impressions || 0,
                    },
                    { name: "Clicks", value: analyticsData[analyticsData.length - 1]?.clicks || 0 },
                    {
                      name: "Conversions",
                      value: analyticsData[analyticsData.length - 1]?.conversions || 0,
                    },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {PIE_COLORS.map((color, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={color}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Last Update */}
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        <Clock className="mr-2 h-4 w-4" />
        Last updated: {lastUpdate.toLocaleString()}
      </div>
    </div>
  );
}
