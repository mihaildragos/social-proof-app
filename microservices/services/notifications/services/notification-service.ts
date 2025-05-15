import { getContextLogger } from '../../../shared/utils/logger';

const logger = getContextLogger({ service: 'notification-service' });

/**
 * Notification data structure
 */
export interface NotificationData {
  type: string;
  shopDomain: string;
  title: string;
  message: string;
  data?: any;
}

/**
 * Notification database structure
 */
export interface Notification extends NotificationData {
  id: string;
  createdAt: string;
  displayedAt?: string;
  clickedAt?: string;
  dismissedAt?: string;
}

/**
 * Service for managing notifications
 */
export class NotificationService {
  // In a real implementation, this would use a database
  private notifications: Map<string, Notification> = new Map();

  /**
   * Create a new notification
   * @param data - Notification data
   * @returns Created notification
   */
  async createNotification(data: NotificationData): Promise<Notification> {
    try {
      // Generate unique ID
      const id = this.generateId();
      
      // Create notification object
      const notification: Notification = {
        id,
        ...data,
        createdAt: new Date().toISOString()
      };
      
      // Store notification (in a real implementation, this would be a DB write)
      this.notifications.set(id, notification);
      
      logger.info(`Created notification: ${id} for shop: ${data.shopDomain}`);
      return notification;
    } catch (error: any) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get a notification by ID
   * @param id - Notification ID
   * @returns Notification or undefined if not found
   */
  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  /**
   * Get notifications for a shop
   * @param shopDomain - Shop domain
   * @param limit - Max number of notifications to return
   * @returns List of notifications
   */
  async getNotificationsForShop(shopDomain: string, limit: number = 10): Promise<Notification[]> {
    // Filter notifications by shop domain and sort by creation date (descending)
    const shopNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.shopDomain === shopDomain)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    
    return shopNotifications;
  }

  /**
   * Mark a notification as displayed
   * @param id - Notification ID
   */
  async markAsDisplayed(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.displayedAt = new Date().toISOString();
      this.notifications.set(id, notification);
      logger.info(`Marked notification ${id} as displayed`);
    }
  }

  /**
   * Mark a notification as clicked
   * @param id - Notification ID
   */
  async markAsClicked(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.clickedAt = new Date().toISOString();
      this.notifications.set(id, notification);
      logger.info(`Marked notification ${id} as clicked`);
    }
  }

  /**
   * Mark a notification as dismissed
   * @param id - Notification ID
   */
  async markAsDismissed(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.dismissedAt = new Date().toISOString();
      this.notifications.set(id, notification);
      logger.info(`Marked notification ${id} as dismissed`);
    }
  }

  /**
   * Generate a unique ID for a notification
   * @returns Unique ID string
   */
  private generateId(): string {
    // Simple ID generation for demo purposes
    // In production, use a proper UUID library
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}

export default NotificationService; 