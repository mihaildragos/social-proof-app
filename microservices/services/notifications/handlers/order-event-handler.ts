import { RedisPublisher } from "../../../shared/redis/publisher";
import { NotificationService } from "../services/notification-service";
import { getContextLogger } from "../../../shared/utils/logger";
import { Pool } from "pg";

const logger = getContextLogger({ service: "order-event-handler" });

/**
 * Handler for processing order events from Kafka
 */
export class OrderEventHandler {
  private dbPool: Pool;

  /**
   * Create a new order event handler
   * @param redisPublisher - Redis publisher for sending notifications
   * @param notificationService - Service for creating/storing notifications
   */
  constructor(
    private redisPublisher: RedisPublisher,
    private notificationService: NotificationService
  ) {
    // Initialize database connection pool
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/social_proof_mvp"
    });
  }

  /**
   * Get site ID from shop domain using integrations table
   * @param shopDomain - The Shopify shop domain
   * @returns Site ID or null if not found
   */
  private async getSiteIdByShopDomain(shopDomain: string): Promise<string | null> {
    try {
      const query = `
        SELECT i.site_id 
        FROM integrations i 
        WHERE i.provider = 'shopify' 
        AND i.settings->>'shop_domain' = $1 
        AND i.status = 'active'
        LIMIT 1
      `;
      
      const result = await this.dbPool.query(query, [shopDomain]);
      
      if (result.rows.length > 0) {
        return result.rows[0].site_id;
      }
      
      logger.warn(`No active Shopify integration found for shop domain: ${shopDomain}`);
      return null;
    } catch (error: any) {
      logger.error(`Error looking up site ID for shop domain ${shopDomain}:`, error);
      return null;
    }
  }

  /**
   * Main message handler that routes to specific event type handlers
   * @param message - The message to process
   */
  async handleMessage(message: any): Promise<void> {
    try {
      logger.info(`Processing message: ${message.event_type}`);

      // Route to the appropriate handler based on event type
      switch (message.event_type) {
        case "order.created":
          return await this.handleOrderCreated(message);
        case "order.cancelled":
          return await this.handleOrderCancelled(message);
        case "order.fulfilled":
          return await this.handleOrderFulfilled(message);
        default:
          logger.warn(`Unknown event type: ${message.event_type}`);
      }
    } catch (error: any) {
      logger.error(`Error handling message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Handle order.created events
   * @param message - The order.created message
   */
  async handleOrderCreated(message: any): Promise<void> {
    try {
      const { shop_domain, data, site_id } = message;

      if (!shop_domain || !data) {
        logger.warn("Invalid message format: missing shop_domain or data");
        return;
      }

      // Get site_id from message or lookup by shop_domain
      let resolvedSiteId = site_id;
      if (!resolvedSiteId) {
        resolvedSiteId = await this.getSiteIdByShopDomain(shop_domain);
        if (!resolvedSiteId) {
          logger.error(`Cannot resolve site_id for shop_domain: ${shop_domain}`);
          return;
        }
      }

      // Create a notification for this order
      const notification = await this.notificationService.createNotification({
        type: "order.created",
        shopDomain: shop_domain,
        siteId: resolvedSiteId,
        title: "New Order",
        message: this.generateOrderMessage(data),
        data: {
          orderId: data.order_id,
          customerName: this.getCustomerName(data.customer),
          products: this.extractProductInfo(data.products),
          total: data.total,
          currency: data.currency,
        },
      });

      // Publish the notification to Redis using site_id format to match SSE endpoint
      const channel = `notifications:site:${resolvedSiteId}`;
      await this.redisPublisher.publish(channel, JSON.stringify(notification));

      logger.info(`Published order.created notification to ${channel} for shop_domain: ${shop_domain}`);
    } catch (error: any) {
      logger.error("Error handling order.created event:", error);
      throw error;
    }
  }

  /**
   * Handle order.cancelled events
   * @param message - The order.cancelled message
   */
  async handleOrderCancelled(message: any): Promise<void> {
    // Similar implementation to handleOrderCreated
    logger.info("Order cancelled event received");
    // Not implemented for MVP
  }

  /**
   * Handle order.fulfilled events
   * @param message - The order.fulfilled message
   */
  async handleOrderFulfilled(message: any): Promise<void> {
    // Similar implementation to handleOrderCreated
    logger.info("Order fulfilled event received");
    // Not implemented for MVP
  }

  /**
   * Generate a human-readable message for the notification
   * @param orderData - The order data
   * @returns A formatted message string
   */
  private generateOrderMessage(orderData: any): string {
    const customerName = this.getCustomerName(orderData.customer);
    const location = this.getCustomerLocation(orderData.customer);

    // If multiple products, mention the first one and the count
    if (orderData.products && orderData.products.length > 1) {
      const firstProduct = orderData.products[0].title;
      return `${customerName}${location} just purchased ${firstProduct} and ${orderData.products.length - 1} other item(s)`;
    }

    // Single product
    if (orderData.products && orderData.products.length === 1) {
      return `${customerName}${location} just purchased ${orderData.products[0].title}`;
    }

    // Fallback if no product info
    return `${customerName}${location} just placed an order`;
  }

  /**
   * Extract the customer's name from the customer data
   * @param customer - The customer data
   * @returns The formatted customer name
   */
  private getCustomerName(customer: any): string {
    if (!customer) return "Someone";

    // Use first name if available
    if (customer.first_name) {
      return customer.first_name;
    }

    // Use email with domain removed as fallback
    if (customer.email) {
      return customer.email.split("@")[0];
    }

    // Final fallback
    return "Someone";
  }

  /**
   * Get customer location for more engaging notifications
   * @param customer - The customer data
   * @returns Formatted location string or empty string
   */
  private getCustomerLocation(customer: any): string {
    // Check for location in customer data
    if (customer?.location) {
      return ` from ${customer.location}`;
    }
    
    // Check for shipping address
    if (customer?.shipping_address) {
      const address = customer.shipping_address;
      if (address.city && address.country) {
        return ` from ${address.city}, ${address.country}`;
      }
      if (address.city) {
        return ` from ${address.city}`;
      }
      if (address.country) {
        return ` from ${address.country}`;
      }
    }
    
    // Check for billing address as fallback
    if (customer?.billing_address) {
      const address = customer.billing_address;
      if (address.city && address.country) {
        return ` from ${address.city}, ${address.country}`;
      }
      if (address.city) {
        return ` from ${address.city}`;
      }
    }
    
    return "";
  }

  /**
   * Extract product information for the notification
   * @param products - The product data from the order
   * @returns Simplified product information with image URLs
   */
  private extractProductInfo(products: any[]): { id: string; title: string; price: string; image?: string }[] {
    if (!products || !Array.isArray(products)) {
      return [];
    }

    return products.map((product) => ({
      id: product.id?.toString() || "",
      title: product.title || "Product",
      price: product.price?.toString() || "0",
      // Include image URL if available
      image: product.image || product.featured_image || undefined,
    }));
  }
}

export default OrderEventHandler;
