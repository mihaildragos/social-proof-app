import * as crypto from "crypto";
import { ShopifyIntegration, ShopifyStore, ShopifyWebhook } from "../models/shopify";
import { kafkaProducer } from "../utils/kafka";
import { logger } from "@social-proof/shared";

/**
 * Shopify API endpoints
 */
const SHOPIFY_API_VERSION = "2023-10";
const SHOPIFY_ADMIN_API_URL = (shopDomain: string) =>
  `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;

/**
 * Topics available for webhook subscription
 */
export const SHOPIFY_WEBHOOK_TOPICS = {
  ORDERS_CREATE: "orders/create",
  ORDERS_UPDATED: "orders/updated",
  ORDERS_PAID: "orders/paid",
  PRODUCTS_CREATE: "products/create",
  PRODUCTS_UPDATE: "products/update",
  APP_UNINSTALLED: "app/uninstalled",
};

/**
 * Service for handling Shopify integration operations
 */
export class ShopifyService {
  /**
   * Generate OAuth authorization URL for Shopify
   * @param shop Shop domain
   * @param scopes Optional scopes array
   * @returns Authorization URL
   */
  async generateAuthUrl(shop: string, scopes?: string[]): Promise<string> {
    const defaultScopes = ['read_orders', 'read_products', 'write_script_tags'];
    const requestedScopes = scopes || defaultScopes;
    const scopeString = requestedScopes.join(',');
    
    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY || '',
      scope: scopeString,
      redirect_uri: `${process.env.API_BASE_URL}/api/integrations/shopify/callback`,
      state: crypto.randomBytes(16).toString('hex'),
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Validate Shopify connection and get shop info
   * @param shop Shop domain
   * @param accessToken Access token
   * @returns Shop information
   */
  async validateConnection(shop: string, accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${SHOPIFY_ADMIN_API_URL(shop)}/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.shop;
    } catch (error) {
      logger.error('Failed to validate Shopify connection', { shop, error });
      throw error;
    }
  }

  /**
   * Setup webhooks for a Shopify store
   * @param shop Shop domain
   * @param accessToken Access token
   */
  async setupWebhooks(shop: string, accessToken: string): Promise<void> {
    const webhookUrl = `${process.env.API_BASE_URL}/api/integrations/webhooks/shopify`;
    const topics = [
      SHOPIFY_WEBHOOK_TOPICS.ORDERS_CREATE,
      SHOPIFY_WEBHOOK_TOPICS.ORDERS_UPDATED,
      SHOPIFY_WEBHOOK_TOPICS.APP_UNINSTALLED,
    ];

    try {
      for (const topic of topics) {
        const response = await fetch(`${SHOPIFY_ADMIN_API_URL(shop)}/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: `${webhookUrl}/${topic.replace('/', '-')}`,
              format: 'json',
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.warn(`Failed to create webhook for ${topic}`, { shop, error: errorData });
        } else {
          logger.info(`Created webhook for ${topic}`, { shop });
        }
      }
    } catch (error) {
      logger.error('Failed to setup webhooks', { shop, error });
      throw error;
    }
  }

  /**
   * Exchange OAuth code for access token
   * @param shop Shop domain
   * @param code OAuth code
   * @returns Token data
   */
  async exchangeCodeForToken(shop: string, code: string): Promise<any> {
    try {
      const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as any;
    } catch (error) {
      logger.error('Failed to exchange code for token', { shop, error });
      throw error;
    }
  }

  /**
   * Get store information
   * @param shop Shop domain
   * @param accessToken Access token
   * @returns Store information
   */
  async getStoreInfo(shop: string, accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${SHOPIFY_ADMIN_API_URL(shop)}/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get store info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.shop;
    } catch (error) {
      logger.error('Failed to get store info', { shop, error });
      throw error;
    }
  }

  /**
   * Sync store data
   * @param shop Shop domain
   * @param accessToken Access token
   * @param userId User ID
   */
  async syncStoreData(shop: string, accessToken: string, userId: string): Promise<void> {
    try {
      // Get recent orders
      const ordersResponse = await fetch(`${SHOPIFY_ADMIN_API_URL(shop)}/orders.json?limit=50&status=any`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json() as any;
        logger.info(`Synced ${ordersData.orders?.length || 0} orders`, { shop, userId });
      }

      // Get products
      const productsResponse = await fetch(`${SHOPIFY_ADMIN_API_URL(shop)}/products.json?limit=50`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json() as any;
        logger.info(`Synced ${productsData.products?.length || 0} products`, { shop, userId });
      }

      logger.info('Store data sync completed', { shop, userId });
    } catch (error) {
      logger.error('Failed to sync store data', { shop, userId, error });
      throw error;
    }
  }
  /**
   * Register webhooks with a Shopify store via API
   * @param shopifyStore Shopify store details
   * @param webhookUrl Base webhook URL
   * @param topics List of topics to subscribe to
   */
  static async registerWebhooks(
    shopifyStore: ShopifyStore,
    webhookUrl: string,
    topics: string[] = [SHOPIFY_WEBHOOK_TOPICS.ORDERS_CREATE]
  ): Promise<ShopifyWebhook[]> {
    if (!shopifyStore.access_token) {
      throw new Error("Shopify access token not available");
    }

    const registeredWebhooks: ShopifyWebhook[] = [];

    try {
      for (const topic of topics) {
        // Create a unique endpoint for each topic
        const topicEndpoint = `${webhookUrl}/${topic.replace("/", "-")}`;

        // Register webhook with Shopify API
        const response = await fetch(
          `${SHOPIFY_ADMIN_API_URL(shopifyStore.shop_domain)}/webhooks.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": shopifyStore.access_token,
            },
            body: JSON.stringify({
              webhook: {
                topic,
                address: topicEndpoint,
                format: "json",
              },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Shopify webhook registration failed: ${JSON.stringify(errorData)}`);
        }

        const webhookData = await response.json() as any;

        // Save webhook in our database
        const savedWebhook = await ShopifyIntegration.registerWebhook(
          shopifyStore.id,
          topic,
          topicEndpoint
        );

        if (savedWebhook) {
          registeredWebhooks.push(savedWebhook);
          logger.info(`Registered webhook for ${topic}`, {
            storeId: shopifyStore.id,
            shopDomain: shopifyStore.shop_domain,
            topic,
          });
        }
      }

      return registeredWebhooks;
    } catch (error) {
      logger.error("Error registering Shopify webhooks", {
        error,
        storeId: shopifyStore.id,
        shopDomain: shopifyStore.shop_domain,
      });
      throw error;
    }
  }

  /**
   * Verify Shopify webhook HMAC signature
   * @param hmac HMAC signature from headers
   * @param body Raw request body
   * @param shopifySecret Shopify webhook secret
   * @returns Whether signature is valid
   */
  static verifyWebhookSignature(hmac: string, body: string, shopifySecret: string): boolean {
    const generatedHash = crypto
      .createHmac("sha256", shopifySecret)
      .update(body, "utf8")
      .digest("base64");

    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac));
  }

  /**
   * Process Shopify order webhook and send to Kafka
   * @param shopDomain Shopify store domain
   * @param orderData Order data from webhook
   */
  static async processOrderWebhook(shopDomain: string, orderData: any): Promise<void> {
    try {
      // Find the Shopify store
      const shopifyStore = await ShopifyIntegration.findByDomain(shopDomain);

      if (!shopifyStore) {
        throw new Error(`Shopify store not found: ${shopDomain}`);
      }

      // Transform order data to standardized format
      const transformedOrder = this.transformOrderData(orderData, shopifyStore);

      // Send to Kafka
      await kafkaProducer.sendMessage(
        "events.orders",
        transformedOrder,
        `${shopifyStore.site_id}-${orderData.id}`
      );

      logger.info("Processed Shopify order event", {
        shopDomain,
        orderId: orderData.id,
        kafkaTopic: "events.orders",
      });
    } catch (error) {
      logger.error("Error processing Shopify order webhook", { error, shopDomain });
      throw error;
    }
  }

  /**
   * Transform Shopify order data to standardized format
   * @param orderData Shopify order data
   * @param shopifyStore Shopify store details
   * @returns Standardized order event
   */
  static transformOrderData(orderData: any, shopifyStore: ShopifyStore): any {
    // Extract customer information
    const customer = orderData.customer || {};
    const shippingAddress = orderData.shipping_address || {};
    const billingAddress = orderData.billing_address || {};

    // Extract first line item for notification
    const firstItem =
      orderData.line_items && orderData.line_items.length > 0 ? orderData.line_items[0] : null;

    // Calculate total items
    const totalItems =
      orderData.line_items ?
        orderData.line_items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
      : 0;

    // Construct standardized order event
    return {
      event_type: "order.created",
      platform: "shopify",
      site_id: shopifyStore.site_id,
      integration_id: shopifyStore.id,
      timestamp: new Date().toISOString(),
      source_created_at: orderData.created_at,
      order: {
        id: orderData.id,
        order_number: orderData.order_number,
        total_price: orderData.total_price,
        currency: orderData.currency,
        financial_status: orderData.financial_status,
        fulfillment_status: orderData.fulfillment_status,
        total_items: totalItems,
      },
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        orders_count: customer.orders_count,
        city: shippingAddress.city || billingAddress.city,
        province: shippingAddress.province || billingAddress.province,
        country: shippingAddress.country || billingAddress.country,
      },
      item:
        firstItem ?
          {
            id: firstItem.product_id,
            title: firstItem.title,
            variant_title: firstItem.variant_title,
            quantity: firstItem.quantity,
            price: firstItem.price,
            image_url: firstItem.image_url || null,
            product_url: `https://${shopifyStore.shop_domain}/products/${firstItem.handle || firstItem.product_id}`,
          }
        : null,
      // Include a list of all items
      items:
        orderData.line_items ?
          orderData.line_items.map((item: any) => ({
            id: item.product_id,
            title: item.title,
            variant_title: item.variant_title,
            quantity: item.quantity,
            price: item.price,
          }))
        : [],
      // Include original data for reference
      raw_data: orderData,
    };
  }

  /**
   * Process app uninstalled webhook
   * @param shopDomain Shopify store domain
   */
  static async processAppUninstalledWebhook(shopDomain: string): Promise<void> {
    try {
      // Find the Shopify store
      const shopifyStore = await ShopifyIntegration.findByDomain(shopDomain);

      if (!shopifyStore) {
        logger.warn(`Shopify store not found for uninstall: ${shopDomain}`);
        return;
      }

      // Update the store status
      await ShopifyIntegration.update(shopifyStore.id, {
        status: "inactive",
        uninstalled_at: new Date(),
      });

      logger.info("Processed Shopify app uninstalled webhook", { shopDomain });
    } catch (error) {
      logger.error("Error processing Shopify app uninstalled webhook", { error, shopDomain });
      throw error;
    }
  }

  /**
   * Create script tag for notifications
   * @param shopifyStore Shopify store
   * @param scriptUrl URL to the notification script
   */
  static async createScriptTag(shopifyStore: ShopifyStore, scriptUrl: string): Promise<any> {
    if (!shopifyStore.access_token) {
      throw new Error("Shopify access token not available");
    }

    try {
      const response = await fetch(
        `${SHOPIFY_ADMIN_API_URL(shopifyStore.shop_domain)}/script_tags.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyStore.access_token,
          },
          body: JSON.stringify({
            script_tag: {
              event: "onload",
              src: scriptUrl,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Shopify script tag creation failed: ${JSON.stringify(errorData)}`);
      }

      const scriptTagData: any = await response.json();
      logger.info("Created Shopify script tag", {
        shopDomain: shopifyStore.shop_domain,
        scriptTagId: scriptTagData.script_tag.id,
      });

      return scriptTagData.script_tag;
    } catch (error) {
      logger.error("Error creating Shopify script tag", {
        error,
        shopDomain: shopifyStore.shop_domain,
      });
      throw error;
    }
  }
}
