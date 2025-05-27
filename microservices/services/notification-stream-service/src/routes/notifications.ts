import { Router, Request, Response } from 'express';
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from '../utils/metrics';
import { 
  NotificationQueueService,
  NotificationPriority, 
  DeliveryChannel,
  QueuedNotification 
} from '../services/queue-service';
import { DeliveryConfirmationService } from '../services/delivery-service';
import { sseServer } from './sse';
import { createRateLimitMiddleware, RateLimitStrategy } from '../middleware/rate-limiter';

const logger = getContextLogger({ service: 'notification-routes' });

// Create router
const router = Router();

// Create service instances
const queueService = new NotificationQueueService();
const deliveryService = new DeliveryConfirmationService();

// Register processors with queue service
import { WebNotificationProcessor } from '../channels/web';
import { EmailNotificationProcessor } from '../channels/email';
import { PushNotificationProcessor } from '../channels/push';

// Initialize and register processors
const webProcessor = new WebNotificationProcessor({
  websocketPort: 3003,
  sseEndpoint: '/api/notifications/sse',
  enableWebSocket: true,
  enableSSE: true,
  rateLimits: { perSecond: 50, perMinute: 3000, perHour: 180000 },
  retryConfig: { maxRetries: 2, backoffMultiplier: 1.5, initialDelay: 500 },
});

const emailProcessor = new EmailNotificationProcessor({
  provider: 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY || 'test-api-key',
  fromEmail: process.env.FROM_EMAIL || 'notifications@example.com',
  fromName: process.env.FROM_NAME || 'Social Proof App',
  templates: {
    default: 'default-template',
    order: 'order-template',
    welcome: 'welcome-template',
    notification: 'notification-template',
  },
  rateLimits: { perSecond: 10, perMinute: 600, perHour: 36000 },
});

const pushProcessor = new PushNotificationProcessor({
  provider: 'firebase',
  serverKey: process.env.FIREBASE_SERVER_KEY || 'test-server-key',
  projectId: process.env.FIREBASE_PROJECT_ID || 'test-project',
  rateLimits: { perSecond: 20, perMinute: 1200, perHour: 72000 },
  retryConfig: { maxRetries: 3, backoffMultiplier: 2, initialDelay: 1000 },
});

// Register processors
queueService.registerProcessor(DeliveryChannel.WEB, webProcessor);
queueService.registerProcessor(DeliveryChannel.EMAIL, emailProcessor);
queueService.registerProcessor(DeliveryChannel.PUSH, pushProcessor);

logger.info('Notification processors registered with queue service');

// Rate limiting middleware for different endpoints
const rateLimitSend = createRateLimitMiddleware({
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  windowMs: 60000, // 1 minute
  maxRequests: 1000,
  keyGenerator: (req) => {
    const orgId = req.body?.organizationId || req.query.organizationId;
    return orgId ? `send:${orgId}` : `send:${req.ip}`;
  },
  message: 'Too many notification send requests',
});

const rateLimitBatch = createRateLimitMiddleware({
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => {
    const orgId = req.body?.organizationId || req.query.organizationId;
    return orgId ? `batch:${orgId}` : `batch:${req.ip}`;
  },
  message: 'Too many batch notification requests',
});

const rateLimitQuery = createRateLimitMiddleware({
  strategy: RateLimitStrategy.FIXED_WINDOW,
  windowMs: 60000, // 1 minute
  maxRequests: 500,
  keyGenerator: (req) => {
    const orgId = req.query.organizationId as string;
    return orgId ? `query:${orgId}` : `query:${req.ip}`;
  },
  message: 'Too many query requests',
});

/**
 * Send single notification
 * POST /notifications/send
 */
