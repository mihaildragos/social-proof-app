import {
  NotificationProcessor,
  QueuedNotification,
  DeliveryChannel,
} from "../services/queue-service";
import { getContextLogger } from "@social-proof/shared/utils/logger";

const logger = getContextLogger({ service: "email-processor" });
import { metrics } from "../utils/metrics";

/**
 * Email delivery configuration
 */
export interface EmailConfig {
  provider: "sendgrid" | "ses" | "mailgun";
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  templates: {
    default: string;
    order: string;
    welcome: string;
    notification: string;
  };
  rateLimits: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
}

/**
 * Email template data
 */
export interface EmailTemplateData {
  subject: string;
  recipientEmail: string;
  recipientName?: string;
  templateId?: string;
  templateData: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
}

/**
 * Email delivery result
 */
export interface EmailDeliveryResult {
  messageId: string;
  status: "sent" | "queued" | "failed";
  provider: string;
  timestamp: Date;
  error?: string;
}

/**
 * Email notification statistics
 */
export interface EmailStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  totalOpened: number;
  totalClicked: number;
  averageDeliveryTime: number;
  lastDeliveryTime?: Date;
}

/**
 * Email notification processor
 */
export class EmailNotificationProcessor implements NotificationProcessor {
  private config: EmailConfig;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();
  private stats: EmailStats;

  constructor(config: EmailConfig) {
    this.config = config;
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalBounced: 0,
      totalOpened: 0,
      totalClicked: 0,
      averageDeliveryTime: 0,
    };

