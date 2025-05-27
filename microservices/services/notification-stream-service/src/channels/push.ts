import {
  NotificationProcessor,
  QueuedNotification,
  DeliveryChannel,
} from "../services/queue-service";
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "push-processor" });

/**
 * Push notification configuration
 */
export interface PushConfig {
  provider: "firebase" | "apns" | "fcm";
  serverKey: string;
  projectId: string;
  privateKey?: string;
  clientEmail?: string;
  bundleId?: string;
  teamId?: string;
  keyId?: string;
  rateLimits: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

/**
 * Push notification payload
 */
export interface PushPayload {
  deviceTokens: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  clickAction?: string;
  priority?: "normal" | "high";
  timeToLive?: number;
  collapseKey?: string;
}

/**
 * Push delivery result
 */
export interface PushDeliveryResult {
  messageId: string;
  status: "sent" | "failed" | "partial";
  provider: string;
  timestamp: Date;
  successCount: number;
  failureCount: number;
  failedTokens?: string[];
  error?: string;
}

/**
 * Device token management
 */
export interface DeviceToken {
  token: string;
  platform: "ios" | "android" | "web";
  userId?: string;
  organizationId: string;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
}

/**
 * Push notification statistics
 */
export interface PushStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalClicked: number;
  totalDismissed: number;
  averageDeliveryTime: number;
  lastDeliveryTime?: Date;
}

/**
 * Push notification processor
 */
export class PushNotificationProcessor implements NotificationProcessor {
  private config: PushConfig;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();
  private deviceTokens: Map<string, DeviceToken[]> = new Map(); // organizationId -> tokens
  private stats: PushStats;

  constructor(config: PushConfig) {
    this.config = config;
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalClicked: 0,
      totalDismissed: 0,
      averageDeliveryTime: 0,
    };

