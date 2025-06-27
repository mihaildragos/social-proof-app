import { getContextLogger } from '@social-proof/shared/utils/logger';
import { NotificationQueueService } from './queue-service';
import { DeliveryConfirmationService } from './delivery-service';
import { initializeNotificationProcessors, registerProcessorsWithQueueService } from './processor-registry';

const logger = getContextLogger({ service: 'service-registry' });

/**
 * Global service registry
 */
class ServiceRegistry {
  private static instance: ServiceRegistry;
  private queueService?: NotificationQueueService;
  private deliveryService?: DeliveryConfirmationService;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service registry already initialized');
      return;
    }

    logger.info('Initializing service registry');

    try {
      // Initialize core services
      this.queueService = new NotificationQueueService();
      this.deliveryService = new DeliveryConfirmationService();

      // Initialize notification processors
      await initializeNotificationProcessors();

      // Register processors with queue service
      registerProcessorsWithQueueService(this.queueService);

      this.isInitialized = true;
      logger.info('Service registry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize service registry', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get queue service instance
   */
  public getQueueService(): NotificationQueueService {
    if (!this.queueService) {
      throw new Error('Service registry not initialized. Call initialize() first.');
    }
    return this.queueService;
  }

  /**
   * Get delivery service instance
   */
  public getDeliveryService(): DeliveryConfirmationService {
    if (!this.deliveryService) {
      throw new Error('Service registry not initialized. Call initialize() first.');
    }
    return this.deliveryService;
  }

  /**
   * Check if services are initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown all services
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down service registry');

    if (this.queueService) {
      await this.queueService.stop();
    }

    this.isInitialized = false;
    logger.info('Service registry shutdown complete');
  }
}

/**
 * Get the global service registry instance
 */
export function getServiceRegistry(): ServiceRegistry {
  return ServiceRegistry.getInstance();
}

/**
 * Initialize the service registry
 */
export async function initializeServices(): Promise<void> {
  const registry = getServiceRegistry();
  await registry.initialize();
}

/**
 * Get queue service (convenience function)
 */
export function getQueueService(): NotificationQueueService {
  return getServiceRegistry().getQueueService();
}

/**
 * Get delivery service (convenience function)
 */
export function getDeliveryService(): DeliveryConfirmationService {
  return getServiceRegistry().getDeliveryService();
} 