// Event processor for user-related events
// Refactored to use extracted types and handlers

import { Event } from './types';
import {
  UserEventHandlers,
  SiteEventHandlers,
  IntegrationEventHandlers,
  SubscriptionEventHandlers
} from './handlers';

/**
 * Main event processor that coordinates different event handlers
 */
export class UserEventProcessor {
  private isRunning: boolean = false;
  private userHandlers: UserEventHandlers;
  private siteHandlers: SiteEventHandlers;
  private integrationHandlers: IntegrationEventHandlers;
  private subscriptionHandlers: SubscriptionEventHandlers;

  constructor() {
    this.userHandlers = new UserEventHandlers();
    this.siteHandlers = new SiteEventHandlers();
    this.integrationHandlers = new IntegrationEventHandlers();
    this.subscriptionHandlers = new SubscriptionEventHandlers();
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    console.log("Starting user event processor");
    this.isRunning = true;
    // In a real implementation, this would connect to Kafka and start consuming
  }

  /**
   * Stop processing events
   */
  async stop(): Promise<void> {
    console.log("Stopping user event processor");
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
        // User events
        case "user.registered":
          await this.userHandlers.handleUserRegistered(event);
          break;
        case "user.login":
          await this.userHandlers.handleUserLogin(event);
          break;
        case "user.logout":
          await this.userHandlers.handleUserLogout(event);
          break;

        // Site events
        case "site.created":
          await this.siteHandlers.handleSiteCreated(event);
          break;
        case "site.updated":
          await this.siteHandlers.handleSiteUpdated(event);
          break;
        case "site.deleted":
          await this.siteHandlers.handleSiteDeleted(event);
          break;

        // Integration events
        case "integration.connected":
          await this.integrationHandlers.handleIntegrationConnected(event);
          break;
        case "integration.disconnected":
          await this.integrationHandlers.handleIntegrationDisconnected(event);
          break;

        // Subscription events
        case "subscription.created":
          await this.subscriptionHandlers.handleSubscriptionCreated(event);
          break;
        case "subscription.updated":
          await this.subscriptionHandlers.handleSubscriptionUpdated(event);
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
 * Factory function to create and configure user event processor
 */
export function createUserEventProcessor(): UserEventProcessor {
  return new UserEventProcessor();
}
