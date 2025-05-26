import { Logger } from "../utils/logger";
import { NotificationService as DataService } from "./notificationService";
import { TemplateRenderer } from "../utils/templateRenderer";
import { RedisPublisher } from "../redis/publisher";
import {
  NotificationInput,
  Notification,
  NotificationTemplate,
  NotificationEventRecord,
} from "../types/events";

export interface NotificationBusinessLogicConfig {
  dataService: DataService;
  templateRenderer: TemplateRenderer;
  redisPublisher: RedisPublisher;
  logger: Logger;
}

export interface NotificationWorkflowInput {
  siteId: string;
  eventType: string;
  eventData: Record<string, any>;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationDeliveryResult {
  notificationId: string;
  delivered: boolean;
  channels: string[];
  errors: string[];
  deliveryTime: number;
}

export interface NotificationAnalytics {
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  conversionRate: number;
}

/**
 * Business logic service for notification processing and delivery
 * Orchestrates the complete notification workflow from event to delivery
 */
export class NotificationBusinessService {
  private dataService: DataService;
  private templateRenderer: TemplateRenderer;
  private redisPublisher: RedisPublisher;
  private logger: Logger;

  constructor(config: NotificationBusinessLogicConfig) {
    this.dataService = config.dataService;
    this.templateRenderer = config.templateRenderer;
    this.redisPublisher = config.redisPublisher;
    this.logger = config.logger;
  }

