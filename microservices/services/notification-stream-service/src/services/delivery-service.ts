import { EventEmitter } from "events";
import { getContextLogger } from "../utils/logger";
import { metrics } from "../utils/metrics";
import { DeliveryChannel } from "./queue-service";

const logger = getContextLogger({ service: "delivery-service" });

// Delivery confirmation status
export enum DeliveryConfirmationStatus {
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  CLICKED = "clicked",
  FAILED = "failed",
  BOUNCED = "bounced",
  UNSUBSCRIBED = "unsubscribed",
}

// Delivery confirmation interface
export interface DeliveryConfirmation {
  id: string;
  notificationId: string;
  organizationId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  channel: DeliveryChannel;
  status: DeliveryConfirmationStatus;
  timestamp: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    provider?: string;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    clickedUrl?: string;
    readTime?: number;
  };
}

// Delivery statistics
export interface DeliveryStats {
  totalDeliveries: number;
  deliveriesByChannel: Record<DeliveryChannel, number>;
  deliveriesByStatus: Record<DeliveryConfirmationStatus, number>;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  averageDeliveryTime: number;
  averageReadTime: number;
}

// Delivery tracking configuration
export interface DeliveryTrackingConfig {
  enableTracking: boolean;
  enableReadTracking: boolean;
  enableClickTracking: boolean;
  trackingPixelUrl?: string;
  clickTrackingUrl?: string;
  retentionDays: number;
  batchSize: number;
  flushInterval: number;
}

/**
 * Delivery Confirmation Service
 */
