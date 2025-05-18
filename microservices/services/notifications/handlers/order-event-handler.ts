import { RedisPublisher } from "../../../shared/redis/publisher";
import { NotificationService } from "../services/notification-service";
import { getContextLogger } from "../../../shared/utils/logger";

const logger = getContextLogger({ service: "order-event-handler" });

/**
 * Handler for processing order events from Kafka
 */
export class OrderEventHandler {
  /**
   * Create a new order event handler
   * @param redisPublisher - Redis publisher for sending notifications
   * @param notificationService - Service for creating/storing notifications
   */
  constructor(
    private redisPublisher: RedisPublisher,
    private notificationService: NotificationService
  ) {}

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
      const { shop_domain, data } = message;

      if (!shop_domain || !data) {
        logger.warn("Invalid message format: missing shop_domain or data");
        return;
      }

      // Create a notification for this order
      const notification = await this.notificationService.createNotification({
        type: "order.created",
        shopDomain: shop_domain,
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

      // Publish the notification to Redis
      const channel = `notifications:${shop_domain}`;
      await this.redisPublisher.publish(channel, JSON.stringify(notification));

      logger.info(`Published order.created notification to ${channel}`);
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

    // If multiple products, mention the first one and the count
    if (orderData.products && orderData.products.length > 1) {
      const firstProduct = orderData.products[0].title;
      return `${customerName} just purchased ${firstProduct} and ${orderData.products.length - 1} other item(s)`;
    }

    // Single product
    if (orderData.products && orderData.products.length === 1) {
      return `${customerName} just purchased ${orderData.products[0].title}`;
    }

    // Fallback if no product info
    return `${customerName} just placed an order`;
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
   * Extract product information for the notification
   * @param products - The product data from the order
   * @returns Simplified product information
   */
  private extractProductInfo(products: any[]): { id: string; title: string; price: string }[] {
    if (!products || !Array.isArray(products)) {
      return [];
    }

    return products.map((product) => ({
      id: product.id?.toString() || "",
      title: product.title || "Product",
      price: product.price?.toString() || "0",
    }));
  }
}

export default OrderEventHandler;