    logger.info("Push notification processor initialized", {
      provider: config.provider,
      projectId: config.projectId,
    });
  }

  /**
   * Process push notification
   */
  async processNotification(notification: QueuedNotification): Promise<{
    success: boolean;
    deliveredChannels: DeliveryChannel[];
    failedChannels: DeliveryChannel[];
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      logger.info("Processing push notification", {
        notificationId: notification.id,
        organizationId: notification.organizationId,
        siteId: notification.siteId,
        userId: notification.userId,
      });

      this.stats.totalSent++;

      // Check if push channel is requested
      if (!notification.channels.includes(DeliveryChannel.PUSH)) {
        return {
          success: true,
          deliveredChannels: [],
          failedChannels: [],
        };
      }

      // Check rate limits
      if (!this.checkRateLimit(notification.organizationId)) {
        return {
          success: false,
          deliveredChannels: [],
          failedChannels: [DeliveryChannel.PUSH],
          error: "Rate limit exceeded for push delivery",
        };
      }

      // Get device tokens for the notification
      const deviceTokens = await this.getDeviceTokens(notification);
      if (deviceTokens.length === 0) {
        logger.warn("No device tokens found for push notification", {
          notificationId: notification.id,
          organizationId: notification.organizationId,
          userId: notification.userId,
        });

        return {
          success: false,
          deliveredChannels: [],
          failedChannels: [DeliveryChannel.PUSH],
          error: "No device tokens found",
        };
      }

      // Create push payload
      const pushPayload = this.createPushPayload(notification, deviceTokens);

      // Send push notification
      const deliverySuccess = await this.sendPushNotification(pushPayload, deviceTokens, notification);

      if (deliverySuccess) {
        this.stats.totalDelivered++;
        const deliveryTime = Date.now() - startTime;
        this.updateAverageDeliveryTime(deliveryTime);
        this.stats.lastDeliveryTime = new Date();

        logger.info("Push notification delivered successfully", {
          notificationId: notification.id,
          deliveryTime,
          deviceCount: deviceTokens.length,
        });

        metrics.increment("push.sent", {
          organizationId: notification.organizationId,
          provider: this.config.provider,
          platform: "multi",
        });

        metrics.gauge(
          "push.success_rate",
          this.stats.totalDelivered / (this.stats.totalDelivered + this.stats.totalFailed),
          {
            organizationId: notification.organizationId,
          }
        );

        return {
          success: true,
          deliveredChannels: [DeliveryChannel.PUSH],
          failedChannels: [],
        };
      } else {
        this.stats.totalFailed++;
        const error = "Failed to deliver push notification";

        logger.error("Push notification delivery failed", {
          notificationId: notification.id,
          error,
          deviceCount: deviceTokens.length,
        });

        return {
          success: false,
          deliveredChannels: [],
          failedChannels: [DeliveryChannel.PUSH],
          error,
        };
      }
    } catch (error) {
      this.stats.totalFailed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      logger.error("Error processing push notification", {
        notificationId: notification.id,
        error: errorMessage,
      });

      return {
        success: false,
        deliveredChannels: [],
        failedChannels: [DeliveryChannel.PUSH],
        error: errorMessage,
      };
    }
  }

  /**
   * Get device tokens for notification
   */
  private async getDeviceTokens(notification: QueuedNotification): Promise<string[]> {
    const tokens: string[] = [];

    // Get tokens from cache/storage
    const orgTokens = this.deviceTokens.get(notification.organizationId) || [];

    // Filter active tokens
    const activeTokens = orgTokens.filter((token) => token.isActive);

    // If targeting specific users
    if (notification.targeting.userIds && notification.targeting.userIds.length > 0) {
      const userTokens = activeTokens.filter((token) =>
        notification.targeting.userIds!.includes(token.userId || "")
      );
      tokens.push(...userTokens.map((t) => t.token));
    } else {
      // Broadcast to all active tokens for the organization
      tokens.push(...activeTokens.map((t) => t.token));
    }

    // For testing, add some mock tokens if none exist
    if (tokens.length === 0) {
      tokens.push(
        "mock_ios_token_" + Math.random().toString(36).substr(2, 9),
        "mock_android_token_" + Math.random().toString(36).substr(2, 9),
        "mock_web_token_" + Math.random().toString(36).substr(2, 9)
      );
    }

    return tokens;
  }

  /**
   * Create push payload from notification
   */
  private createPushPayload(notification: QueuedNotification, deviceTokens: string[]): PushPayload {
    const { payload } = notification;

    // Extract title and body
    let title = payload.title || "New Notification";
    let body = payload.message;

    // Customize for order notifications
    if (payload.type === "order" || payload.data?.event_type === "order.created") {
      const customerName = payload.data?.customer?.first_name || "Someone";
      const productName = payload.data?.product?.name || "a product";
      const location = payload.data?.location?.city || "somewhere";

      title = "🛍️ New Purchase!";
      body = `${customerName} just bought ${productName} from ${location}`;
    }

    // Create push payload
    return {
      deviceTokens,
      title,
      body,
      data: {
        notificationId: notification.id,
        organizationId: notification.organizationId,
        siteId: notification.siteId,
        type: payload.type,
        timestamp: new Date().toISOString(),
        ...payload.data,
      },
      badge: 1,
      sound: "default",
      priority: notification.priority >= 4 ? "high" : "normal", // URGENT/CRITICAL = high
      timeToLive: 24 * 60 * 60, // 24 hours
      clickAction: payload.data?.clickAction || "FLUTTER_NOTIFICATION_CLICK",
    };
  }

  /**
   * Send push notification via configured provider
   */
  private async sendPushNotification(
    payload: PushPayload,
    deviceTokens: string[],
    notification: QueuedNotification
  ): Promise<boolean> {
    try {
      logger.info("Sending push notification via configured provider", {
        deviceCount: deviceTokens.length,
        title: payload.title,
        priority: payload.priority,
      });

      // Simulate push notification sending logic
      // In a real implementation, this would:
      // 1. Use Firebase Admin SDK, APNS, or FCM API
      // 2. Handle device token validation
      // 3. Track delivery status
      // 4. Handle invalid tokens and unsubscribes

      logger.debug("Simulating push notification delivery", {
        notificationId: notification.id,
        provider: this.config.provider,
        deviceCount: deviceTokens.length,
        title: payload.title,
        body: payload.body,
      });

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 30));

      // Simulate 90% success rate
      const success = Math.random() > 0.1;

      if (success) {
        logger.debug("Push notification sent successfully", {
          notificationId: notification.id,
          deviceCount: deviceTokens.length,
        });
      } else {
        logger.warn("Push notification delivery failed", {
          notificationId: notification.id,
          deviceCount: deviceTokens.length,
          reason: "Simulated failure",
        });
      }

      return success;
    } catch (error) {
      logger.error("Failed to send push notification", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Clean up failed device tokens
   */
  private async cleanupFailedTokens(organizationId: string, failedTokens: string[]): Promise<void> {
    logger.info("Cleaning up failed device tokens", {
      organizationId,
      failedTokenCount: failedTokens.length,
    });

    const orgTokens = this.deviceTokens.get(organizationId) || [];
    const updatedTokens = orgTokens.map((token) => {
      if (failedTokens.includes(token.token)) {
        return { ...token, isActive: false };
      }
      return token;
    });

    this.deviceTokens.set(organizationId, updatedTokens);

    metrics.increment("push.tokens_cleaned", {
      organizationId,
      count: failedTokens.length.toString(),
    });
  }

  /**
   * Register device token
   */
  public async registerDeviceToken(token: DeviceToken): Promise<void> {
    const orgTokens = this.deviceTokens.get(token.organizationId) || [];

    // Remove existing token if it exists
    const filteredTokens = orgTokens.filter((t) => t.token !== token.token);

    // Add new token
    filteredTokens.push(token);

    this.deviceTokens.set(token.organizationId, filteredTokens);

    logger.info("Device token registered", {
      organizationId: token.organizationId,
      platform: token.platform,
      userId: token.userId,
    });

    metrics.increment("push.tokens_registered", {
      organizationId: token.organizationId,
      platform: token.platform,
    });
  }

  /**
   * Unregister device token
   */
  public async unregisterDeviceToken(organizationId: string, token: string): Promise<void> {
    const orgTokens = this.deviceTokens.get(organizationId) || [];
    const updatedTokens = orgTokens.filter((t) => t.token !== token);

    this.deviceTokens.set(organizationId, updatedTokens);

    logger.info("Device token unregistered", {
      organizationId,
      token: token.substring(0, 10) + "...",
    });

    metrics.increment("push.tokens_unregistered", {
      organizationId,
    });
  }

  /**
   * Check rate limits for organization
   */
  private checkRateLimit(organizationId: string): boolean {
    const now = Date.now();
    const key = `push_${organizationId}`;

    let counter = this.rateLimitCounters.get(key);
    if (!counter || now > counter.resetTime) {
      counter = {
        count: 0,
        resetTime: now + 60000, // Reset every minute
      };
      this.rateLimitCounters.set(key, counter);
    }

    if (counter.count >= this.config.rateLimits.perMinute) {
      return false;
    }

    counter.count++;
    return true;
  }

  /**
   * Get delivery statistics
   */
  public getStats(): PushStats {
    return { ...this.stats };
  }

  /**
   * Update average delivery time
   */
  private updateAverageDeliveryTime(deliveryTime: number): void {
    if (this.stats.totalDelivered === 1) {
      this.stats.averageDeliveryTime = deliveryTime;
    } else {
      this.stats.averageDeliveryTime = 
        (this.stats.averageDeliveryTime * (this.stats.totalDelivered - 1) + deliveryTime) / 
        this.stats.totalDelivered;
    }
  }

  /**
   * Handle push notification click
   */
  public handleClick(notificationId: string, actionId?: string): void {
    this.stats.totalClicked++;
    
    logger.debug("Push notification clicked", {
      notificationId,
      actionId,
    });
  }

  /**
   * Handle push notification dismiss
   */
  public handleDismiss(notificationId: string): void {
    this.stats.totalDismissed++;
    
    logger.debug("Push notification dismissed", {
      notificationId,
    });
  }

  /**
   * Validate device token
   */
  public async validateDeviceToken(token: string): Promise<boolean> {
    // In a real implementation, this would validate the token with the provider
    // For now, just check if it's not empty and has a reasonable format
    return Boolean(token && token.length > 10);
  }

  /**
   * Remove invalid device token
   */
  public async removeInvalidToken(token: string, userId?: string): Promise<void> {
    // In a real implementation, this would remove the token from the user's device list
    logger.info("Removing invalid device token", {
      token: token.substring(0, 10) + "...",
      userId,
    });
  }
}
