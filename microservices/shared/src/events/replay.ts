import { KafkaConsumer, KafkaConsumerConfig } from "./consumer";
import { KafkaProducer } from "./producer";
import { Event, KAFKA_TOPICS } from "./schemas";
import { validateAndMigrateEvent } from "./versioning";
import { getContextLogger } from "../utils/logger";

const logger = getContextLogger({ service: "event-replay" });

/**
 * Event replay configuration
 */
export interface EventReplayConfig {
  // Source configuration
  sourceTopics: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;

  // Target configuration
  targetTopics?: string[];
  targetProducer?: KafkaProducer;

  // Filtering
  eventTypes?: string[];
  organizationIds?: string[];
  siteIds?: string[];

  // Processing options
  batchSize?: number;
  maxConcurrency?: number;
  validateEvents?: boolean;
  migrateEvents?: boolean;

  // Progress tracking
  onProgress?: (progress: ReplayProgress) => void;
  onError?: (error: Error, event?: any) => void;
  onComplete?: (summary: ReplaySummary) => void;
}

/**
 * Replay progress information
 */
export interface ReplayProgress {
  totalEvents: number;
  processedEvents: number;
  successfulEvents: number;
  failedEvents: number;
  currentTopic: string;
  currentPartition: number;
  currentOffset: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

/**
 * Replay summary
 */
export interface ReplaySummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  errors: Array<{
    error: string;
    event?: any;
    timestamp: Date;
  }>;
}

/**
 * Event replay service
 */
export class EventReplayService {
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private progress: ReplayProgress;
  private summary: ReplaySummary;
  private errors: Array<{ error: string; event?: any; timestamp: Date }> = [];

  constructor(
    private config: EventReplayConfig,
    private consumerConfig: KafkaConsumerConfig,
    private producer?: KafkaProducer
  ) {
    this.progress = {
      totalEvents: 0,
      processedEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      currentTopic: "",
      currentPartition: 0,
      currentOffset: "0",
      startTime: new Date(),
    };

    this.summary = {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      duration: 0,
      startTime: new Date(),
      endTime: new Date(),
      errors: [],
    };
  }

