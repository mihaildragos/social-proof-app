// Export all event-related functionality for notifications service

export * from './types';
export * from './handlers';
export * from './processors';

// Re-export main classes for convenience
export { NotificationEventProcessor, createNotificationEventProcessor } from './processors';
export {
  NotificationEventHandlers,
  CampaignEventHandlers,
  ABTestEventHandlers
} from './handlers'; 