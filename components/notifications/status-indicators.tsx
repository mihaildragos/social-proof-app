"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Pause,
  BarChart3,
  MousePointer,
  TrendingUp,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSSE } from "@/hooks/useSSE";

export interface NotificationCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft" | "error";
  type: "purchase" | "signup" | "review" | "visitor_count" | "custom";
  startDate: Date;
  endDate?: Date;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    activeUsers: number;
  };
  targeting: {
    totalAudience: number;
    activeSegments: number;
  };
  abTest?: {
    isActive: boolean;
    variants: number;
    winningVariant?: string;
    confidence?: number;
  };
  health: {
    score: number;
    issues: string[];
    warnings: string[];
  };
  lastActivity: Date;
}

export interface StatusIndicatorsProps {
  siteId: string;
  websocketUrl?: string;
  sseUrl?: string;
  refreshInterval?: number;
}

const STATUS_COLORS = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
};

const STATUS_ICONS = {
  active: CheckCircle,
  paused: Pause,
  completed: CheckCircle,
  draft: Clock,
  error: XCircle,
};

const TYPE_COLORS = {
  purchase: "bg-emerald-100 text-emerald-800",
  signup: "bg-blue-100 text-blue-800",
  review: "bg-amber-100 text-amber-800",
  visitor_count: "bg-purple-100 text-purple-800",
  custom: "bg-gray-100 text-gray-800",
};

