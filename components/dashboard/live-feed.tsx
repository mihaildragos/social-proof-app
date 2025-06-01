"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Users,
  ShoppingCart,
  Star,
  TrendingUp,
  MapPin,
  Clock,
  Filter,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSSE } from "@/hooks/useSSE";

export interface LiveNotificationEvent {
  id: string;
  type: "notification_shown" | "notification_clicked" | "user_joined" | "conversion" | "page_view";
  timestamp: number;
  data: {
    notificationId?: string;
    notificationType?: "purchase" | "signup" | "review" | "visitor_count" | "custom";
    userId?: string;
    sessionId?: string;
    location?: {
      country: string;
      city: string;
      region: string;
    };
    device?: {
      type: "desktop" | "mobile" | "tablet";
      browser: string;
      os: string;
    };
    page?: {
      url: string;
      title: string;
    };
    metadata?: {
      product?: string;
      customer?: string;
      amount?: number;
      rating?: number;
      count?: number;
    };
  };
}

export interface LiveFeedProps {
  siteId: string;
  websocketUrl?: string;
  sseUrl?: string;
  maxEvents?: number;
  autoScroll?: boolean;
}

const EVENT_ICONS = {
  notification_shown: Activity,
  notification_clicked: ShoppingCart,
  user_joined: Users,
  conversion: Star,
  page_view: TrendingUp,
};

const EVENT_COLORS = {
  notification_shown: "bg-blue-100 text-blue-800",
  notification_clicked: "bg-green-100 text-green-800",
  user_joined: "bg-purple-100 text-purple-800",
  conversion: "bg-yellow-100 text-yellow-800",
  page_view: "bg-gray-100 text-gray-800",
};

const NOTIFICATION_TYPE_COLORS = {
  purchase: "bg-emerald-100 text-emerald-800",
  signup: "bg-blue-100 text-blue-800",
  review: "bg-amber-100 text-amber-800",
  visitor_count: "bg-purple-100 text-purple-800",
  custom: "bg-gray-100 text-gray-800",
};

