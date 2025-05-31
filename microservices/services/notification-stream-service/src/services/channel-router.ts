import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";
import { NotificationProcessor, QueuedNotification, DeliveryChannel } from "./queue-service";
import { EmailNotificationProcessor, EmailConfig } from "../channels/email";
import { PushNotificationProcessor, PushConfig } from "../channels/push";
import { WebNotificationProcessor, WebConfig } from "../channels/web";

const logger = getContextLogger({ service: "channel-router" });

/**
 * Channel routing configuration
 */
export interface ChannelRouterConfig {
  email: {
    enabled: boolean;
    config: EmailConfig;
  };
  push: {
    enabled: boolean;
    config: PushConfig;
  };
  web: {
    enabled: boolean;
    config: WebConfig;
  };
  fallbackStrategy: "none" | "email" | "web" | "all";
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

/**
 * Channel delivery result
 */
export interface ChannelDeliveryResult {
  notificationId: string;
  success: boolean;
  deliveredChannels: DeliveryChannel[];
  failedChannels: DeliveryChannel[];
  totalChannels: number;
  deliveryTime: number;
  errors: Record<string, string>;
  retryCount: number;
}

/**
 * Channel preference
 */
export interface ChannelPreference {
  userId?: string;
  organizationId: string;
  channels: {
    email: boolean;
    push: boolean;
    web: boolean;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  frequency: {
    email: "immediate" | "hourly" | "daily" | "weekly";
    push: "immediate" | "hourly" | "daily" | "disabled";
    web: "immediate" | "disabled";
  };
}

/**
 * Channel routing service
 */
export class ChannelRouterService {
  private config: ChannelRouterConfig;
  private processors: Map<DeliveryChannel, NotificationProcessor> = new Map();
  private channelPreferences: Map<string, ChannelPreference> = new Map(); // userId -> preferences

  constructor(config: ChannelRouterConfig) {
    this.config = config;
    this.initializeProcessors();

    logger.info("Channel router service initialized", {
      enabledChannels: this.getEnabledChannels(),
      fallbackStrategy: config.fallbackStrategy,
    });
  }

  /**
   * Initialize notification processors
   */
  private initializeProcessors(): void {
    if (this.config.email.enabled) {
      const emailProcessor = new EmailNotificationProcessor(this.config.email.config);
      this.processors.set(DeliveryChannel.EMAIL, emailProcessor);
      logger.info("Email processor initialized");
    }

    if (this.config.push.enabled) {
      const pushProcessor = new PushNotificationProcessor(this.config.push.config);
      this.processors.set(DeliveryChannel.PUSH, pushProcessor);
      logger.info("Push processor initialized");
    }

    if (this.config.web.enabled) {
      const webProcessor = new WebNotificationProcessor(this.config.web.config);
      this.processors.set(DeliveryChannel.WEB, webProcessor);
      logger.info("Web processor initialized");
    }
  }

  /**
   * Route notification to appropriate channels
   */
  async routeNotification(notification: QueuedNotification): Promise<ChannelDeliveryResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      // Apply channel preferences and filtering
      const filteredNotification = await this.applyChannelPreferences(notification);

      if (filteredNotification.channels.length === 0) {
        logger.warn("No channels available after applying preferences", {
          notificationId: notification.id,
          originalChannels: notification.channels,
        });

        return {
          notificationId: notification.id,
          success: true, // Not a failure, just no channels to deliver to
          deliveredChannels: [],
          failedChannels: [],
          totalChannels: 0,
          deliveryTime: Date.now() - startTime,
          errors: {},
          retryCount: 0,
        };
      }

      // Attempt delivery with retries
      let result = await this.attemptDelivery(filteredNotification);

