import { Event } from './types';
import {
  IntegrationEventHandlers,
  WebhookEventHandlers,
  SiteEventHandlers
} from './handlers';

/**
 * Main event processor that coordinates different integration event handlers
 */
export class IntegrationEventProcessor {
  private isRunning: boolean = false;
  private integrationHandlers: IntegrationEventHandlers;
  private webhookHandlers: WebhookEventHandlers;
  private siteHandlers: SiteEventHandlers;

  constructor() {
    this.integrationHandlers = new IntegrationEventHandlers();
    this.webhookHandlers = new WebhookEventHandlers();
    this.siteHandlers = new SiteEventHandlers();
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    console.log("Starting integration event processor");
    this.isRunning = true;
    // In a real implementation, this would connect to Kafka and start consuming
  }

  /**
   * Stop processing events
   */
  async stop(): Promise<void> {
    console.log("Stopping integration event processor");
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
        // Integration events
        case "integration.connected":
          await this.integrationHandlers.handleIntegrationConnected(event);
          break;
        case "integration.disconnected":
          await this.integrationHandlers.handleIntegrationDisconnected(event);
          break;

        // Webhook events
        case "webhook.received":
          await this.webhookHandlers.handleWebhookReceived(event);
          break;

        // Site events
        case "site.created":
          await this.siteHandlers.handleSiteCreated(event);
          break;
        case "site.deleted":
          await this.siteHandlers.handleSiteDeleted(event);
          break;

        default:
          console.log("Unhandled event type", { type: (event as Event).type });
      }
    } catch (error: any) {
      console.error("Error processing event", {
        error: error.message,
        eventType: event.type,
        eventId: event.id,
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
 * Factory function to create and configure integration event processor
 */
export function createIntegrationEventProcessor(): IntegrationEventProcessor {
  return new IntegrationEventProcessor();
}