    logger.info("Email notification processor initialized", {
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    });
  }

  /**
   * Process email notification
   */
  async processNotification(notification: QueuedNotification): Promise<{
    success: boolean;
    deliveredChannels: DeliveryChannel[];
    failedChannels: DeliveryChannel[];
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      logger.info("Processing email notification", {
        notificationId: notification.id,
        organizationId: notification.organizationId,
        siteId: notification.siteId,
        userId: notification.userId,
      });

      this.stats.totalSent++;

      // Check if email channel is requested
      if (!notification.channels.includes(DeliveryChannel.EMAIL)) {
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
          failedChannels: [DeliveryChannel.EMAIL],
          error: "Rate limit exceeded for email delivery",
        };
      }

      // Extract email data from notification
      const emailData = this.extractEmailData(notification);
      if (!emailData) {
        return {
          success: false,
          deliveredChannels: [],
          failedChannels: [DeliveryChannel.EMAIL],
          error: "Invalid email data in notification",
        };
      }

      // Create email payload
      const emailPayload = {
        to: emailData.recipientEmail,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        replyTo: this.config.replyTo,
        subject: emailData.subject,
        content: emailData.templateData.message,
        templateId: emailData.templateId,
        templateData: emailData.templateData,
        metadata: {
          notificationId: notification.id,
          organizationId: notification.organizationId,
          siteId: notification.siteId,
          userId: notification.userId,
        },
      };

      // Send email
      const deliverySuccess = await this.sendEmail(emailPayload, notification);

      if (deliverySuccess) {
        this.stats.totalDelivered++;
        const deliveryTime = Date.now() - startTime;
        this.updateAverageDeliveryTime(deliveryTime);
        this.stats.lastDeliveryTime = new Date();

        logger.info("Email notification delivered successfully", {
          notificationId: notification.id,
          deliveryTime,
          recipient: emailData.recipientEmail,
        });

        metrics.increment("email.sent", {
          organizationId: notification.organizationId,
          provider: this.config.provider,
          template: emailData.templateId || "default",
        });

        return {
          success: true,
          deliveredChannels: [DeliveryChannel.EMAIL],
          failedChannels: [],
        };
      } else {
        this.stats.totalFailed++;
        const error = "Failed to deliver email notification";

        logger.error("Email notification delivery failed", {
          notificationId: notification.id,
          error,
          recipient: emailData.recipientEmail,
        });

        metrics.increment("email.failed", {
          organizationId: notification.organizationId,
          provider: this.config.provider,
          error: "unknown",
        });

        return {
          success: false,
          deliveredChannels: [],
          failedChannels: [DeliveryChannel.EMAIL],
          error,
        };
      }
    } catch (error) {
      this.stats.totalFailed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      logger.error("Error processing email notification", {
        notificationId: notification.id,
        error: errorMessage,
      });

      metrics.increment("email.failed", {
        organizationId: notification.organizationId,
        provider: this.config.provider,
        error: errorMessage,
      });

      return {
        success: false,
        deliveredChannels: [],
        failedChannels: [DeliveryChannel.EMAIL],
        error: errorMessage,
      };
    }
  }

  /**
   * Extract email data from notification
   */
  private extractEmailData(notification: QueuedNotification): EmailTemplateData | null {
    try {
      const { payload, metadata } = notification;

      // Try to get recipient email from various sources
      let recipientEmail: string | undefined;
      let recipientName: string | undefined;

      // Check payload data for customer info
      if (payload.data?.customer?.email) {
        recipientEmail = payload.data.customer.email;
        recipientName =
          `${payload.data.customer.first_name || ""} ${payload.data.customer.last_name || ""}`.trim();
      }

      // Check targeting for specific user emails
      if (!recipientEmail && notification.targeting.userIds?.length) {
        // In a real implementation, you'd look up user emails from a user service
        recipientEmail = "user@example.com"; // Placeholder
      }

      // Default fallback for testing
      if (!recipientEmail) {
        recipientEmail = "test@example.com";
        recipientName = "Test User";
      }

      // Determine template based on notification type
      let templateId = this.config.templates.default;
      if (payload.type === "order" || payload.data?.event_type === "order.created") {
        templateId = this.config.templates.order;
      } else if (payload.type === "welcome") {
        templateId = this.config.templates.welcome;
      } else if (payload.type === "notification") {
        templateId = this.config.templates.notification;
      }

      // Generate subject
      const subject = this.generateSubject(notification);

      // Prepare template data
      const templateData = {
        recipientName: recipientName || "Valued Customer",
        message: payload.message,
        title: payload.title || "Notification",
        organizationId: notification.organizationId,
        siteId: notification.siteId,
        timestamp: new Date().toISOString(),
        ...payload.templateData,
        ...payload.data,
      };

      return {
        subject,
        recipientEmail,
        recipientName,
        templateId,
        templateData,
      };
    } catch (error) {
      logger.error("Failed to extract email data", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Generate email subject
   */
  private generateSubject(notification: QueuedNotification): string {
    const { payload } = notification;

    if (payload.title) {
      return payload.title;
    }

    if (payload.type === "order" || payload.data?.event_type === "order.created") {
      const customerName = payload.data?.customer?.first_name || "Someone";
      const productName = payload.data?.product?.name || "a product";
      return `${customerName} just purchased ${productName}!`;
    }

    if (payload.type === "welcome") {
      return "Welcome to our platform!";
    }

    return "New Notification";
  }

  /**
   * Send email via configured provider
   */
  private async sendEmail(payload: any, notification: QueuedNotification): Promise<boolean> {
    try {
      // Simulate email sending logic
      // In a real implementation, this would:
      // 1. Use SendGrid, SES, or Mailgun API
      // 2. Handle template rendering
      // 3. Track delivery status
      // 4. Handle bounces and complaints

      logger.debug("Simulating email delivery", {
        notificationId: notification.id,
        provider: this.config.provider,
        recipient: payload.to,
        subject: payload.subject,
      });

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (success) {
        logger.debug("Email sent successfully", {
          notificationId: notification.id,
          recipient: payload.to,
        });
      } else {
        logger.warn("Email delivery failed", {
          notificationId: notification.id,
          recipient: payload.to,
          reason: "Simulated failure",
        });
      }

      return success;
    } catch (error) {
      logger.error("Failed to send email", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Check rate limits for organization
   */
  private checkRateLimit(organizationId: string): boolean {
    const now = Date.now();
    const key = `email_${organizationId}`;

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
   * Get processor statistics
   */
  public getStats(): EmailStats {
    return { ...this.stats };
  }

  /**
   * Handle email bounce
   */
  public handleBounce(notificationId: string, bounceType: "hard" | "soft"): void {
    this.stats.totalBounced++;
    
    logger.warn("Email bounced", {
      notificationId,
      bounceType,
    });
  }

  /**
   * Handle email open
   */
  public handleOpen(notificationId: string): void {
    this.stats.totalOpened++;
    
    logger.debug("Email opened", {
      notificationId,
    });
  }

  /**
   * Handle email click
   */
  public handleClick(notificationId: string, linkUrl: string): void {
    this.stats.totalClicked++;
    
    logger.debug("Email link clicked", {
      notificationId,
      linkUrl,
    });
  }
}