export function LiveFeed({
  siteId,
  websocketUrl = `/api/ws/live-feed/${siteId}`,
  sseUrl = `/api/sse/live-feed/${siteId}`,
  maxEvents = 100,
  autoScroll = true,
}: LiveFeedProps) {
  const [events, setEvents] = useState<LiveNotificationEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<LiveNotificationEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);

  // WebSocket connection for real-time events
  const { isConnected: wsConnected } = useWebSocket({
    url: websocketUrl,
    onMessage: (message) => {
      if (message.type === "live_event" && message.payload && !isPaused) {
        addEvent(message.payload);
      }
    },
  });

  // SSE connection as fallback
  const { isConnected: sseConnected } = useSSE({
    url: sseUrl,
    onMessage: (message) => {
      if (message.type === "live_event" && message.data && !isPaused) {
        addEvent(message.data);
      }
    },
  });

  const addEvent = useCallback(
    (eventData: LiveNotificationEvent) => {
      setEvents((prev) => {
        const newEvents = [eventData, ...prev];

        // Limit the number of events
        if (newEvents.length > maxEvents) {
          return newEvents.slice(0, maxEvents);
        }

        return newEvents;
      });
    },
    [maxEvents]
  );

  // Filter events based on selected filter
  useEffect(() => {
    if (filter === "all") {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter((event) => event.type === filter));
    }
  }, [events, filter]);

  // Generate mock events for demonstration
  useEffect(() => {
    if (!wsConnected && !sseConnected && !isPaused) {
      const interval = setInterval(() => {
        const eventTypes: LiveNotificationEvent["type"][] = [
          "notification_shown",
          "notification_clicked",
          "user_joined",
          "conversion",
          "page_view",
        ];

        const notificationTypes: LiveNotificationEvent["data"]["notificationType"][] = [
          "purchase",
          "signup",
          "review",
          "visitor_count",
        ];

        const locations = [
          { country: "US", city: "New York", region: "NY" },
          { country: "UK", city: "London", region: "England" },
          { country: "CA", city: "Toronto", region: "ON" },
          { country: "AU", city: "Sydney", region: "NSW" },
          { country: "DE", city: "Berlin", region: "Berlin" },
        ];

        const devices = [
          { type: "desktop" as const, browser: "Chrome", os: "Windows" },
          { type: "mobile" as const, browser: "Safari", os: "iOS" },
          { type: "tablet" as const, browser: "Firefox", os: "Android" },
        ];

        const products = ["Premium Plan", "Basic Plan", "Pro Package", "Starter Kit"];
        const customers = ["John D.", "Sarah M.", "Mike R.", "Emma L.", "Alex K."];

        const randomEventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        const randomDevice = devices[Math.floor(Math.random() * devices.length)];

        const mockEvent: LiveNotificationEvent = {
          id: `event-${Date.now()}-${Math.random()}`,
          type: randomEventType,
          timestamp: Date.now(),
          data: {
            notificationId: `notif-${Math.random().toString(36).substr(2, 9)}`,
            notificationType:
              notificationTypes[Math.floor(Math.random() * notificationTypes.length)],
            userId: `user-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
            location: randomLocation,
            device: randomDevice,
            page: {
              url: "/products",
              title: "Products - Your Store",
            },
            metadata: {
              product: products[Math.floor(Math.random() * products.length)],
              customer: customers[Math.floor(Math.random() * customers.length)],
              amount: Math.floor(Math.random() * 500) + 50,
              rating: Math.floor(Math.random() * 5) + 1,
              count: Math.floor(Math.random() * 50) + 10,
            },
          },
        };

        addEvent(mockEvent);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [wsConnected, sseConnected, isPaused, addEvent]);

  const formatEventMessage = (event: LiveNotificationEvent) => {
    const { type, data } = event;
    const location = data.location ? `${data.location.city}, ${data.location.country}` : "Unknown";

    switch (type) {
      case "notification_shown":
        return `${data.notificationType} notification shown to user in ${location}`;
      case "notification_clicked":
        return `User clicked ${data.notificationType} notification in ${location}`;
      case "user_joined":
        return `New user joined from ${location}`;
      case "conversion":
        return `Conversion: ${data.metadata?.customer} purchased ${data.metadata?.product} for $${data.metadata?.amount}`;
      case "page_view":
        return `Page view: ${data.page?.title} from ${location}`;
      default:
        return "Unknown event";
    }
  };

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

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

  const connectionStatus =
    wsConnected ? "WebSocket"
    : sseConnected ? "SSE"
    : "Offline";
  const isConnected = wsConnected || sseConnected;

  return (
    <Card className="flex h-[600px] flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Live Activity Feed</span>
            </CardTitle>
            <CardDescription>Real-time events from your notification campaigns</CardDescription>
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
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ?
                <Play className="h-4 w-4" />
              : <Pause className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-4">
          <Select
            value={filter}
            onValueChange={setFilter}
          >
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="notification_shown">Notifications Shown</SelectItem>
              <SelectItem value="notification_clicked">Notifications Clicked</SelectItem>
              <SelectItem value="user_joined">Users Joined</SelectItem>
              <SelectItem value="conversion">Conversions</SelectItem>
              <SelectItem value="page_view">Page Views</SelectItem>
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            className="text-xs"
          >
            {filteredEvents.length} events
          </Badge>

          {isPaused && (
            <Badge
              variant="secondary"
              className="text-xs"
            >
              Paused
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-6">
          <div className="space-y-4 py-4">
            {filteredEvents.length === 0 ?
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No events to display</p>
                <p className="text-sm">
                  {isPaused ? "Feed is paused" : "Waiting for live events..."}
                </p>
              </div>
            : filteredEvents.map((event, index) => {
                const Icon = EVENT_ICONS[event.type];

                return (
                  <div key={event.id}>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          <Badge
                            className={EVENT_COLORS[event.type]}
                            variant="secondary"
                          >
                            {event.type.replace("_", " ")}
                          </Badge>

                          {event.data.notificationType && (
                            <Badge
                              className={NOTIFICATION_TYPE_COLORS[event.data.notificationType]}
                              variant="outline"
                            >
                              {event.data.notificationType}
                            </Badge>
                          )}

                          <span className="text-xs text-muted-foreground">
                            {getRelativeTime(event.timestamp)}
                          </span>
                        </div>

                        <p className="mb-2 text-sm text-foreground">{formatEventMessage(event)}</p>

                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          {event.data.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {event.data.location.city}, {event.data.location.country}
                              </span>
                            </div>
                          )}

                          {event.data.device && (
                            <div className="flex items-center space-x-1">
                              <span className="capitalize">{event.data.device.type}</span>
                              <span>•</span>
                              <span>{event.data.device.browser}</span>
                            </div>
                          )}

                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {index < filteredEvents.length - 1 && <Separator className="my-4" />}
                  </div>
                );
              })
            }
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