      while (result.failedChannels.length > 0 && retryCount < this.config.retryConfig.maxRetries) {
        retryCount++;

        logger.info("Retrying failed channels", {
          notificationId: notification.id,
          retryCount,
          failedChannels: result.failedChannels,
        });

        // Wait before retry
        const delay =
          this.config.retryConfig.initialDelay *
          Math.pow(this.config.retryConfig.backoffMultiplier, retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Create notification with only failed channels
        const retryNotification = {
          ...filteredNotification,
          channels: result.failedChannels,
        };

        const retryResult = await this.attemptDelivery(retryNotification);

        // Merge results
        result.deliveredChannels.push(...retryResult.deliveredChannels);
        result.failedChannels = retryResult.failedChannels;
        result.errors = { ...result.errors, ...retryResult.errors };
      }

      // Apply fallback strategy if there are still failures
      if (result.failedChannels.length > 0) {
        const fallbackResult = await this.applyFallbackStrategy(filteredNotification, result);
        if (fallbackResult) {
          result.deliveredChannels.push(...fallbackResult.deliveredChannels);
          result.failedChannels = result.failedChannels.filter(
            (channel) => !fallbackResult.deliveredChannels.includes(channel)
          );
        }
      }

      const finalResult: ChannelDeliveryResult = {
        notificationId: notification.id,
        success: result.failedChannels.length === 0,
        deliveredChannels: result.deliveredChannels,
        failedChannels: result.failedChannels,
        totalChannels: filteredNotification.channels.length,
        deliveryTime: Date.now() - startTime,
        errors: result.errors,
        retryCount,
      };

      // Log final result
      logger.info("Notification routing completed", {
        notificationId: notification.id,
        success: finalResult.success,
        deliveredChannels: finalResult.deliveredChannels,
        failedChannels: finalResult.failedChannels,
        deliveryTime: finalResult.deliveryTime,
        retryCount: finalResult.retryCount,
      });

      // Track metrics
      metrics.increment("channel_router.notifications_processed", {
        organizationId: notification.organizationId,
        success: finalResult.success.toString(),
      });

      metrics.histogram("channel_router.delivery_time", finalResult.deliveryTime, {
        organizationId: notification.organizationId,
        channelCount: finalResult.totalChannels.toString(),
      });

      finalResult.deliveredChannels.forEach((channel) => {
        metrics.increment("channel_router.channel_delivered", {
          organizationId: notification.organizationId,
          channel: channel.toString(),
        });
      });

      finalResult.failedChannels.forEach((channel) => {
        metrics.increment("channel_router.channel_failed", {
          organizationId: notification.organizationId,
          channel: channel.toString(),
        });
      });

      return finalResult;
    } catch (error) {
      logger.error("Channel routing failed", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      metrics.increment("channel_router.routing_errors", {
        organizationId: notification.organizationId,
        error: error instanceof Error ? error.message : "unknown",
      });

      return {
        notificationId: notification.id,
        success: false,
        deliveredChannels: [],
        failedChannels: notification.channels,
        totalChannels: notification.channels.length,
        deliveryTime: Date.now() - startTime,
        errors: {
          routing: error instanceof Error ? error.message : "Unknown error",
        },
        retryCount,
      };
    }
  }

  /**
   * Apply channel preferences and filtering
   */
  private async applyChannelPreferences(
    notification: QueuedNotification
  ): Promise<QueuedNotification> {
    let filteredChannels = [...notification.channels];

    // Get user preferences if targeting specific users
    if (notification.targeting.userIds && notification.targeting.userIds.length > 0) {
      for (const userId of notification.targeting.userIds) {
        const preferences = this.channelPreferences.get(userId);
        if (preferences) {
          filteredChannels = this.filterChannelsByPreferences(filteredChannels, preferences);
        }
      }
    }

    // Check quiet hours
    filteredChannels = await this.filterChannelsByQuietHours(filteredChannels, notification);

    // Check frequency limits
    filteredChannels = await this.filterChannelsByFrequency(filteredChannels, notification);

    // Remove disabled channels
    filteredChannels = filteredChannels.filter((channel) => {
      switch (channel) {
        case DeliveryChannel.EMAIL:
          return this.config.email.enabled;
        case DeliveryChannel.PUSH:
          return this.config.push.enabled;
        case DeliveryChannel.WEB:
          return this.config.web.enabled;
        default:
          return false;
      }
    });

    return {
      ...notification,
      channels: filteredChannels,
    };
  }

  /**
   * Filter channels by user preferences
   */
  private filterChannelsByPreferences(
    channels: DeliveryChannel[],
    preferences: ChannelPreference
  ): DeliveryChannel[] {
    return channels.filter((channel) => {
      switch (channel) {
        case DeliveryChannel.EMAIL:
          return preferences.channels.email;
        case DeliveryChannel.PUSH:
          return preferences.channels.push;
        case DeliveryChannel.WEB:
          return preferences.channels.web;
        default:
          return false;
      }
    });
  }

  /**
   * Filter channels by quiet hours
   */
  private async filterChannelsByQuietHours(
    channels: DeliveryChannel[],
    notification: QueuedNotification
  ): Promise<DeliveryChannel[]> {
    // For now, just return all channels
    // In a real implementation, you'd check user timezone and quiet hours
    return channels;
  }

  /**
   * Filter channels by frequency limits
   */
  private async filterChannelsByFrequency(
    channels: DeliveryChannel[],
    notification: QueuedNotification
  ): Promise<DeliveryChannel[]> {
    // For now, just return all channels
    // In a real implementation, you'd check frequency limits and recent sends
    return channels;
  }

