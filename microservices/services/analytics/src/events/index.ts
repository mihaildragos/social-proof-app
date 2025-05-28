// Export all event-related functionality for analytics service

export * from './types';
export * from './processors';
 
// Re-export main classes for convenience
export { AnalyticsEventProcessor, createAnalyticsEventProcessor } from './processors'; 