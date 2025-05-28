import { Event } from './types';
import {
  NotificationEventHandlers,
  CampaignEventHandlers,
  ABTestEventHandlers
} from './handlers';

/**
 * Main event processor that coordinates different notification event handlers
 */
export class NotificationEventProcessor {
  private isRunning: boolean = false;
  private notificationHandlers: NotificationEventHandlers;
  private campaignHandlers: CampaignEventHandlers;
  private abTestHandlers: ABTestEventHandlers;

  constructor() {
    this.notificationHandlers = new NotificationEventHandlers();
    this.campaignHandlers = new CampaignEventHandlers();
    this.abTestHandlers = new ABTestEventHandlers();
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    console.log("Starting notification event processor");
    this.isRunning = true;
    // In a real implementation, this would connect to Kafka and start consuming
  }

  /**
   * Stop processing events
   */
  async stop(): Promise<void> {
    console.log("Stopping notification event processor");
    this.isRunning = false;
  }

  /**
   * Handle incoming events by routing to appropriate handlers
   */
  async handleEvent(event: Event): Promise<void> {
    console.log("Processing event", {
      type: event.type,
      id: event.id,
      organizationId: event.organizationId,
    });

    try {
      switch (event.type) {
        // Notification lifecycle events
        case "notification.created":
          await this.notificationHandlers.handleNotificationCreated(event);
          break;
        case "notification.triggered":
          await this.notificationHandlers.handleNotificationTriggered(event);
          break;
        case "notification.displayed":
          await this.notificationHandlers.handleNotificationDisplayed(event);
          break;
        case "notification.clicked":
          await this.notificationHandlers.handleNotificationClicked(event);
          break;
        case "notification.closed":
          await this.notificationHandlers.handleNotificationClosed(event);
          break;

        // Campaign events
        case "campaign.started":
          await this.campaignHandlers.handleCampaignStarted(event);
          break;
        case "campaign.ended":
          await this.campaignHandlers.handleCampaignEnded(event);
          break;

        // A/B test events
        case "ab_test.started":
          await this.abTestHandlers.handleABTestStarted(event);
          break;
        case "ab_test.ended":
          await this.abTestHandlers.handleABTestEnded(event);
          break;

        default:
          console.log("Unhandled event type", { type: (event as Event).type });
      }
    } catch (error: any) {
      console.error("Error processing event", {
        error: error.message,
        eventType: event.type,
        eventId: event.id,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get processor status
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Factory function to create and configure notification event processor
 */
export function createNotificationEventProcessor(): NotificationEventProcessor {
  return new NotificationEventProcessor();
}
 