  /**
   * Attempt delivery to all channels
   */
  private async attemptDelivery(notification: QueuedNotification): Promise<{
    deliveredChannels: DeliveryChannel[];
    failedChannels: DeliveryChannel[];
    errors: Record<string, string>;
  }> {
    const deliveredChannels: DeliveryChannel[] = [];
    const failedChannels: DeliveryChannel[] = [];
    const errors: Record<string, string> = {};

    // Process channels in parallel
    const deliveryPromises = notification.channels.map(async (channel) => {
      const processor = this.processors.get(channel);
      if (!processor) {
        logger.error("No processor found for channel", {
          channel: channel.toString(),
          notificationId: notification.id,
        });
        return {
          channel,
          success: false,
          error: `No processor found for channel: ${channel}`,
        };
      }

      try {
        const result = await processor.processNotification(notification);
        return {
          channel,
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        return {
          channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.allSettled(deliveryPromises);

    results.forEach((result, index) => {
      const channel = notification.channels[index];

      if (result.status === "fulfilled") {
        if (result.value.success) {
          deliveredChannels.push(channel);
        } else {
          failedChannels.push(channel);
          if (result.value.error) {
            errors[channel.toString()] = result.value.error;
          }
        }
      } else {
        failedChannels.push(channel);
        errors[channel.toString()] =
          result.reason instanceof Error ? result.reason.message : "Promise rejected";
      }
    });

    return {
      deliveredChannels,
      failedChannels,
      errors,
    };
  }

  /**
   * Apply fallback strategy for failed channels
   */
  private async applyFallbackStrategy(
    notification: QueuedNotification,
    currentResult: { deliveredChannels: DeliveryChannel[]; failedChannels: DeliveryChannel[] }
  ): Promise<{ deliveredChannels: DeliveryChannel[] } | null> {
    if (this.config.fallbackStrategy === "none") {
      return null;
    }

    logger.info("Applying fallback strategy", {
      notificationId: notification.id,
      strategy: this.config.fallbackStrategy,
      failedChannels: currentResult.failedChannels,
    });

    const fallbackChannels: DeliveryChannel[] = [];

    switch (this.config.fallbackStrategy) {
      case "email":
        if (
          !currentResult.deliveredChannels.includes(DeliveryChannel.EMAIL) &&
          this.config.email.enabled
        ) {
          fallbackChannels.push(DeliveryChannel.EMAIL);
        }
        break;

      case "web":
        if (
          !currentResult.deliveredChannels.includes(DeliveryChannel.WEB) &&
          this.config.web.enabled
        ) {
          fallbackChannels.push(DeliveryChannel.WEB);
        }
        break;

      case "all":
        if (
          !currentResult.deliveredChannels.includes(DeliveryChannel.EMAIL) &&
          this.config.email.enabled
        ) {
          fallbackChannels.push(DeliveryChannel.EMAIL);
        }
        if (
          !currentResult.deliveredChannels.includes(DeliveryChannel.WEB) &&
          this.config.web.enabled
        ) {
          fallbackChannels.push(DeliveryChannel.WEB);
        }
        break;
    }

    if (fallbackChannels.length === 0) {
      return null;
    }

    const fallbackNotification = {
      ...notification,
      channels: fallbackChannels,
    };

    const fallbackResult = await this.attemptDelivery(fallbackNotification);

    metrics.increment("channel_router.fallback_applied", {
      organizationId: notification.id,
      strategy: this.config.fallbackStrategy,
      channelCount: fallbackChannels.length.toString(),
    });

    return {
      deliveredChannels: fallbackResult.deliveredChannels,
    };
  }

  /**
   * Set channel preferences for a user
   */
  public setChannelPreferences(userId: string, preferences: ChannelPreference): void {
    this.channelPreferences.set(userId, preferences);

    logger.info("Channel preferences updated", {
      userId,
      channels: preferences.channels,
      frequency: preferences.frequency,
    });

    metrics.increment("channel_router.preferences_updated", {
      organizationId: preferences.organizationId,
      userId,
    });
  }

  /**
   * Get channel preferences for a user
   */
  public getChannelPreferences(userId: string): ChannelPreference | null {
    return this.channelPreferences.get(userId) || null;
  }

  /**
   * Get enabled channels
   */
  private getEnabledChannels(): string[] {
    const enabled: string[] = [];
    if (this.config.email.enabled) enabled.push("email");
    if (this.config.push.enabled) enabled.push("push");
    if (this.config.web.enabled) enabled.push("web");
    return enabled;
  }

  /**
   * Get processor for channel
   */
  public getProcessor(channel: DeliveryChannel): NotificationProcessor | undefined {
    return this.processors.get(channel);
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    enabledChannels: string[];
    fallbackStrategy: string;
    totalPreferences: number;
    processorStats: Record<string, any>;
  } {
    const processorStats: Record<string, any> = {};

    // Get stats from each processor
    if (this.config.email.enabled) {
      const emailProcessor = this.processors.get(
        DeliveryChannel.EMAIL
      ) as EmailNotificationProcessor;
      if (emailProcessor) {
        processorStats.email = emailProcessor.getStats();
      }
    }

    if (this.config.push.enabled) {
      const pushProcessor = this.processors.get(DeliveryChannel.PUSH) as PushNotificationProcessor;
      if (pushProcessor) {
        processorStats.push = pushProcessor.getStats();
      }
    }

    if (this.config.web.enabled) {
      const webProcessor = this.processors.get(DeliveryChannel.WEB) as WebNotificationProcessor;
      if (webProcessor) {
        processorStats.web = webProcessor.getStats();
      }
    }

    return {
      enabledChannels: this.getEnabledChannels(),
      fallbackStrategy: this.config.fallbackStrategy,
      totalPreferences: this.channelPreferences.size,
      processorStats,
    };
  }
}
