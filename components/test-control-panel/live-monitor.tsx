"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, Clock, TrendingUp, Pause, Play, RotateCcw } from "lucide-react";

interface NotificationEvent {
  id: string;
  timestamp: number;
  type: "purchase" | "activity" | "error";
  customer_name: string;
  product_name?: string;
  location?: string;
  amount?: string;
  currency?: string;
  site_id: string;
  message: string;
}

interface LiveMonitorProps {
  testSite?: {
    id: string;
    name: string;
    shop_domain: string;
  };
}

export default function LiveMonitor({ testSite }: LiveMonitorProps) {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [stats, setStats] = useState({
    total_events: 0,
    last_hour: 0,
    unique_customers: 0,
    avg_order_value: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const maxEvents = 50; // Keep last 50 events

  // Connect to SSE stream
  useEffect(() => {
    if (!testSite || !isMonitoring) {
      return;
    }

    console.log(`Connecting to SSE stream for site: ${testSite.id}`);

    const eventSource = new EventSource(`/api/notifications/stream?siteId=${testSite.id}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("SSE connection opened");
      setConnectionStatus("connected");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received SSE event:", data);

        // Convert SSE notification to our event format
        const notificationEvent: NotificationEvent = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type: "purchase",
          customer_name: data.customer_name || "Unknown Customer",
          product_name: data.product_name,
          location: data.location,
          amount: data.amount,
          currency: data.currency,
          site_id: testSite.id,
          message: data.message || `${data.customer_name} purchased ${data.product_name}`,
        };

        setEvents((prev) => [notificationEvent, ...prev.slice(0, maxEvents - 1)]);

        // Update stats
        setStats((prev) => ({
          total_events: prev.total_events + 1,
          last_hour: prev.last_hour + 1,
          unique_customers: prev.unique_customers + 1, // Simplified - in real app would track unique names
          avg_order_value:
            data.amount ?
              (prev.avg_order_value + parseFloat(data.amount)) / 2
            : prev.avg_order_value,
        }));
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setConnectionStatus("disconnected");
    };

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [testSite, isMonitoring]);

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
    if (isMonitoring && eventSourceRef.current) {
      eventSourceRef.current.close();
      setConnectionStatus("disconnected");
    }
  };

  const clearEvents = () => {
    setEvents([]);
    setStats({
      total_events: 0,
      last_hour: 0,
      unique_customers: 0,
      avg_order_value: 0,
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return "🛒";
      case "activity":
        return "👁️";
      case "error":
        return "❌";
      default:
        return "📝";
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "purchase":
        return "bg-green-100 text-green-800 border-green-200";
      case "activity":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (!testSite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Notification Monitor</CardTitle>
          <CardDescription>
            Test site must be configured before you can monitor events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-gray-500">
            Please initialize your test site in the Settings tab first.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Live Notification Monitor</span>
              </CardTitle>
              <CardDescription>
                Real-time stream of notifications for {testSite.name}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>
                {connectionStatus === "connected" ?
                  "🟢 Connected"
                : connectionStatus === "connecting" ?
                  "🟡 Connecting"
                : "🔴 Disconnected"}
              </Badge>
              <Button
                variant="primary"
                size="sm"
                onClick={toggleMonitoring}
              >
                {isMonitoring ?
                  <>
                    <Pause className="mr-1 h-3 w-3" />
                    Pause
                  </>
                : <>
                    <Play className="mr-1 h-3 w-3" />
                    Resume
                  </>
                }
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={clearEvents}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-green-600">{stats.total_events}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Last Hour</p>
                <p className="text-2xl font-bold text-blue-600">{stats.last_hour}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Customers</p>
                <p className="text-2xl font-bold text-purple-600">{stats.unique_customers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Order</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${stats.avg_order_value.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Stream */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Stream</CardTitle>
          <CardDescription>
            Live stream of notification events ({events.length} events)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ?
            <div className="py-8 text-center text-gray-500">
              {isMonitoring ?
                <>
                  <Activity className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p>Waiting for events...</p>
                  <p className="mt-1 text-sm">
                    Send some test events from the Event Simulator to see them here.
                  </p>
                </>
              : <>
                  <Pause className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p>Monitoring paused</p>
                  <p className="mt-1 text-sm">Click Resume to start monitoring events.</p>
                </>
              }
            </div>
          : <div className="max-h-96 space-y-2 overflow-y-auto">
              {events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start space-x-3 rounded-lg border p-3">
                    <div className="text-lg">{getEventTypeIcon(event.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {event.message}
                        </p>
                        <Badge className={`text-xs ${getEventTypeColor(event.type)}`}>
                          {event.type}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center space-x-4">
                        <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
                        {event.location && (
                          <span className="text-xs text-gray-500">📍 {event.location}</span>
                        )}
                        {event.amount && (
                          <span className="text-xs font-medium text-green-600">
                            {event.currency}
                            {event.amount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {index < events.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
