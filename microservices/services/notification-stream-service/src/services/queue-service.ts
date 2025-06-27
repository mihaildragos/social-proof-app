import { EventEmitter } from "events";
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "queue-service" });

// Notification priority levels
export enum NotificationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5,
}

// Notification delivery channels
export enum DeliveryChannel {
  WEB = "web",
  EMAIL = "email",
  PUSH = "push",
  SMS = "sms",
  WEBHOOK = "webhook",
}

// Notification status
export enum NotificationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  DELIVERED = "delivered",
  FAILED = "failed",
  RETRYING = "retrying",
  EXPIRED = "expired",
}

// Notification interface
export interface QueuedNotification {
  id: string;
  organizationId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  payload: {
    type: string;
    title?: string;
    message: string;
    data?: Record<string, any>;
    template?: string;
    templateData?: Record<string, any>;
  };
  targeting: {
    userIds?: string[];
    segments?: string[];
    conditions?: Record<string, any>;
  };
  scheduling: {
    sendAt?: Date;
    expiresAt?: Date;
    timezone?: string;
  };
  delivery: {
    maxRetries: number;
    retryDelay: number;
    retryBackoff: number;
  };
  metadata: {
    campaignId?: string;
    abTestId?: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
  };
  status: NotificationStatus;
  attempts: number;
  lastAttempt?: Date;
  lastError?: string;
  deliveredChannels: DeliveryChannel[];
  failedChannels: DeliveryChannel[];
}

// Queue configuration
export interface QueueConfig {
  maxSize: number;
  batchSize: number;
  processingInterval: number;
  retryInterval: number;
  maxRetries: number;
  defaultRetryDelay: number;
  defaultRetryBackoff: number;
  enablePriorityProcessing: boolean;
  enableBatching: boolean;
  enableMetrics: boolean;
}

// Queue statistics
export interface QueueStats {
  totalNotifications: number;
  pendingNotifications: number;
  processingNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  expiredNotifications: number;
  notificationsByPriority: Record<NotificationPriority, number>;
  notificationsByChannel: Record<DeliveryChannel, number>;
  averageProcessingTime: number;
  throughputPerMinute: number;
}

// Notification processor interface
export interface NotificationProcessor {
  processNotification(notification: QueuedNotification): Promise<{
    success: boolean;
    deliveredChannels: DeliveryChannel[];
    failedChannels: DeliveryChannel[];
    error?: string;
  }>;
}

/**
 * Notification Queue Manager
 */
export class NotificationQueueService extends EventEmitter {
  private queues: Map<NotificationPriority, QueuedNotification[]> = new Map();
  private processing: Map<string, QueuedNotification> = new Map();
  private completed: Map<string, QueuedNotification> = new Map();
  private processors: Map<DeliveryChannel, NotificationProcessor> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private config: QueueConfig;
  private stats: QueueStats;

  constructor(config?: Partial<QueueConfig>) {
    super();

    this.config = {
      maxSize: 100000,
      batchSize: 50,
      processingInterval: 1000, // 1 second
      retryInterval: 5000, // 5 seconds
      maxRetries: 3,
      defaultRetryDelay: 5000,
      defaultRetryBackoff: 2,
      enablePriorityProcessing: true,
      enableBatching: true,
      enableMetrics: true,
      ...config,
    };

    this.stats = {
      totalNotifications: 0,
      pendingNotifications: 0,
      processingNotifications: 0,
      deliveredNotifications: 0,
      failedNotifications: 0,
      expiredNotifications: 0,
      notificationsByPriority: {} as Record<NotificationPriority, number>,
      notificationsByChannel: {} as Record<DeliveryChannel, number>,
      averageProcessingTime: 0,
      throughputPerMinute: 0,
    };

    // Initialize priority queues
    Object.values(NotificationPriority).forEach((priority) => {
      if (typeof priority === "number") {
        this.queues.set(priority, []);
        this.stats.notificationsByPriority[priority] = 0;
      }
    });

    // Initialize channel stats
    Object.values(DeliveryChannel).forEach((channel) => {
      this.stats.notificationsByChannel[channel] = 0;
    });

    this.startProcessing();
    logger.info("Notification queue service initialized", this.config);
  }

