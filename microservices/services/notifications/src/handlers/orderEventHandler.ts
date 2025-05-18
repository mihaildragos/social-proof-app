import { Logger } from "../utils/logger";
import { NotificationService } from "../services/notificationService";
import { RedisPublisher } from "../redis/publisher";
import { OrderEvent } from "../types/events";

export class OrderEventHandler {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly redisPublisher: RedisPublisher,
    private readonly logger: Logger
  ) {}

  public async handle(event: OrderEvent): Promise<void> {
    try {
      this.logger.info("Handling order event", { eventType: event.type, orderId: event.data.id });

      // 1. Find notification templates applicable for this event type for the site
      const templates = await this.notificationService.findTemplatesForEvent(
        event.siteId,
        event.type
      );

      if (templates.length === 0) {
        this.logger.info("No templates found for event", {
          eventType: event.type,
          siteId: event.siteId,
        });
        return;
      }

      // 2. Process each template and create notifications
      for (const template of templates) {
        // 3. Generate notification content using the template and event data
        const notification = await this.notificationService.createNotification({
          siteId: event.siteId,
          templateId: template.id,
          eventType: event.type,
          eventData: event.data,
          channels: template.channels,
          status: "pending",
        });

        // 4. Apply targeting rules (if any)
        const shouldDisplay = await this.notificationService.evaluateTargetingRules(
          notification.id,
          event.data
        );

        if (!shouldDisplay) {
          this.logger.info("Notification filtered out by targeting rules", {
            notificationId: notification.id,
          });
          continue;
        }

        // 5. Update notification status
        await this.notificationService.updateNotificationStatus(notification.id, "ready");

        // 6. Publish to Redis for real-time delivery
        await this.redisPublisher.publishNotification({
          id: notification.id,
          siteId: notification.siteId,
          content: notification.content,
          templateId: notification.templateId,
          eventType: notification.eventType,
          channels: notification.channels,
          createdAt: notification.createdAt,
        });

        // 7. Record event for analytics
        await this.notificationService.recordNotificationEvent({
          notificationId: notification.id,
          siteId: notification.siteId,
          eventType: "notification_created",
          metadata: {
            originalEventType: event.type,
            originalEventId: event.id,
          },
        });

        this.logger.info("Successfully processed notification", {
          notificationId: notification.id,
        });
      }
    } catch (error) {
      this.logger.error("Error handling order event", {
        eventType: event.type,
        orderId: event.data?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
