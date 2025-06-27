"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Users, ShoppingCart, Star, TrendingUp } from "lucide-react";
import { useWebSocket, WebSocketMessage } from "@/hooks/useWebSocket";
import { useSSE, SSEMessage } from "@/hooks/useSSE";

export interface NotificationData {
  id: string;
  type: "purchase" | "signup" | "review" | "visitor_count" | "custom";
  title: string;
  message: string;
  timestamp: number;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  styling: {
    theme: "light" | "dark" | "custom";
    colors: {
      background: string;
      text: string;
      accent: string;
    };
    animation: "slide" | "fade" | "bounce" | "none";
    duration: number;
  };
  cta?: {
    text: string;
    url: string;
  };
  image?: string;
  metadata?: {
    location?: string;
    product?: string;
    customer?: string;
    count?: number;
    rating?: number;
  };
}

export interface NotificationWidgetProps {
  siteId: string;
  apiKey?: string;
  websocketUrl?: string;
  sseUrl?: string;
  maxNotifications?: number;
  showCloseButton?: boolean;
  enableSound?: boolean;
  onNotificationClick?: (notification: NotificationData) => void;
  onNotificationClose?: (notificationId: string) => void;
}

const NOTIFICATION_ICONS = {
  purchase: ShoppingCart,
  signup: Users,
  review: Star,
  visitor_count: TrendingUp,
  custom: ExternalLink,
};

export function NotificationWidget({
  siteId,
  apiKey,
  websocketUrl = `/api/ws/notifications/${siteId}`,
  sseUrl = `/api/sse/notifications/${siteId}`,
  maxNotifications = 3,
  showCloseButton = true,
  enableSound = false,
  onNotificationClick,
  onNotificationClose,
}: NotificationWidgetProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  // WebSocket connection for real-time notifications
  const { isConnected: wsConnected, sendMessage } = useWebSocket({
    url: websocketUrl,
    onMessage: handleWebSocketMessage,
    onError: (error) => console.error("WebSocket error:", error),
  });

  // SSE connection as fallback
  const { isConnected: sseConnected } = useSSE({
    url: sseUrl,
    onMessage: handleSSEMessage,
    onError: (error) => console.error("SSE error:", error),
  });

  function handleWebSocketMessage(message: WebSocketMessage) {
    if (message.type === "notification" && message.payload) {
      addNotification(message.payload);
    }
  }

  function handleSSEMessage(message: SSEMessage) {
    if (message.type === "notification" && message.data) {
      addNotification(message.data);
    }
  }

  const addNotification = useCallback(
    (notificationData: NotificationData) => {
      setNotifications((prev) => {
        const newNotifications = [notificationData, ...prev];

        // Limit the number of visible notifications
        if (newNotifications.length > maxNotifications) {
          return newNotifications.slice(0, maxNotifications);
        }

        return newNotifications;
      });

      // Play sound if enabled
      if (enableSound) {
        try {
          const audio = new Audio("/notification-sound.mp3");
          audio.volume = 0.3;
          audio.play().catch(() => {
            // Ignore audio play errors (user interaction required)
          });
        } catch (error) {
          console.warn("Could not play notification sound:", error);
        }
      }

      // Auto-remove notification after duration
      setTimeout(() => {
        removeNotification(notificationData.id);
      }, notificationData.styling.duration);
    },
    [maxNotifications, enableSound]
  );

  const removeNotification = useCallback(
    (notificationId: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      onNotificationClose?.(notificationId);
    },
    [onNotificationClose]
  );

  const handleNotificationClick = useCallback(
    (notification: NotificationData) => {
      if (notification.cta?.url) {
        window.open(notification.cta.url, "_blank", "noopener,noreferrer");
      }
      onNotificationClick?.(notification);
    },
    [onNotificationClick]
  );

  const interpolateMessage = (message: string, metadata?: NotificationData["metadata"]) => {
    if (!metadata) return message;

    return message
      .replace(/\{location\}/g, metadata.location || "Unknown")
      .replace(/\{product\}/g, metadata.product || "Product")
      .replace(/\{customer\}/g, metadata.customer || "Someone")
      .replace(/\{count\}/g, metadata.count?.toString() || "0")
      .replace(/\{rating\}/g, "⭐".repeat(metadata.rating || 5));
  };

  const getPositionClasses = (position: NotificationData["position"]) => {
    switch (position) {
      case "top-left":
        return "top-4 left-4";
      case "top-right":
        return "top-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "bottom-right":
        return "bottom-4 right-4";
      case "center":
        return "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      default:
        return "bottom-4 right-4";
    }
  };

  const getAnimationClasses = (animation: NotificationData["styling"]["animation"]) => {
    switch (animation) {
      case "slide":
        return "animate-in slide-in-from-right duration-300";
      case "fade":
        return "animate-in fade-in duration-500";
      case "bounce":
        return "animate-in bounce-in duration-600";
      default:
        return "animate-in fade-in duration-300";
    }
  };

  // Send heartbeat to maintain connection
  useEffect(() => {
    if (wsConnected) {
      const interval = setInterval(() => {
        sendMessage({
          type: "heartbeat",
          payload: { siteId, timestamp: Date.now() },
        });
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [wsConnected, sendMessage, siteId]);

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed z-50">
      {notifications.map((notification, index) => {
        const Icon = NOTIFICATION_ICONS[notification.type];
        const positionClasses = getPositionClasses(notification.position);
        const animationClasses = getAnimationClasses(notification.styling.animation);

        return (
          <div
            key={notification.id}
            className={`pointer-events-auto absolute ${positionClasses}`}
            style={{
              transform: `translateY(${index * -80}px)`,
              zIndex: 1000 - index,
            }}
          >
            <Card
              className={`max-w-sm cursor-pointer transition-all hover:scale-105 ${animationClasses}`}
              style={{
                backgroundColor: notification.styling.colors.background,
                color: notification.styling.colors.text,
                borderColor: notification.styling.colors.accent,
              }}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: notification.styling.colors.accent }}
                    />
                    <span className="text-sm font-semibold">{notification.title}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: notification.styling.colors.accent,
                        color: notification.styling.colors.accent,
                      }}
                    >
                      Live
                    </Badge>

                    {showCloseButton && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  {notification.image && (
                    <img
                      src={notification.image}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-sm opacity-90">
                      {interpolateMessage(notification.message, notification.metadata)}
                    </p>

                    {notification.cta && (
                      <Button
                        size="sm"
                        className="text-xs"
                        style={{
                          backgroundColor: notification.styling.colors.accent,
                          color: notification.styling.colors.background,
                        }}
                      >
                        {notification.cta.text}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                  <span>
                    {new Date(notification.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <div className="flex items-center space-x-1">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        wsConnected || sseConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs">
                      {wsConnected ?
                        "WebSocket"
                      : sseConnected ?
                        "SSE"
                      : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
