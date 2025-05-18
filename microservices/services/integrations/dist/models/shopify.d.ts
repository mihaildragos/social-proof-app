export interface ShopifyStore {
  id: string;
  site_id: string;
  shop_domain: string;
  access_token?: string;
  scope?: string;
  installed_at?: Date;
  uninstalled_at?: Date;
  status: "active" | "inactive" | "error";
  error_message?: string;
  settings?: ShopifySettings;
  created_at?: Date;
  updated_at?: Date;
}
export interface ShopifySettings {
  display_notifications: boolean;
  notification_position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  notification_delay?: number;
  notification_types?: string[];
  excluded_products?: string[];
  excluded_collections?: string[];
  custom_css?: string;
  [key: string]: any;
}
export interface ShopifyWebhook {
  id: string;
  store_id: string;
  topic: string;
  address: string;
  format: "json" | "xml";
  created_at?: Date;
}
/**
 * ShopifyIntegration model class
 */
export declare class ShopifyIntegration {
  /**
   * Find a Shopify store by domain
   * @param domain Shopify store domain
   * @returns ShopifyStore or null if not found
   */
  static findByDomain(domain: string): Promise<ShopifyStore | null>;
  /**
   * Create a new Shopify store integration
   * @param storeData ShopifyStore data
   * @returns Created ShopifyStore or null if creation failed
   */
  static create(storeData: Partial<ShopifyStore>): Promise<ShopifyStore | null>;
  /**
   * Update an existing Shopify store integration
   * @param id Shopify integration ID
   * @param updateData Data to update
   * @returns Updated ShopifyStore or null if update failed
   */
  static update(id: string, updateData: Partial<ShopifyStore>): Promise<ShopifyStore | null>;
  /**
   * Register a webhook with a Shopify store
   * @param storeId Shopify integration ID
   * @param topic Webhook topic (e.g., orders/create)
   * @param address Webhook callback URL
   * @returns Created webhook or null if registration failed
   */
  static registerWebhook(
    storeId: string,
    topic: string,
    address: string
  ): Promise<ShopifyWebhook | null>;
}