  /**
   * Process incoming event and create notifications
   * Main entry point for notification workflow
   */
  public async processEvent(input: NotificationWorkflowInput): Promise<NotificationDeliveryResult[]> {
    const startTime = Date.now();
    
    try {
      this.logger.info("Processing notification event", {
        siteId: input.siteId,
        eventType: input.eventType,
        userId: input.userId,
      });

      // 1. Find active templates for this event type and site
      const templates = await this.dataService.findTemplatesForEvent(input.siteId, input.eventType);
      
      if (templates.length === 0) {
        this.logger.info("No active templates found for event", {
          siteId: input.siteId,
          eventType: input.eventType,
        });
        return [];
      }

      // 2. Process each template and create notifications
      const deliveryResults: NotificationDeliveryResult[] = [];
      
      for (const template of templates) {
        try {
          const result = await this.processTemplate(template, input);
          if (result) {
            deliveryResults.push(result);
          }
        } catch (error) {
          this.logger.error("Error processing template", {
            templateId: template.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const totalTime = Date.now() - startTime;
      this.logger.info("Event processing completed", {
        siteId: input.siteId,
        eventType: input.eventType,
        templatesProcessed: templates.length,
        notificationsCreated: deliveryResults.length,
        processingTime: totalTime,
      });

      return deliveryResults;
    } catch (error) {
      this.logger.error("Error processing notification event", {
        siteId: input.siteId,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process a single template and create notification
   */
  private async processTemplate(
    template: NotificationTemplate,
    input: NotificationWorkflowInput
  ): Promise<NotificationDeliveryResult | null> {
    try {
      // 1. Create notification from template
      const notificationInput: NotificationInput = {
        siteId: input.siteId,
        templateId: template.id,
        eventType: input.eventType,
        eventData: input.eventData,
        channels: template.channels,
        status: 'pending',
      };

      const notification = await this.dataService.createNotification(notificationInput);

      // 2. Evaluate targeting rules
      const shouldDeliver = await this.evaluateDeliveryRules(notification, input);
      
      if (!shouldDeliver) {
        await this.dataService.updateNotificationStatus(notification.id, 'filtered');
        this.logger.debug("Notification filtered by targeting rules", {
          notificationId: notification.id,
          templateId: template.id,
        });
        return null;
      }

      // 3. Apply A/B testing logic
      const finalTemplate = await this.applyAbTesting(template, input);

      // 4. Render final notification content
      const renderedContent = await this.renderNotificationContent(finalTemplate, input.eventData);

      // 5. Deliver notification
      const deliveryResult = await this.deliverNotification(notification, renderedContent, input);

      // 6. Record analytics event
      await this.recordAnalyticsEvent(notification, input, deliveryResult);

      return deliveryResult;
    } catch (error) {
      this.logger.error("Error processing template", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Evaluate all delivery rules (targeting, frequency capping, etc.)
   */
  private async evaluateDeliveryRules(
    notification: Notification,
    input: NotificationWorkflowInput
  ): Promise<boolean> {
    try {
      // 1. Evaluate targeting rules
      const targetingMatch = await this.dataService.evaluateTargetingRules(
        notification.id,
        input.eventData
      );

      if (!targetingMatch) {
        return false;
      }

      // 2. Check frequency capping
      const frequencyAllowed = await this.checkFrequencyCapping(input.siteId, input.userId);
      
      if (!frequencyAllowed) {
        this.logger.debug("Notification blocked by frequency capping", {
          siteId: input.siteId,
          userId: input.userId,
        });
        return false;
      }

      // 3. Check user preferences (if user is logged in)
      if (input.userId) {
        const userPreferencesAllowed = await this.checkUserPreferences(input.userId, notification.eventType);
        
        if (!userPreferencesAllowed) {
          this.logger.debug("Notification blocked by user preferences", {
            userId: input.userId,
            eventType: notification.eventType,
          });
          return false;
        }
      }

      // 4. Check business hours (if configured)
      const businessHoursAllowed = await this.checkBusinessHours(input.siteId);
      
      if (!businessHoursAllowed) {
        this.logger.debug("Notification blocked by business hours", {
          siteId: input.siteId,
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Error evaluating delivery rules", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Default to allowing delivery if there's an error
      return true;
    }
  }

  /**
   * Apply A/B testing logic to select the appropriate template variant
   */
  private async applyAbTesting(
    template: NotificationTemplate,
    input: NotificationWorkflowInput
  ): Promise<NotificationTemplate> {
    try {
      // Check if there are any active A/B tests for this template
      const activeAbTests = await this.getActiveAbTestsForTemplate(template.id, input.siteId);
      
      if (activeAbTests.length === 0) {
        return template;
      }

      // For simplicity, take the first active A/B test
      const abTest = activeAbTests[0];
      
      // Determine which variant to show based on user/session
      const variant = this.determineAbTestVariant(abTest, input.userId || input.sessionId || '');
      
      if (variant === 'control') {
        return template;
      } else {
        // Get the variant template
        const variantTemplate = await this.dataService.getTemplateByIdForOrg(
          abTest.variant_template_id,
          input.siteId
        );
        
        if (variantTemplate) {
          this.logger.debug("Using A/B test variant", {
            abTestId: abTest.id,
            variant,
            templateId: variantTemplate.id,
          });
          return variantTemplate;
        }
      }

      return template;
    } catch (error) {
      this.logger.error("Error applying A/B testing", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Default to original template if there's an error
      return template;
    }
  }

  /**
   * Render notification content with template and event data
   */
  private async renderNotificationContent(
    template: NotificationTemplate,
    eventData: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      return await this.templateRenderer.render(template, eventData);
    } catch (error) {
      this.logger.error("Error rendering notification content", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Deliver notification through appropriate channels
   */
  private async deliverNotification(
    notification: Notification,
    content: Record<string, any>,
    input: NotificationWorkflowInput
  ): Promise<NotificationDeliveryResult> {
    const startTime = Date.now();
    const deliveryResult: NotificationDeliveryResult = {
      notificationId: notification.id,
      delivered: false,
      channels: [],
      errors: [],
      deliveryTime: 0,
    };

    try {
      // Publish to Redis for real-time delivery
      const deliveryPayload = {
        id: notification.id,
        siteId: input.siteId,
        templateId: notification.templateId,
        eventType: notification.eventType,
        content,
        channels: notification.channels,
        createdAt: notification.createdAt,
      };

      await this.redisPublisher.publishNotification(deliveryPayload);

      // Update notification status
      await this.dataService.updateNotificationStatus(notification.id, 'delivered');

      deliveryResult.delivered = true;
      deliveryResult.channels = notification.channels;
      deliveryResult.deliveryTime = Date.now() - startTime;

      this.logger.info("Notification delivered successfully", {
        notificationId: notification.id,
        channels: notification.channels,
        deliveryTime: deliveryResult.deliveryTime,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      deliveryResult.errors.push(errorMessage);
      
      await this.dataService.updateNotificationStatus(notification.id, 'failed');
      
      this.logger.error("Error delivering notification", {
        notificationId: notification.id,
        error: errorMessage,
      });
    }

    return deliveryResult;
  }

  /**
   * Record analytics event for notification
   */
  private async recordAnalyticsEvent(
    notification: Notification,
    input: NotificationWorkflowInput,
    deliveryResult: NotificationDeliveryResult
  ): Promise<void> {
    try {
      const analyticsEvent: NotificationEventRecord = {
        siteId: input.siteId,
        notificationId: notification.id,
        eventType: deliveryResult.delivered ? 'delivered' : 'failed',
        metadata: {
          templateId: notification.templateId,
          channels: deliveryResult.channels,
          deliveryTime: deliveryResult.deliveryTime,
          errors: deliveryResult.errors,
          userId: input.userId,
          sessionId: input.sessionId,
          originalEventType: input.eventType,
        },
      };

      await this.dataService.recordNotificationEvent(analyticsEvent);
    } catch (error) {
      this.logger.error("Error recording analytics event", {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Non-fatal error, don't rethrow
    }
  }

  /**
   * Check frequency capping rules
   */
  private async checkFrequencyCapping(siteId: string, userId?: string): Promise<boolean> {
    // TODO: Implement frequency capping logic
    // For now, allow all notifications
    return true;
  }

  /**
   * Check user notification preferences
   */
  private async checkUserPreferences(userId: string, eventType: string): Promise<boolean> {
    // TODO: Implement user preferences checking
    // For now, allow all notifications
    return true;
  }

  /**
   * Check business hours configuration
   */
  private async checkBusinessHours(siteId: string): Promise<boolean> {
    // TODO: Implement business hours checking
    // For now, allow all notifications
    return true;
  }

  /**
   * Get active A/B tests for a template
   */
  private async getActiveAbTestsForTemplate(templateId: string, siteId: string): Promise<any[]> {
    // TODO: Implement A/B test retrieval logic
    // For now, return empty array
    return [];
  }

  /**
   * Determine A/B test variant for user/session
   */
  private determineAbTestVariant(abTest: any, identifier: string): 'control' | 'variant' {
    // Simple hash-based assignment
    const hash = this.simpleHash(identifier + abTest.id);
    const percentage = hash % 100;
    
    return percentage < abTest.traffic_split ? 'variant' : 'control';
  }

  /**
   * Simple hash function for A/B test assignment
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get notification analytics for a site
   */
  public async getNotificationAnalytics(
    siteId: string,
    startDate: Date,
    endDate: Date
  ): Promise<NotificationAnalytics> {
    try {
      // TODO: Implement comprehensive analytics aggregation
      // For now, return mock data
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        clickThroughRate: 0,
        conversionRate: 0,
      };
    } catch (error) {
      this.logger.error("Error getting notification analytics", {
        siteId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Bulk process multiple events (for high-throughput scenarios)
   */
  public async processBulkEvents(events: NotificationWorkflowInput[]): Promise<NotificationDeliveryResult[][]> {
    const results: NotificationDeliveryResult[][] = [];
    
    // Process events in batches to avoid overwhelming the system
    const batchSize = 10;
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchPromises = batch.map(event => this.processEvent(event));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error("Error processing event batch", {
          batchStart: i,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next batch
      }
    }
    
    return results;
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Clean up any resources if needed
    this.logger.info("Notification business service cleanup completed");
  }
} 