export function StatusIndicators({
  siteId,
  websocketUrl = `/api/ws/campaigns/${siteId}`,
  sseUrl = `/api/sse/campaigns/${siteId}`,
  refreshInterval = 10000,
}: StatusIndicatorsProps) {
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // WebSocket connection for real-time campaign updates
  const { isConnected: wsConnected } = useWebSocket({
    url: websocketUrl,
    onMessage: (message) => {
      if (message.type === "campaign_update" && message.payload) {
        updateCampaign(message.payload);
      }
    },
  });

  // SSE connection as fallback
  const { isConnected: sseConnected } = useSSE({
    url: sseUrl,
    onMessage: (message) => {
      if (message.type === "campaign_update" && message.data) {
        updateCampaign(message.data);
      }
    },
  });

  const updateCampaign = (updatedCampaign: NotificationCampaign) => {
    setCampaigns((prev) =>
      prev.map((campaign) => (campaign.id === updatedCampaign.id ? updatedCampaign : campaign))
    );
    setLastUpdate(new Date());
  };

  // Generate mock campaigns for demonstration
  useEffect(() => {
    if (!wsConnected && !sseConnected) {
      const mockCampaigns: NotificationCampaign[] = [
        {
          id: "campaign-1",
          name: "Black Friday Sale",
          status: "active",
          type: "purchase",
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 86400000),
          metrics: {
            impressions: 15420,
            clicks: 1234,
            conversions: 89,
            ctr: 8.01,
            conversionRate: 7.21,
            activeUsers: 2341,
          },
          targeting: {
            totalAudience: 50000,
            activeSegments: 3,
          },
          abTest: {
            isActive: true,
            variants: 2,
            winningVariant: "Variant A",
            confidence: 95.2,
          },
          health: {
            score: 92,
            issues: [],
            warnings: ["Low conversion rate on mobile"],
          },
          lastActivity: new Date(),
        },
        {
          id: "campaign-2",
          name: "Newsletter Signup",
          status: "active",
          type: "signup",
          startDate: new Date(Date.now() - 172800000),
          metrics: {
            impressions: 8765,
            clicks: 543,
            conversions: 234,
            ctr: 6.19,
            conversionRate: 43.09,
            activeUsers: 1876,
          },
          targeting: {
            totalAudience: 25000,
            activeSegments: 2,
          },
          health: {
            score: 88,
            issues: [],
            warnings: [],
          },
          lastActivity: new Date(Date.now() - 300000),
        },
        {
          id: "campaign-3",
          name: "Product Reviews",
          status: "paused",
          type: "review",
          startDate: new Date(Date.now() - 259200000),
          metrics: {
            impressions: 3421,
            clicks: 156,
            conversions: 23,
            ctr: 4.56,
            conversionRate: 14.74,
            activeUsers: 892,
          },
          targeting: {
            totalAudience: 15000,
            activeSegments: 1,
          },
          health: {
            score: 65,
            issues: ["Low engagement rate"],
            warnings: ["Audience fatigue detected"],
          },
          lastActivity: new Date(Date.now() - 3600000),
        },
        {
          id: "campaign-4",
          name: "Live Visitor Count",
          status: "error",
          type: "visitor_count",
          startDate: new Date(Date.now() - 86400000),
          metrics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            conversionRate: 0,
            activeUsers: 0,
          },
          targeting: {
            totalAudience: 10000,
            activeSegments: 1,
          },
          health: {
            score: 0,
            issues: ["WebSocket connection failed", "Template rendering error"],
            warnings: [],
          },
          lastActivity: new Date(Date.now() - 7200000),
        },
      ];

      setCampaigns(mockCampaigns);

      // Simulate real-time updates
      const interval = setInterval(() => {
        setCampaigns((prev) =>
          prev.map((campaign) => ({
            ...campaign,
            metrics: {
              ...campaign.metrics,
              impressions: campaign.metrics.impressions + Math.floor(Math.random() * 10),
              clicks: campaign.metrics.clicks + Math.floor(Math.random() * 3),
              conversions: campaign.metrics.conversions + Math.floor(Math.random() * 1),
              activeUsers: Math.max(
                0,
                campaign.metrics.activeUsers + Math.floor(Math.random() * 20) - 10
              ),
            },
            lastActivity: new Date(),
          }))
        );
        setLastUpdate(new Date());
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [wsConnected, sseConnected, refreshInterval]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return "Just now";
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return `${Math.floor(diff / 86400000)}d ago`;
    }
  };

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
  const averageCTR = campaigns.length > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const connectionStatus =
    wsConnected ? "WebSocket"
    : sseConnected ? "SSE"
    : "Offline";
  const isConnected = wsConnected || sseConnected;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Impressions</p>
                <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
                <p className="text-2xl font-bold">{formatNumber(totalClicks)}</p>
              </div>
              <MousePointer className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average CTR</p>
                <p className="text-2xl font-bold">{averageCTR.toFixed(2)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Status List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaign Status</CardTitle>
              <CardDescription>
                Real-time status and performance of your notification campaigns
              </CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div
                  className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                />
                <span className="text-xs text-muted-foreground">{connectionStatus}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {campaigns.map((campaign, index) => {
            const StatusIcon = STATUS_ICONS[campaign.status];

            return (
              <div key={campaign.id}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <StatusIcon
                      className={`h-6 w-6 ${
                        campaign.status === "active" ? "text-green-600"
                        : campaign.status === "error" ? "text-red-600"
                        : campaign.status === "paused" ? "text-yellow-600"
                        : "text-gray-600"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <Badge
                          className={STATUS_COLORS[campaign.status]}
                          variant="secondary"
                        >
                          {campaign.status}
                        </Badge>
                        <Badge
                          className={TYPE_COLORS[campaign.type]}
                          variant="outline"
                        >
                          {campaign.type}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center space-x-1">
                                <Zap
                                  className={`h-4 w-4 ${getHealthColor(campaign.health.score)}`}
                                />
                                <span
                                  className={`text-sm font-medium ${getHealthColor(campaign.health.score)}`}
                                >
                                  {campaign.health.score}%
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Health Score: {getHealthLabel(campaign.health.score)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <span className="text-xs text-muted-foreground">
                          {getRelativeTime(campaign.lastActivity)}
                        </span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-5">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Impressions</p>
                        <p className="font-semibold">
                          {formatNumber(campaign.metrics.impressions)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Clicks</p>
                        <p className="font-semibold">{formatNumber(campaign.metrics.clicks)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">CTR</p>
                        <p className="font-semibold">{campaign.metrics.ctr.toFixed(2)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Conversions</p>
                        <p className="font-semibold">{campaign.metrics.conversions}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Active Users</p>
                        <p className="font-semibold">
                          {formatNumber(campaign.metrics.activeUsers)}
                        </p>
                      </div>
                    </div>

                    {/* Health Progress */}
                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Health Score</span>
                        <span
                          className={`text-xs font-medium ${getHealthColor(campaign.health.score)}`}
                        >
                          {getHealthLabel(campaign.health.score)}
                        </span>
                      </div>
                      <Progress
                        value={campaign.health.score}
                        className="h-2"
                      />
                    </div>

                    {/* A/B Test Info */}
                    {campaign.abTest?.isActive && (
                      <div className="mb-2 flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>A/B Test: {campaign.abTest.variants} variants</span>
                        {campaign.abTest.winningVariant && (
                          <span>
                            Winner: {campaign.abTest.winningVariant} ({campaign.abTest.confidence}%
                            confidence)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Issues and Warnings */}
                    {(campaign.health.issues.length > 0 || campaign.health.warnings.length > 0) && (
                      <div className="space-y-1">
                        {campaign.health.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="flex items-center space-x-2 text-xs text-red-600"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>{issue}</span>
                          </div>
                        ))}
                        {campaign.health.warnings.map((warning, idx) => (
                          <div
                            key={idx}
                            className="flex items-center space-x-2 text-xs text-yellow-600"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {index < campaigns.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}

          {campaigns.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No campaigns found</p>
              <p className="text-sm">Create your first notification campaign to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Update */}
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        <Clock className="mr-2 h-4 w-4" />
        Last updated: {lastUpdate.toLocaleString()}
      </div>
    </div>
  );
}
