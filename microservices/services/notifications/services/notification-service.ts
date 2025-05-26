import { getContextLogger } from "@social-proof/shared";

const logger = getContextLogger({ service: "notification-service" });

/**
 * Notification data structure - matches input format
 */
export interface NotificationData {
  type: string;
  shopDomain: string;
  siteId?: string;
  title: string;
  message: string;
  data?: any;
}

/**
 * Notification content structure - matches embed script expectations
 */
export interface NotificationContent {
  title?: string;
  message?: string;
  image?: string;
  url?: string;
  html?: string;
}

/**
 * Notification database/output structure - formatted for embed script
 */
export interface Notification {
  id: string;
  type: string;
  content: NotificationContent;
  createdAt: string;
  displayedAt?: string;
  clickedAt?: string;
  dismissedAt?: string;
  // Keep original data for reference
  shopDomain: string;
  siteId?: string;
  data?: any;
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
   * @returns Created notification formatted for embed script
   */
  async createNotification(data: NotificationData): Promise<Notification> {
    try {
      // Generate unique ID
      const id = this.generateId();

      // Transform to embed script format
      const notification: Notification = {
        id,
        type: this.normalizeTypeForEmbed(data.type),
        content: {
          title: data.title,
          message: data.message,
          // Extract image from product data if available
          image: this.extractProductImage(data.data),
          // Generate shop URL if available
          url: this.generateShopUrl(data.shopDomain, data.data),
        },
        createdAt: new Date().toISOString(),
        // Keep original data for reference
        shopDomain: data.shopDomain,
        siteId: data.siteId,
        data: data.data,
      };

      // Store notification (in a real implementation, this would be a DB write)
      this.notifications.set(id, notification);

      logger.info(`Created notification: ${id} for site: ${data.siteId || data.shopDomain}`);
      return notification;
    } catch (error: any) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Normalize notification type for embed script CSS classes
   * @param type - Original notification type
   * @returns Normalized type for CSS classes
   */
  private normalizeTypeForEmbed(type: string): string {
    switch (type) {
      case "order.created":
        return "order";
      case "order.completed":
      case "order.fulfilled":
        return "success";
      default:
        return "default";
    }
  }

  /**
   * Extract product image from notification data
   * @param data - Notification data
   * @returns Product image URL or undefined
   */
  private extractProductImage(data: any): string | undefined {
    if (data?.products && Array.isArray(data.products) && data.products.length > 0) {
      // Look for image in first product
      const firstProduct = data.products[0];
      if (firstProduct.image) {
        return firstProduct.image;
      }
    }
    return undefined;
  }

  /**
   * Generate shop URL for notification click action
   * @param shopDomain - Shop domain
   * @param data - Notification data
   * @returns Shop URL or undefined
   */
  private generateShopUrl(shopDomain: string, data: any): string | undefined {
    if (shopDomain && data?.products && Array.isArray(data.products) && data.products.length > 0) {
      const firstProduct = data.products[0];
      if (firstProduct.id) {
        // Generate product URL
        return `https://${shopDomain}/products/${firstProduct.id}`;
      }
      // Fallback to shop homepage
      return `https://${shopDomain}`;
    }
    return undefined;
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
   * Get notifications for a site (updated to use siteId)
   * @param siteId - Site ID
   * @param limit - Max number of notifications to return
   * @returns List of notifications
   */
  async getNotificationsForSite(siteId: string, limit: number = 10): Promise<Notification[]> {
    // Filter notifications by site ID and sort by creation date (descending)
    const siteNotifications = Array.from(this.notifications.values())
      .filter((notification) => notification.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return siteNotifications;
  }

  /**
   * Get notifications for a shop (legacy method for backward compatibility)
   * @param shopDomain - Shop domain
   * @param limit - Max number of notifications to return
   * @returns List of notifications
   */
  async getNotificationsForShop(shopDomain: string, limit: number = 10): Promise<Notification[]> {
    // Filter notifications by shop domain and sort by creation date (descending)
    const shopNotifications = Array.from(this.notifications.values())
      .filter((notification) => notification.shopDomain === shopDomain)
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