  /**
   * Start the replay process
   */
  async start(): Promise<ReplaySummary> {
    if (this.isRunning) {
      throw new Error("Replay is already running");
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.progress.startTime = new Date();
    this.summary.startTime = new Date();
    this.errors = [];

    logger.info("Starting event replay", {
      sourceTopics: this.config.sourceTopics,
      fromTimestamp: this.config.fromTimestamp,
      toTimestamp: this.config.toTimestamp,
      eventTypes: this.config.eventTypes,
      organizationIds: this.config.organizationIds,
    });

    try {
      // Create consumer for replay
      const consumer = new KafkaConsumer({
        ...this.consumerConfig,
        topic: this.config.sourceTopics,
        groupId: `${this.consumerConfig.groupId}-replay-${Date.now()}`,
        fromBeginning: true,
      });

      // Set up event handler
      consumer.setEventHandler(async (event: Event) => {
        await this.processEvent(event);
      });

      // Set up error handler
      consumer.setErrorHandler(async (error: Error, message?: any) => {
        await this.handleError(error, message);
      });

      // Start consuming
      await consumer.start();

      // Wait for completion or stop signal
      await this.waitForCompletion();

      // Disconnect consumer
      await consumer.disconnect();

      this.summary.endTime = new Date();
      this.summary.duration = this.summary.endTime.getTime() - this.summary.startTime.getTime();
      this.summary.errors = [...this.errors];

      logger.info("Event replay completed", {
        totalEvents: this.summary.totalEvents,
        successfulEvents: this.summary.successfulEvents,
        failedEvents: this.summary.failedEvents,
        duration: this.summary.duration,
      });

      if (this.config.onComplete) {
        this.config.onComplete(this.summary);
      }

      return this.summary;
    } catch (error: any) {
      logger.error("Event replay failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the replay process
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping event replay");
    this.shouldStop = true;
  }

  /**
   * Get current progress
   */
  getProgress(): ReplayProgress {
    return { ...this.progress };
  }

  /**
   * Process a single event
   */
  private async processEvent(event: Event): Promise<void> {
    try {
      // Update progress
      this.progress.processedEvents++;
      this.progress.totalEvents = Math.max(
        this.progress.totalEvents,
        this.progress.processedEvents
      );

      // Check if we should stop
      if (this.shouldStop) {
        return;
      }

      // Apply timestamp filtering
      if (this.config.fromTimestamp && new Date(event.timestamp) < this.config.fromTimestamp) {
        return;
      }

      if (this.config.toTimestamp && new Date(event.timestamp) > this.config.toTimestamp) {
        return;
      }

      // Apply event type filtering
      if (this.config.eventTypes && !this.config.eventTypes.includes(event.type)) {
        return;
      }

      // Apply organization filtering
      if (
        this.config.organizationIds &&
        event.organizationId &&
        !this.config.organizationIds.includes(event.organizationId)
      ) {
        return;
      }

      // Apply site filtering
      if (this.config.siteIds && event.siteId && !this.config.siteIds.includes(event.siteId)) {
        return;
      }

      let processedEvent = event;

      // Validate and migrate if requested
      if (this.config.validateEvents || this.config.migrateEvents) {
        const validation = validateAndMigrateEvent(event);
        if (!validation.valid) {
          throw new Error(`Invalid event: ${validation.errors?.join(", ")}`);
        }
        processedEvent = validation.event!;
      }

      // Replay the event
      await this.replayEvent(processedEvent);

      this.progress.successfulEvents++;
      this.summary.successfulEvents++;

      // Report progress
      if (this.config.onProgress && this.progress.processedEvents % 100 === 0) {
        this.updateProgressEstimate();
        this.config.onProgress(this.progress);
      }
    } catch (error: any) {
      await this.handleError(error, event);
    }
  }

  /**
   * Replay a single event
   */
  private async replayEvent(event: Event): Promise<void> {
    if (this.config.targetProducer || this.producer) {
      const producer = this.config.targetProducer || this.producer!;

      // Determine target topics
      const targetTopics = this.config.targetTopics || [event.type];

      for (const topic of targetTopics) {
        await producer.produce(topic, event, event.organizationId || event.id);
      }
    }

    // Log the replayed event
    logger.debug("Replayed event", {
      eventId: event.id,
      eventType: event.type,
      timestamp: event.timestamp,
      organizationId: event.organizationId,
    });
  }

  /**
   * Handle errors during replay
   */
  private async handleError(error: Error, event?: any): Promise<void> {
    this.progress.failedEvents++;
    this.summary.failedEvents++;

    const errorInfo = {
      error: error.message,
      event,
      timestamp: new Date(),
    };

    this.errors.push(errorInfo);

    logger.error("Error during event replay:", error, {
      eventId: event?.id,
      eventType: event?.type,
    });

    if (this.config.onError) {
      try {
        await this.config.onError(error, event);
      } catch (handlerError: any) {
        logger.error("Error in replay error handler:", handlerError);
      }
    }
  }

  /**
   * Wait for replay completion
   */
  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.shouldStop) {
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Update progress time estimates
   */
  private updateProgressEstimate(): void {
    const now = new Date();
    const elapsed = now.getTime() - this.progress.startTime.getTime();
    const rate = this.progress.processedEvents / elapsed; // events per ms

    if (rate > 0 && this.progress.totalEvents > this.progress.processedEvents) {
      const remaining = this.progress.totalEvents - this.progress.processedEvents;
      this.progress.estimatedTimeRemaining = remaining / rate;
    }
  }
}

/**
 * Utility functions for event replay
 */

/**
 * Replay events from a specific timestamp
 */
export async function replayEventsFromTimestamp(
  fromTimestamp: Date,
  toTimestamp: Date,
  options: {
    sourceTopics?: string[];
    targetTopics?: string[];
    eventTypes?: string[];
    organizationIds?: string[];
    consumerConfig: KafkaConsumerConfig;
    producer?: KafkaProducer;
    onProgress?: (progress: ReplayProgress) => void;
  }
): Promise<ReplaySummary> {
  const replayService = new EventReplayService(
    {
      sourceTopics: options.sourceTopics || Object.values(KAFKA_TOPICS),
      fromTimestamp,
      toTimestamp,
      targetTopics: options.targetTopics,
      eventTypes: options.eventTypes,
      organizationIds: options.organizationIds,
      validateEvents: true,
      migrateEvents: true,
      onProgress: options.onProgress,
    },
    options.consumerConfig,
    options.producer
  );

  return replayService.start();
}

/**
 * Replay events for a specific organization
 */
export async function replayEventsForOrganization(
  organizationId: string,
  fromTimestamp: Date,
  toTimestamp: Date,
  options: {
    sourceTopics?: string[];
    targetTopics?: string[];
    eventTypes?: string[];
    consumerConfig: KafkaConsumerConfig;
    producer?: KafkaProducer;
    onProgress?: (progress: ReplayProgress) => void;
  }
): Promise<ReplaySummary> {
  return replayEventsFromTimestamp(fromTimestamp, toTimestamp, {
    ...options,
    organizationIds: [organizationId],
  });
}

/**
 * Replay specific event types
 */
export async function replayEventTypes(
  eventTypes: string[],
  fromTimestamp: Date,
  toTimestamp: Date,
  options: {
    sourceTopics?: string[];
    targetTopics?: string[];
    organizationIds?: string[];
    consumerConfig: KafkaConsumerConfig;
    producer?: KafkaProducer;
    onProgress?: (progress: ReplayProgress) => void;
  }
): Promise<ReplaySummary> {
  return replayEventsFromTimestamp(fromTimestamp, toTimestamp, {
    ...options,
    eventTypes,
  });
}

/**
 * Create a replay consumer for manual processing
 */
export function createReplayConsumer(
  config: KafkaConsumerConfig,
  options: {
    fromTimestamp?: Date;
    toTimestamp?: Date;
    eventTypes?: string[];
    organizationIds?: string[];
    validateEvents?: boolean;
  } = {}
): KafkaConsumer {
  const consumer = new KafkaConsumer({
    ...config,
    groupId: `${config.groupId}-replay-${Date.now()}`,
    fromBeginning: true,
  });

  // Set up filtering event handler
  const originalHandler = consumer["eventHandler"];
  consumer.setEventHandler(async (event: Event) => {
    // Apply filters
    if (options.fromTimestamp && new Date(event.timestamp) < options.fromTimestamp) {
      return;
    }

    if (options.toTimestamp && new Date(event.timestamp) > options.toTimestamp) {
      return;
    }

    if (options.eventTypes && !options.eventTypes.includes(event.type)) {
      return;
    }

    if (
      options.organizationIds &&
      event.organizationId &&
      !options.organizationIds.includes(event.organizationId)
    ) {
      return;
    }

    // Validate if requested
    if (options.validateEvents) {
      const validation = validateAndMigrateEvent(event);
      if (!validation.valid) {
        logger.warn("Skipping invalid event during replay", {
          eventId: event.id,
          eventType: event.type,
          errors: validation.errors,
        });
        return;
      }
      event = validation.event!;
    }

    // Call original handler if set
    if (originalHandler) {
      await originalHandler(event);
    }
  });

  return consumer;
}
