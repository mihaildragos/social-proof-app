import { getContextLogger } from "@social-proof/shared/utils/logger";
import { NotificationQueueService, DeliveryChannel } from "./queue-service";
import { EmailNotificationProcessor, EmailConfig } from "../channels/email";
import { PushNotificationProcessor, PushConfig } from "../channels/push";
import { WebNotificationProcessor, WebConfig } from "../channels/web";

const logger = getContextLogger({ service: "processor-registry" });

/**
 * Processor registry configuration
 */
export interface ProcessorRegistryConfig {
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
}

/**
 * Default processor configurations
 */
const getDefaultConfig = (): ProcessorRegistryConfig => ({
  email: {
    enabled: true,
    config: {
      provider: "sendgrid",
      apiKey: process.env.SENDGRID_API_KEY || "test-api-key",
      fromEmail: process.env.FROM_EMAIL || "notifications@example.com",
      fromName: process.env.FROM_NAME || "Social Proof App",
      replyTo: process.env.REPLY_TO_EMAIL,
      templates: {
        default: "default-template",
        order: "order-template",
        welcome: "welcome-template",
        notification: "notification-template",
      },
      rateLimits: {
        perSecond: 10,
        perMinute: 600,
        perHour: 36000,
      },
    },
  },
  push: {
    enabled: true,
    config: {
      provider: "firebase",
      serverKey: process.env.FIREBASE_SERVER_KEY || "test-server-key",
      projectId: process.env.FIREBASE_PROJECT_ID || "test-project",
      rateLimits: {
        perSecond: 20,
        perMinute: 1200,
        perHour: 72000,
      },
      retryConfig: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
    },
  },
  web: {
    enabled: true,
    config: {
      websocketPort: parseInt(process.env.WEBSOCKET_PORT || "3003"),
      sseEndpoint: "/api/notifications/sse",
      enableWebSocket: true,
      enableSSE: true,
      rateLimits: {
        perSecond: 50,
        perMinute: 3000,
        perHour: 180000,
      },
      retryConfig: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        initialDelay: 500,
      },
    },
  },
});

/**
 * Global processor registry instance
 */
let processorRegistry: ProcessorRegistry | null = null;

/**
 * Processor registry class
 */
export class ProcessorRegistry {
  private config: ProcessorRegistryConfig;
  private emailProcessor?: EmailNotificationProcessor;
  private pushProcessor?: PushNotificationProcessor;
  private webProcessor?: WebNotificationProcessor;
  private isInitialized = false;

  constructor(config?: Partial<ProcessorRegistryConfig>) {
    this.config = {
      ...getDefaultConfig(),
      ...config,
    };
  }

  /**
   * Initialize all processors
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Processor registry already initialized");
      return;
    }

    logger.info("Initializing notification processors", {
      emailEnabled: this.config.email.enabled,
      pushEnabled: this.config.push.enabled,
      webEnabled: this.config.web.enabled,
    });

    try {
      // Initialize email processor
      if (this.config.email.enabled) {
        this.emailProcessor = new EmailNotificationProcessor(this.config.email.config);
        logger.info("Email processor initialized");
      }

      // Initialize push processor
      if (this.config.push.enabled) {
        this.pushProcessor = new PushNotificationProcessor(this.config.push.config);
        logger.info("Push processor initialized");
      }

      // Initialize web processor
      if (this.config.web.enabled) {
        this.webProcessor = new WebNotificationProcessor(this.config.web.config);
        logger.info("Web processor initialized");
      }

      this.isInitialized = true;
      logger.info("All notification processors initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize processors", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Register processors with queue service
   */
  public registerWithQueueService(queueService: NotificationQueueService): void {
    if (!this.isInitialized) {
      throw new Error("Processor registry not initialized. Call initialize() first.");
    }

    logger.info("Registering processors with queue service");

    // Register email processor
    if (this.emailProcessor) {
      queueService.registerProcessor(DeliveryChannel.EMAIL, this.emailProcessor);
      logger.info("Email processor registered with queue service");
    }

    // Register push processor
    if (this.pushProcessor) {
      queueService.registerProcessor(DeliveryChannel.PUSH, this.pushProcessor);
      logger.info("Push processor registered with queue service");
    }

    // Register web processor
    if (this.webProcessor) {
      queueService.registerProcessor(DeliveryChannel.WEB, this.webProcessor);
      logger.info("Web processor registered with queue service");
    }

    logger.info("All processors registered with queue service");
  }

  /**
   * Get processor by channel
   */
  public getProcessor(channel: DeliveryChannel) {
    switch (channel) {
      case DeliveryChannel.EMAIL:
        return this.emailProcessor;
      case DeliveryChannel.PUSH:
        return this.pushProcessor;
      case DeliveryChannel.WEB:
        return this.webProcessor;
      default:
        return undefined;
    }
  }

  /**
   * Get processor statistics
   */
  public getStats() {
    const stats: Record<string, any> = {};

    if (this.emailProcessor) {
      stats.email = this.emailProcessor.getStats();
    }

    if (this.pushProcessor) {
      stats.push = this.pushProcessor.getStats();
    }

    if (this.webProcessor) {
      stats.web = this.webProcessor.getStats();
    }

    return {
      isInitialized: this.isInitialized,
      enabledProcessors: Object.keys(stats),
      processorStats: stats,
    };
  }

  /**
   * Shutdown all processors
   */
  public async shutdown(): Promise<void> {
    logger.info("Shutting down processor registry");

    // In a real implementation, you'd gracefully shutdown each processor
    // For now, just mark as not initialized
    this.isInitialized = false;

    logger.info("Processor registry shutdown complete");
  }
}

/**
 * Initialize notification processors (singleton pattern)
 */
export async function initializeNotificationProcessors(
  config?: Partial<ProcessorRegistryConfig>
): Promise<ProcessorRegistry> {
  if (!processorRegistry) {
    processorRegistry = new ProcessorRegistry(config);
    await processorRegistry.initialize();
  }
  return processorRegistry;
}

/**
 * Get the global processor registry instance
 */
export function getProcessorRegistry(): ProcessorRegistry | null {
  return processorRegistry;
}

/**
 * Register processors with a queue service
 */
export function registerProcessorsWithQueueService(queueService: NotificationQueueService): void {
  if (!processorRegistry) {
    throw new Error(
      "Processor registry not initialized. Call initializeNotificationProcessors() first."
    );
  }
  processorRegistry.registerWithQueueService(queueService);
}