  /**
   * Add notification to queue
   */
  public async enqueue(
    notification: Omit<
      QueuedNotification,
      "id" | "status" | "attempts" | "deliveredChannels" | "failedChannels"
    >
  ): Promise<string> {
    // Check queue size limit
    const totalQueued = this.getTotalQueuedCount();
    if (totalQueued >= this.config.maxSize) {
      throw new Error("Queue is full");
    }

    // Generate notification ID
    const id = this.generateNotificationId();

    // Create queued notification
    const queuedNotification: QueuedNotification = {
      ...notification,
      id,
      status: NotificationStatus.PENDING,
      attempts: 0,
      deliveredChannels: [],
      failedChannels: [],
      delivery: {
        ...notification.delivery,
        maxRetries: notification.delivery?.maxRetries ?? this.config.maxRetries,
        retryDelay: notification.delivery?.retryDelay ?? this.config.defaultRetryDelay,
        retryBackoff: notification.delivery?.retryBackoff ?? this.config.defaultRetryBackoff,
      },
    };

    // Add to appropriate priority queue
    const queue = this.queues.get(queuedNotification.priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${queuedNotification.priority}`);
    }

    queue.push(queuedNotification);

    // Update statistics
    this.stats.totalNotifications++;
    this.stats.pendingNotifications++;
    this.stats.notificationsByPriority[queuedNotification.priority]++;

    queuedNotification.channels.forEach((channel) => {
      this.stats.notificationsByChannel[channel]++;
    });

    logger.info("Notification enqueued", {
      id,
      priority: queuedNotification.priority,
      channels: queuedNotification.channels,
      organizationId: queuedNotification.organizationId,
    });

    if (this.config.enableMetrics) {
      metrics.increment("notifications.enqueued", {
        priority: NotificationPriority[queuedNotification.priority],
        channels: queuedNotification.channels.join(","),
      });
      metrics.gauge("notifications.queue.size", totalQueued + 1);
    }

    this.emit("enqueued", queuedNotification);
    return id;
  }

  /**
   * Get notification by ID
   */
  public getNotification(id: string): QueuedNotification | undefined {
    // Check processing notifications
    if (this.processing.has(id)) {
      return this.processing.get(id);
    }

    // Check completed notifications
    if (this.completed.has(id)) {
      return this.completed.get(id);
    }

    // Check queued notifications
    for (const queue of this.queues.values()) {
      const notification = queue.find((n) => n.id === id);
      if (notification) {
        return notification;
      }
    }

    return undefined;
  }

  /**
   * Cancel notification
   */
  public cancelNotification(id: string): boolean {
    // Remove from queues
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((n) => n.id === id);
      if (index !== -1) {
        const notification = queue.splice(index, 1)[0];
        this.stats.pendingNotifications--;

        logger.info("Notification cancelled", { id });
        this.emit("cancelled", notification);
        return true;
      }
    }

    // Cannot cancel if already processing or completed
    return false;
  }

  /**
   * Register notification processor for a channel
   */
  public registerProcessor(channel: DeliveryChannel, processor: NotificationProcessor): void {
    this.processors.set(channel, processor);
    logger.info("Notification processor registered", { channel });
  }

  /**
   * Start processing notifications
   */
  private startProcessing(): void {
    // Main processing loop
    this.processingInterval = setInterval(async () => {
      await this.processNotifications();
    }, this.config.processingInterval);

    // Retry processing loop
    this.retryInterval = setInterval(async () => {
      await this.processRetries();
    }, this.config.retryInterval);

    logger.info("Notification processing started");
  }

  /**
   * Process notifications from queues
   */
  private async processNotifications(): Promise<void> {
    try {
      const notifications = this.getNextBatch();

      if (notifications.length === 0) {
        return;
      }

      logger.debug("Processing notification batch", {
        batchSize: notifications.length,
      });

      // Process notifications concurrently
      const promises = notifications.map((notification) => this.processNotification(notification));

      await Promise.allSettled(promises);
    } catch (error) {
      logger.error("Error in notification processing loop:", error);
    }
  }

  /**
   * Get next batch of notifications to process
   */
  private getNextBatch(): QueuedNotification[] {
    const batch: QueuedNotification[] = [];
    const batchSize = this.config.batchSize;

    if (this.config.enablePriorityProcessing) {
      // Process by priority (highest first)
      const priorities = Object.values(NotificationPriority)
        .filter((p) => typeof p === "number")
        .sort((a, b) => (b as number) - (a as number)) as NotificationPriority[];

      for (const priority of priorities) {
        const queue = this.queues.get(priority);
        if (!queue || queue.length === 0) continue;

        while (batch.length < batchSize && queue.length > 0) {
          const notification = queue.shift();
          if (notification && this.shouldProcessNow(notification)) {
            batch.push(notification);
          }
        }

        if (batch.length >= batchSize) break;
      }
    } else {
      // Round-robin processing
      const allQueues = Array.from(this.queues.values()).filter((q) => q.length > 0);
      let queueIndex = 0;

      while (batch.length < batchSize && allQueues.some((q) => q.length > 0)) {
        const queue = allQueues[queueIndex % allQueues.length];

        if (queue.length > 0) {
          const notification = queue.shift();
          if (notification && this.shouldProcessNow(notification)) {
            batch.push(notification);
          }
        }

        queueIndex++;
      }
    }

    return batch;
  }

  /**
   * Check if notification should be processed now
   */
  private shouldProcessNow(notification: QueuedNotification): boolean {
    const now = new Date();

    // Check if expired
    if (notification.scheduling.expiresAt && now > notification.scheduling.expiresAt) {
      this.markAsExpired(notification);
      return false;
    }

    // Check if scheduled for future
    if (notification.scheduling.sendAt && now < notification.scheduling.sendAt) {
      // Put back in queue for later
      const queue = this.queues.get(notification.priority);
      if (queue) {
        queue.push(notification);
      }
      return false;
    }

    return true;
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    const startTime = Date.now();

    try {
      // Move to processing
      this.processing.set(notification.id, notification);
      notification.status = NotificationStatus.PROCESSING;
      notification.attempts++;
      notification.lastAttempt = new Date();

      this.stats.pendingNotifications--;
      this.stats.processingNotifications++;

      logger.info("Processing notification", {
        id: notification.id,
        attempt: notification.attempts,
        channels: notification.channels,
      });

      this.emit("processing", notification);

      // Process each channel
      const results = await Promise.allSettled(
        notification.channels.map(async (channel) => {
          const processor = this.processors.get(channel);
          if (!processor) {
            throw new Error(`No processor registered for channel: ${channel}`);
          }

          return processor.processNotification(notification);
        })
      );

      // Collect results
      const deliveredChannels: DeliveryChannel[] = [];
      const failedChannels: DeliveryChannel[] = [];
      const errors: string[] = [];

      results.forEach((result, index) => {
        const channel = notification.channels[index];

        if (result.status === "fulfilled" && result.value.success) {
          deliveredChannels.push(...result.value.deliveredChannels);
        } else {
          failedChannels.push(channel);

          if (result.status === "rejected") {
            errors.push(`${channel}: ${result.reason}`);
          } else if (result.status === "fulfilled") {
            errors.push(`${channel}: ${result.value.error || "Unknown error"}`);
          }
        }
      });

      // Update notification
      notification.deliveredChannels.push(...deliveredChannels);
      notification.failedChannels.push(...failedChannels);

      if (failedChannels.length === 0) {
        // All channels delivered successfully
        this.markAsDelivered(notification);
      } else if (deliveredChannels.length === 0) {
        // All channels failed
        this.markAsFailed(notification, errors.join("; "));
      } else {
        // Partial delivery - retry failed channels
        notification.channels = failedChannels;
        this.scheduleRetry(notification, errors.join("; "));
      }

      // Update processing time
      const processingTime = Date.now() - startTime;
      this.updateProcessingTime(processingTime);

      if (this.config.enableMetrics) {
        metrics.histogram("notifications.processing_time", processingTime);
        metrics.increment("notifications.processed", {
          status: notification.status,
          channels: deliveredChannels.join(","),
        });
      }
    } catch (error) {
      logger.error("Error processing notification:", error, {
        id: notification.id,
      });

      this.markAsFailed(notification, error instanceof Error ? error.message : "Unknown error");
    } finally {
      // Remove from processing
      this.processing.delete(notification.id);
      this.stats.processingNotifications--;
    }
  }

  /**
   * Process retry notifications
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const retryNotifications: QueuedNotification[] = [];

    // Find notifications ready for retry
    for (const notification of this.completed.values()) {
      if (
        notification.status === NotificationStatus.RETRYING &&
        notification.lastAttempt &&
        now.getTime() - notification.lastAttempt.getTime() >= notification.delivery.retryDelay
      ) {
        if (notification.attempts < notification.delivery.maxRetries) {
          retryNotifications.push(notification);
        } else {
          this.markAsFailed(notification, "Max retries exceeded");
        }
      }
    }

    // Move retry notifications back to queue
    for (const notification of retryNotifications) {
      this.completed.delete(notification.id);
      notification.status = NotificationStatus.PENDING;

      const queue = this.queues.get(notification.priority);
      if (queue) {
        queue.push(notification);
        this.stats.pendingNotifications++;
      }

      logger.info("Notification scheduled for retry", {
        id: notification.id,
        attempt: notification.attempts + 1,
      });
    }
  }

  /**
   * Mark notification as delivered
   */
  private markAsDelivered(notification: QueuedNotification): void {
    notification.status = NotificationStatus.DELIVERED;
    this.completed.set(notification.id, notification);
    this.stats.deliveredNotifications++;

    logger.info("Notification delivered", {
      id: notification.id,
      channels: notification.deliveredChannels,
    });

    this.emit("delivered", notification);
  }

  /**
   * Mark notification as failed
   */
  private markAsFailed(notification: QueuedNotification, error: string): void {
    notification.status = NotificationStatus.FAILED;
    notification.lastError = error;
    this.completed.set(notification.id, notification);
    this.stats.failedNotifications++;

    logger.error("Notification failed", {
      id: notification.id,
      error,
      attempts: notification.attempts,
    });

    this.emit("failed", notification);
  }

  /**
   * Mark notification as expired
   */
  private markAsExpired(notification: QueuedNotification): void {
    notification.status = NotificationStatus.EXPIRED;
    this.completed.set(notification.id, notification);
    this.stats.expiredNotifications++;

    logger.warn("Notification expired", {
      id: notification.id,
      expiresAt: notification.scheduling.expiresAt,
    });

    this.emit("expired", notification);
  }

  /**
   * Schedule notification for retry
   */
  private scheduleRetry(notification: QueuedNotification, error: string): void {
    notification.status = NotificationStatus.RETRYING;
    notification.lastError = error;

    // Calculate next retry delay with backoff
    const baseDelay = notification.delivery.retryDelay;
    const backoffMultiplier = Math.pow(
      notification.delivery.retryBackoff,
      notification.attempts - 1
    );
    notification.delivery.retryDelay = Math.min(baseDelay * backoffMultiplier, 300000); // Max 5 minutes

    this.completed.set(notification.id, notification);

    logger.info("Notification scheduled for retry", {
      id: notification.id,
      retryDelay: notification.delivery.retryDelay,
      attempt: notification.attempts,
    });

    this.emit("retry", notification);
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingTime(processingTime: number): void {
    const currentAvg = this.stats.averageProcessingTime;
    const totalProcessed = this.stats.deliveredNotifications + this.stats.failedNotifications;

    this.stats.averageProcessingTime =
      (currentAvg * (totalProcessed - 1) + processingTime) / totalProcessed;
  }

  /**
   * Get total queued notifications count
   */
  private getTotalQueuedCount(): number {
    return Array.from(this.queues.values()).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    // Update pending count
    this.stats.pendingNotifications = this.getTotalQueuedCount();

    // Calculate throughput (notifications per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    let recentDeliveries = 0;
    for (const notification of this.completed.values()) {
      if (
        notification.status === NotificationStatus.DELIVERED &&
        notification.lastAttempt &&
        notification.lastAttempt.getTime() > oneMinuteAgo
      ) {
        recentDeliveries++;
      }
    }

    this.stats.throughputPerMinute = recentDeliveries;

    return { ...this.stats };
  }

  /**
   * Get notifications by status
   */
  public getNotificationsByStatus(status: NotificationStatus): QueuedNotification[] {
    const notifications: QueuedNotification[] = [];

    if (status === NotificationStatus.PENDING) {
      for (const queue of this.queues.values()) {
        notifications.push(...queue);
      }
    } else if (status === NotificationStatus.PROCESSING) {
      notifications.push(...this.processing.values());
    } else {
      for (const notification of this.completed.values()) {
        if (notification.status === status) {
          notifications.push(notification);
        }
      }
    }

    return notifications;
  }

  /**
   * Clear completed notifications older than specified time
   */
  public clearOldNotifications(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - olderThanMs);
    let cleared = 0;

    for (const [id, notification] of this.completed.entries()) {
      if (notification.metadata.updatedAt < cutoff) {
        this.completed.delete(id);
        cleared++;
      }
    }

    logger.info("Cleared old notifications", { count: cleared });
    return cleared;
  }

  /**
   * Stop processing and cleanup
   */
  public async stop(): Promise<void> {
    logger.info("Stopping notification queue service");

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    // Wait for current processing to complete
    while (this.processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info("Notification queue service stopped");
  }
}

export default NotificationQueueService;