export class DeliveryConfirmationService extends EventEmitter {
  private confirmations: Map<string, DeliveryConfirmation> = new Map();
  private pendingConfirmations: DeliveryConfirmation[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private config: DeliveryTrackingConfig;
  private stats: DeliveryStats;

  constructor(config?: Partial<DeliveryTrackingConfig>) {
    super();

    this.config = {
      enableTracking: true,
      enableReadTracking: true,
      enableClickTracking: true,
      trackingPixelUrl: "/api/track/pixel",
      clickTrackingUrl: "/api/track/click",
      retentionDays: 30,
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      ...config,
    };

    this.stats = {
      totalDeliveries: 0,
      deliveriesByChannel: {} as Record<DeliveryChannel, number>,
      deliveriesByStatus: {} as Record<DeliveryConfirmationStatus, number>,
      deliveryRate: 0,
      readRate: 0,
      clickRate: 0,
      bounceRate: 0,
      unsubscribeRate: 0,
      averageDeliveryTime: 0,
      averageReadTime: 0,
    };

    // Initialize channel stats
    Object.values(DeliveryChannel).forEach((channel) => {
      this.stats.deliveriesByChannel[channel] = 0;
    });

    // Initialize status stats
    Object.values(DeliveryConfirmationStatus).forEach((status) => {
      this.stats.deliveriesByStatus[status] = 0;
    });

    if (this.config.enableTracking) {
      this.startBatchProcessing();
    }

    logger.info("Delivery confirmation service initialized", this.config);
  }

  /**
   * Record delivery confirmation
   */
  public async recordDelivery(
    confirmation: Omit<DeliveryConfirmation, "id" | "timestamp">
  ): Promise<string> {
    const id = this.generateConfirmationId();
    const deliveryConfirmation: DeliveryConfirmation = {
      ...confirmation,
      id,
      timestamp: new Date(),
    };

    // Store confirmation
    this.confirmations.set(id, deliveryConfirmation);
    this.pendingConfirmations.push(deliveryConfirmation);

    // Update statistics
    this.updateStats(deliveryConfirmation);

    logger.debug("Delivery confirmation recorded", {
      id,
      notificationId: confirmation.notificationId,
      channel: confirmation.channel,
      status: confirmation.status,
    });

    if (this.config.enableTracking) {
      metrics.increment("delivery.confirmations.recorded", {
        channel: confirmation.channel,
        status: confirmation.status,
      });
    }

    this.emit("confirmation", deliveryConfirmation);
    return id;
  }

  /**
   * Record delivery sent
   */
  public async recordSent(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.SENT,
      metadata,
    });
  }

  /**
   * Record delivery delivered
   */
  public async recordDelivered(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.DELIVERED,
      metadata,
    });
  }

  /**
   * Record delivery read
   */
  public async recordRead(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.READ,
      metadata,
    });
  }

  /**
   * Record delivery clicked
   */
  public async recordClicked(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    clickedUrl: string,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.CLICKED,
      metadata: {
        ...metadata,
        clickedUrl,
      },
    });
  }

  /**
   * Record delivery failed
   */
  public async recordFailed(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    errorCode: string,
    errorMessage: string,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.FAILED,
      metadata: {
        ...metadata,
        errorCode,
        errorMessage,
      },
    });
  }

  /**
   * Record delivery bounced
   */
  public async recordBounced(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.BOUNCED,
      metadata,
    });
  }

  /**
   * Record unsubscribe
   */
  public async recordUnsubscribed(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    metadata: DeliveryConfirmation["metadata"] = {}
  ): Promise<string> {
    return this.recordDelivery({
      notificationId,
      organizationId,
      channel,
      status: DeliveryConfirmationStatus.UNSUBSCRIBED,
      metadata,
    });
  }

  /**
   * Get delivery confirmations for a notification
   */
  public getConfirmationsForNotification(notificationId: string): DeliveryConfirmation[] {
    return Array.from(this.confirmations.values()).filter(
      (confirmation) => confirmation.notificationId === notificationId
    );
  }

  /**
   * Get delivery confirmations for an organization
   */
  public getConfirmationsForOrganization(
    organizationId: string,
    options: {
      channel?: DeliveryChannel;
      status?: DeliveryConfirmationStatus;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {}
  ): DeliveryConfirmation[] {
    let confirmations = Array.from(this.confirmations.values()).filter(
      (confirmation) => confirmation.organizationId === organizationId
    );

    // Apply filters
    if (options.channel) {
      confirmations = confirmations.filter((c) => c.channel === options.channel);
    }

    if (options.status) {
      confirmations = confirmations.filter((c) => c.status === options.status);
    }

    if (options.fromDate) {
      confirmations = confirmations.filter((c) => c.timestamp >= options.fromDate!);
    }

    if (options.toDate) {
      confirmations = confirmations.filter((c) => c.timestamp <= options.toDate!);
    }

    // Sort by timestamp (newest first)
    confirmations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (options.limit) {
      confirmations = confirmations.slice(0, options.limit);
    }

    return confirmations;
  }

  /**
   * Get delivery status for a notification
   */
  public getDeliveryStatus(notificationId: string): {
    sent: boolean;
    delivered: boolean;
    read: boolean;
    clicked: boolean;
    failed: boolean;
    bounced: boolean;
    unsubscribed: boolean;
    channels: Record<DeliveryChannel, DeliveryConfirmationStatus[]>;
  } {
    const confirmations = this.getConfirmationsForNotification(notificationId);

    const status = {
      sent: false,
      delivered: false,
      read: false,
      clicked: false,
      failed: false,
      bounced: false,
      unsubscribed: false,
      channels: {} as Record<DeliveryChannel, DeliveryConfirmationStatus[]>,
    };

    // Initialize channels
    Object.values(DeliveryChannel).forEach((channel) => {
      status.channels[channel] = [];
    });

    // Process confirmations
    confirmations.forEach((confirmation) => {
      status.channels[confirmation.channel].push(confirmation.status);

      switch (confirmation.status) {
        case DeliveryConfirmationStatus.SENT:
          status.sent = true;
          break;
        case DeliveryConfirmationStatus.DELIVERED:
          status.delivered = true;
          break;
        case DeliveryConfirmationStatus.READ:
          status.read = true;
          break;
        case DeliveryConfirmationStatus.CLICKED:
          status.clicked = true;
          break;
        case DeliveryConfirmationStatus.FAILED:
          status.failed = true;
          break;
        case DeliveryConfirmationStatus.BOUNCED:
          status.bounced = true;
          break;
        case DeliveryConfirmationStatus.UNSUBSCRIBED:
          status.unsubscribed = true;
          break;
      }
    });

    return status;
  }

  /**
   * Generate tracking pixel URL
   */
  public generateTrackingPixelUrl(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    userId?: string
  ): string {
    if (!this.config.enableReadTracking) {
      return "";
    }

    const params = new URLSearchParams({
      n: notificationId,
      o: organizationId,
      c: channel,
    });

    if (userId) {
      params.set("u", userId);
    }

    return `${this.config.trackingPixelUrl}?${params.toString()}`;
  }

  /**
   * Generate click tracking URL
   */
  public generateClickTrackingUrl(
    notificationId: string,
    organizationId: string,
    channel: DeliveryChannel,
    targetUrl: string,
    userId?: string
  ): string {
    if (!this.config.enableClickTracking) {
      return targetUrl;
    }

    const params = new URLSearchParams({
      n: notificationId,
      o: organizationId,
      c: channel,
      url: targetUrl,
    });

    if (userId) {
      params.set("u", userId);
    }

    return `${this.config.clickTrackingUrl}?${params.toString()}`;
  }

  /**
   * Process tracking pixel request
   */
  public async processTrackingPixel(params: {
    notificationId: string;
    organizationId: string;
    channel: DeliveryChannel;
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.recordRead(params.notificationId, params.organizationId, params.channel, {
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      readTime: Date.now(),
    });

    logger.debug("Tracking pixel processed", {
      notificationId: params.notificationId,
      channel: params.channel,
    });
  }

  /**
   * Process click tracking request
   */
  public async processClickTracking(params: {
    notificationId: string;
    organizationId: string;
    channel: DeliveryChannel;
    targetUrl: string;
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<string> {
    await this.recordClicked(
      params.notificationId,
      params.organizationId,
      params.channel,
      params.targetUrl,
      {
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
      }
    );

    logger.debug("Click tracking processed", {
      notificationId: params.notificationId,
      channel: params.channel,
      targetUrl: params.targetUrl,
    });

    return params.targetUrl;
  }

  /**
   * Update statistics
   */
  private updateStats(confirmation: DeliveryConfirmation): void {
    this.stats.totalDeliveries++;
    this.stats.deliveriesByChannel[confirmation.channel]++;
    this.stats.deliveriesByStatus[confirmation.status]++;

    // Calculate rates
    const total = this.stats.totalDeliveries;
    this.stats.deliveryRate =
      this.stats.deliveriesByStatus[DeliveryConfirmationStatus.DELIVERED] / total;
    this.stats.readRate = this.stats.deliveriesByStatus[DeliveryConfirmationStatus.READ] / total;
    this.stats.clickRate =
      this.stats.deliveriesByStatus[DeliveryConfirmationStatus.CLICKED] / total;
    this.stats.bounceRate =
      this.stats.deliveriesByStatus[DeliveryConfirmationStatus.BOUNCED] / total;
    this.stats.unsubscribeRate =
      this.stats.deliveriesByStatus[DeliveryConfirmationStatus.UNSUBSCRIBED] / total;
  }

  /**
   * Start batch processing for confirmations
   */
  private startBatchProcessing(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushPendingConfirmations();
    }, this.config.flushInterval);

    logger.info("Delivery confirmation batch processing started");
  }

  /**
   * Flush pending confirmations
   */
  private async flushPendingConfirmations(): Promise<void> {
    if (this.pendingConfirmations.length === 0) {
      return;
    }

    const batch = this.pendingConfirmations.splice(0, this.config.batchSize);

    try {
      // TODO: Implement actual persistence (database, analytics service, etc.)
      logger.debug("Flushing delivery confirmations batch", {
        batchSize: batch.length,
      });

      // Emit batch event for external processing
      this.emit("batch", batch);

      if (this.config.enableTracking) {
        metrics.histogram("delivery.confirmations.batch_size", batch.length);
      }
    } catch (error) {
      logger.error("Error flushing delivery confirmations:", error);

      // Put failed confirmations back in queue
      this.pendingConfirmations.unshift(...batch);
    }
  }

  /**
   * Generate unique confirmation ID
   */
  private generateConfirmationId(): string {
    return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get delivery statistics
   */
  public getStats(): DeliveryStats {
    return { ...this.stats };
  }

  /**
   * Get delivery analytics for organization
   */
  public getAnalytics(
    organizationId: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      groupBy?: "hour" | "day" | "week" | "month";
    } = {}
  ): {
    totalDeliveries: number;
    deliveryRate: number;
    readRate: number;
    clickRate: number;
    bounceRate: number;
    channelBreakdown: Record<DeliveryChannel, number>;
    timeSeriesData: Array<{
      timestamp: Date;
      sent: number;
      delivered: number;
      read: number;
      clicked: number;
      failed: number;
      bounced: number;
    }>;
  } {
    const confirmations = this.getConfirmationsForOrganization(organizationId, {
      fromDate: options.fromDate,
      toDate: options.toDate,
    });

    const analytics = {
      totalDeliveries: confirmations.length,
      deliveryRate: 0,
      readRate: 0,
      clickRate: 0,
      bounceRate: 0,
      channelBreakdown: {} as Record<DeliveryChannel, number>,
      timeSeriesData: [] as Array<{
        timestamp: Date;
        sent: number;
        delivered: number;
        read: number;
        clicked: number;
        failed: number;
        bounced: number;
      }>,
    };

    // Initialize channel breakdown
    Object.values(DeliveryChannel).forEach((channel) => {
      analytics.channelBreakdown[channel] = 0;
    });

    // Calculate metrics
    let delivered = 0;
    let read = 0;
    let clicked = 0;
    let bounced = 0;

    confirmations.forEach((confirmation) => {
      analytics.channelBreakdown[confirmation.channel]++;

      switch (confirmation.status) {
        case DeliveryConfirmationStatus.DELIVERED:
          delivered++;
          break;
        case DeliveryConfirmationStatus.READ:
          read++;
          break;
        case DeliveryConfirmationStatus.CLICKED:
          clicked++;
          break;
        case DeliveryConfirmationStatus.BOUNCED:
          bounced++;
          break;
      }
    });

    if (analytics.totalDeliveries > 0) {
      analytics.deliveryRate = delivered / analytics.totalDeliveries;
      analytics.readRate = read / analytics.totalDeliveries;
      analytics.clickRate = clicked / analytics.totalDeliveries;
      analytics.bounceRate = bounced / analytics.totalDeliveries;
    }

    // TODO: Implement time series data grouping
    // This would require more sophisticated date grouping logic

    return analytics;
  }

  /**
   * Clean up old confirmations
   */
  public cleanupOldConfirmations(): number {
    const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [id, confirmation] of this.confirmations.entries()) {
      if (confirmation.timestamp < cutoff) {
        this.confirmations.delete(id);
        cleaned++;
      }
    }

    logger.info("Cleaned up old delivery confirmations", { count: cleaned });
    return cleaned;
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    logger.info("Stopping delivery confirmation service");

    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining confirmations
    await this.flushPendingConfirmations();

    logger.info("Delivery confirmation service stopped");
  }
}

export default DeliveryConfirmationService;
