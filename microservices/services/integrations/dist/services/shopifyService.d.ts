import { ShopifyStore, ShopifyWebhook } from "../models/shopify";
/**
 * Topics available for webhook subscription
 */
export declare const SHOPIFY_WEBHOOK_TOPICS: {
  ORDERS_CREATE: string;
  ORDERS_UPDATED: string;
  ORDERS_PAID: string;
  PRODUCTS_CREATE: string;
  PRODUCTS_UPDATE: string;
  APP_UNINSTALLED: string;
};
/**
 * Service for handling Shopify integration operations
 */
export declare class ShopifyService {
  /**
   * Register webhooks with a Shopify store via API
   * @param shopifyStore Shopify store details
   * @param webhookUrl Base webhook URL
   * @param topics List of topics to subscribe to
   */
  static registerWebhooks(
    shopifyStore: ShopifyStore,
    webhookUrl: string,
    topics?: string[]
  ): Promise<ShopifyWebhook[]>;
  /**
   * Verify Shopify webhook HMAC signature
   * @param hmac HMAC signature from headers
   * @param body Raw request body
   * @param shopifySecret Shopify webhook secret
   * @returns Whether signature is valid
   */
  static verifyWebhookSignature(hmac: string, body: string, shopifySecret: string): boolean;
  /**
   * Process Shopify order webhook and send to Kafka
   * @param shopDomain Shopify store domain
   * @param orderData Order data from webhook
   */
  static processOrderWebhook(shopDomain: string, orderData: any): Promise<void>;
  /**
   * Transform Shopify order data to standardized format
   * @param orderData Shopify order data
   * @param shopifyStore Shopify store details
   * @returns Standardized order event
   */
  static transformOrderData(orderData: any, shopifyStore: ShopifyStore): any;
  /**
   * Process app uninstalled webhook
   * @param shopDomain Shopify store domain
   */
  static processAppUninstalledWebhook(shopDomain: string): Promise<void>;
  /**
   * Create script tag for notifications
   * @param shopifyStore Shopify store
   * @param scriptUrl URL to the notification script
   */
  static createScriptTag(shopifyStore: ShopifyStore, scriptUrl: string): Promise<any>;
}