router.post('/send', rateLimitSend, async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      siteId,
      userId,
      sessionId,
      priority = NotificationPriority.NORMAL,
      channels = [DeliveryChannel.WEB],
      payload,
      targeting = {},
      scheduling = {},
      delivery = {},
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!organizationId) {
      return res.status(400).json({
        error: 'organizationId is required',
      });
    }

    if (!payload || !payload.message) {
      return res.status(400).json({
        error: 'payload.message is required',
      });
    }

    // Validate channels
    const validChannels = Object.values(DeliveryChannel);
    const invalidChannels = channels.filter((channel: string) => !validChannels.includes(channel as DeliveryChannel));
    if (invalidChannels.length > 0) {
      return res.status(400).json({
        error: `Invalid channels: ${invalidChannels.join(', ')}`,
      });
    }

    // Create notification
    const notification: Omit<QueuedNotification, 'id' | 'status' | 'attempts' | 'deliveredChannels' | 'failedChannels'> = {
      organizationId,
      siteId,
      userId,
      sessionId,
      priority,
      channels,
      payload: {
        type: payload.type || 'notification',
        title: payload.title,
        message: payload.message,
        data: payload.data,
        template: payload.template,
        templateData: payload.templateData,
      },
      targeting,
      scheduling: {
        sendAt: scheduling.sendAt ? new Date(scheduling.sendAt) : undefined,
        expiresAt: scheduling.expiresAt ? new Date(scheduling.expiresAt) : undefined,
        timezone: scheduling.timezone,
      },
      delivery: {
        maxRetries: delivery.maxRetries || 3,
        retryDelay: delivery.retryDelay || 5000,
        retryBackoff: delivery.retryBackoff || 2,
      },
      metadata: {
        ...metadata,
        source: metadata.source || 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    // Enqueue notification
    const notificationId = await queueService.enqueue(notification);

    logger.info('Notification enqueued', {
      notificationId,
      organizationId,
      channels,
      priority,
    });

    metrics.increment('notifications.sent', {
      organizationId,
      channels: channels.join(','),
      priority: NotificationPriority[priority],
    });

    res.status(201).json({
      success: true,
      notificationId,
      message: 'Notification queued for delivery',
    });

  } catch (error) {
    logger.error('Error sending notification:', error);
    metrics.increment('notifications.send_errors');
    
    res.status(500).json({
      error: 'Failed to send notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Send batch notifications
 * POST /notifications/batch
 */
router.post('/batch', rateLimitBatch, async (req: Request, res: Response) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        error: 'notifications array is required and must not be empty',
      });
    }

    if (notifications.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 notifications per batch',
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < notifications.length; i++) {
      try {
        const notification = notifications[i];
        
        // Validate required fields
        if (!notification.organizationId || !notification.payload?.message) {
          errors.push({
            index: i,
            error: 'organizationId and payload.message are required',
          });
          continue;
        }

        // Create notification object
        const notificationData: Omit<QueuedNotification, 'id' | 'status' | 'attempts' | 'deliveredChannels' | 'failedChannels'> = {
          organizationId: notification.organizationId,
          siteId: notification.siteId,
          userId: notification.userId,
          sessionId: notification.sessionId,
          priority: notification.priority || NotificationPriority.NORMAL,
          channels: notification.channels || [DeliveryChannel.WEB],
          payload: {
            type: notification.payload.type || 'notification',
            title: notification.payload.title,
            message: notification.payload.message,
            data: notification.payload.data,
            template: notification.payload.template,
            templateData: notification.payload.templateData,
          },
          targeting: notification.targeting || {},
          scheduling: {
            sendAt: notification.scheduling?.sendAt ? new Date(notification.scheduling.sendAt) : undefined,
            expiresAt: notification.scheduling?.expiresAt ? new Date(notification.scheduling.expiresAt) : undefined,
            timezone: notification.scheduling?.timezone,
          },
          delivery: {
            maxRetries: notification.delivery?.maxRetries || 3,
            retryDelay: notification.delivery?.retryDelay || 5000,
            retryBackoff: notification.delivery?.retryBackoff || 2,
          },
          metadata: {
            ...notification.metadata,
            source: notification.metadata?.source || 'batch-api',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };

        const notificationId = await queueService.enqueue(notificationData);
        
        results.push({
          index: i,
          notificationId,
          success: true,
        });

      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Batch notifications processed', {
      total: notifications.length,
      successful: results.length,
      failed: errors.length,
    });

    metrics.histogram('notifications.batch_size', notifications.length);
    metrics.histogram('notifications.batch_success', results.length);
    metrics.histogram('notifications.batch_errors', errors.length);

    res.status(201).json({
      success: true,
      total: notifications.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    });

  } catch (error) {
    logger.error('Error processing batch notifications:', error);
    metrics.increment('notifications.batch_errors');
    
    res.status(500).json({
      error: 'Failed to process batch notifications',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get notification status
 * GET /notifications/:id/status
 */
router.get('/:id/status', rateLimitQuery, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const notification = queueService.getNotification(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
      });
    }

    const deliveryStatus = deliveryService.getDeliveryStatus(id);
    const confirmations = deliveryService.getConfirmationsForNotification(id);

    res.json({
      id: notification.id,
      status: notification.status,
      attempts: notification.attempts,
      lastAttempt: notification.lastAttempt,
      lastError: notification.lastError,
      deliveredChannels: notification.deliveredChannels,
      failedChannels: notification.failedChannels,
      deliveryStatus,
      confirmations: confirmations.map(conf => ({
        id: conf.id,
        channel: conf.channel,
        status: conf.status,
        timestamp: conf.timestamp,
        metadata: conf.metadata,
      })),
    });

  } catch (error) {
    logger.error('Error getting notification status:', error);
    
    res.status(500).json({
      error: 'Failed to get notification status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get notifications for organization
 * GET /notifications?organizationId=xxx
 */
router.get('/', rateLimitQuery, async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      status,
      channel,
      fromDate,
      toDate,
      limit = 50,
      offset = 0
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'organizationId is required',
      });
    }

    // Get notifications by status if specified
    let notifications: QueuedNotification[] = [];
    
    if (status) {
      notifications = queueService.getNotificationsByStatus(status as any);
      // Filter by organization
      notifications = notifications.filter(n => n.organizationId === organizationId);
    } else {
      // Get all notifications for organization (this would need a proper implementation)
      // For now, we'll get from all statuses
      const allStatuses = ['pending', 'processing', 'delivered', 'failed', 'retrying', 'expired'];
      for (const s of allStatuses) {
        const statusNotifications = queueService.getNotificationsByStatus(s as any);
        notifications.push(...statusNotifications.filter(n => n.organizationId === organizationId));
      }
    }

    // Apply filters
    if (channel) {
      notifications = notifications.filter(n => 
        n.channels.includes(channel as DeliveryChannel)
      );
    }

    if (fromDate) {
      const from = new Date(fromDate as string);
      notifications = notifications.filter(n => 
        n.metadata.createdAt >= from
      );
    }

    if (toDate) {
      const to = new Date(toDate as string);
      notifications = notifications.filter(n => 
        n.metadata.createdAt <= to
      );
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => 
      b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
    );

    // Apply pagination
    const total = notifications.length;
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const paginatedNotifications = notifications.slice(offsetNum, offsetNum + limitNum);

    res.json({
      notifications: paginatedNotifications.map(n => ({
        id: n.id,
        organizationId: n.organizationId,
        siteId: n.siteId,
        userId: n.userId,
        priority: n.priority,
        channels: n.channels,
        payload: n.payload,
        status: n.status,
        attempts: n.attempts,
        lastAttempt: n.lastAttempt,
        lastError: n.lastError,
        deliveredChannels: n.deliveredChannels,
        failedChannels: n.failedChannels,
        createdAt: n.metadata.createdAt,
        updatedAt: n.metadata.updatedAt,
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });

  } catch (error) {
    logger.error('Error getting notifications:', error);
    
    res.status(500).json({
      error: 'Failed to get notifications',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Cancel notification
 * DELETE /notifications/:id
 */
router.delete('/:id', rateLimitQuery, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const success = queueService.cancelNotification(id);
    
    if (success) {
      logger.info('Notification cancelled', { id });
      metrics.increment('notifications.cancelled');
      
      res.json({
        success: true,
        message: 'Notification cancelled',
      });
    } else {
      res.status(404).json({
        error: 'Notification not found or cannot be cancelled',
      });
    }

  } catch (error) {
    logger.error('Error cancelling notification:', error);
    
    res.status(500).json({
      error: 'Failed to cancel notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get queue statistics
 * GET /notifications/stats/queue
 */
router.get('/stats/queue', rateLimitQuery, async (req: Request, res: Response) => {
  try {
    const stats = queueService.getStats();
    
    res.json({
      queue: stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Error getting queue stats:', error);
    
    res.status(500).json({
      error: 'Failed to get queue statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get delivery statistics
 * GET /notifications/stats/delivery
 */
router.get('/stats/delivery', rateLimitQuery, async (req: Request, res: Response) => {
  try {
    const { organizationId, fromDate, toDate } = req.query;
    
    if (organizationId) {
      const analytics = deliveryService.getAnalytics(organizationId as string, {
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
      });
      
      res.json({
        delivery: analytics,
        timestamp: new Date().toISOString(),
      });
    } else {
      const stats = deliveryService.getStats();
      
      res.json({
        delivery: stats,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    logger.error('Error getting delivery stats:', error);
    
    res.status(500).json({
      error: 'Failed to get delivery statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Send real-time notification via WebSocket/SSE
 * POST /notifications/realtime
 */
router.post('/realtime', rateLimitSend, async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      siteId,
      userId,
      channel = 'web',
      message,
      data = {}
    } = req.body;

    if (!organizationId || !message) {
      return res.status(400).json({
        error: 'organizationId and message are required',
      });
    }

    const notification = {
      id: `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event: 'notification',
      data: {
        type: 'realtime',
        message,
        data,
        timestamp: new Date().toISOString(),
      },
    };

    let sentCount = 0;

    // Send via SSE
    if (siteId) {
      sentCount += sseServer.sendToSite(siteId, notification);
    } else if (userId) {
      sentCount += sseServer.sendToUser(userId, notification);
    } else {
      sentCount += sseServer.sendToOrganization(organizationId, notification);
    }

    // Record delivery confirmation
    await deliveryService.recordSent(
      notification.id,
      organizationId,
      DeliveryChannel.WEB,
      {
        provider: 'sse',
      }
    );

    logger.info('Real-time notification sent', {
      notificationId: notification.id,
      organizationId,
      siteId,
      userId,
      sentCount,
    });

    metrics.increment('notifications.realtime.sent', {
      organizationId,
      channel,
    });

    res.json({
      success: true,
      notificationId: notification.id,
      sentCount,
      message: `Real-time notification sent to ${sentCount} connections`,
    });

  } catch (error) {
    logger.error('Error sending real-time notification:', error);
    metrics.increment('notifications.realtime.errors');
    
    res.status(500).json({
      error: 'Failed to send real-time notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Health check endpoint
 * GET /notifications/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const queueStats = queueService.getStats();
    const deliveryStats = deliveryService.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        queue: {
          status: 'healthy',
          pendingNotifications: queueStats.pendingNotifications,
          processingNotifications: queueStats.processingNotifications,
        },
        delivery: {
          status: 'healthy',
          totalDeliveries: deliveryStats.totalDeliveries,
          deliveryRate: deliveryStats.deliveryRate,
        },
        sse: {
          status: 'healthy',
          activeConnections: sseServer.getStats().totalConnections,
        },
      },
    };

    res.json(health);

  } catch (error) {
    logger.error('Health check error:', error);
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as notificationRouter };
export default router; 