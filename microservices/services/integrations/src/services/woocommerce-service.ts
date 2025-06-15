import { EventEmitter } from "events";
import axios, { AxiosInstance } from "axios";
import * as crypto from "crypto";

export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  version?: string;
}

export interface WooCommerceStoreInfo {
  id?: string;
  name: string;
  description: string;
  url: string;
  wc_version: string;
  version: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  gmt_offset: number;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: any[];
  tags: any[];
  images: any[];
  attributes: any[];
  default_attributes: any[];
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: any[];
}

export interface WooCommerceOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: string;
  currency: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: any;
  shipping: any;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string;
  date_paid_gmt: string;
  date_completed: string;
  date_completed_gmt: string;
  cart_hash: string;
  meta_data: any[];
  line_items: any[];
  tax_lines: any[];
  shipping_lines: any[];
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
}

export class WooCommerceService extends EventEmitter {
  private clients: Map<string, AxiosInstance> = new Map();

  constructor() {
    super();
  }

  /**
   * Create WooCommerce API client
   */
  private createClient(config: WooCommerceConfig): AxiosInstance {
    const { storeUrl, consumerKey, consumerSecret, version = "wc/v3" } = config;
    const baseURL = `${storeUrl}/wp-json/${version}`;

    const client = axios.create({
      baseURL,
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SocialProofApp/1.0",
      },
    });

    // Add request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        console.log(`WooCommerce API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error("WooCommerce API Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error("WooCommerce API Response Error:", error.response?.data || error.message);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Get or create client for store
   */
  private getClient(config: WooCommerceConfig): AxiosInstance {
    const key = `${config.storeUrl}-${config.consumerKey}`;

    if (!this.clients.has(key)) {
      this.clients.set(key, this.createClient(config));
    }

    return this.clients.get(key)!;
  }

  /**
   * Validate WooCommerce connection
   */
  async validateConnection(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    version = "wc/v3"
  ): Promise<WooCommerceStoreInfo> {
    try {
      const client = this.createClient({ storeUrl, consumerKey, consumerSecret, version });

      // Test connection by getting system status
      const response = await client.get("/system_status");
      const systemStatus = response.data;

      // Get store settings
      const settingsResponse = await client.get("/settings/general");
      const settings = settingsResponse.data;

      const storeInfo: WooCommerceStoreInfo = {
        id: storeUrl,
        name:
          settings.find((s: any) => s.id === "woocommerce_store_name")?.value ||
          "WooCommerce Store",
        description:
          settings.find((s: any) => s.id === "woocommerce_store_description")?.value || "",
        url: storeUrl,
        wc_version: systemStatus.environment?.version || "unknown",
        version: systemStatus.environment?.wp_version || "unknown",
        currency: settings.find((s: any) => s.id === "woocommerce_currency")?.value || "USD",
        currency_symbol:
          settings.find((s: any) => s.id === "woocommerce_currency_symbol")?.value || "$",
        timezone: systemStatus.environment?.server_info?.timezone || "UTC",
        gmt_offset: 0,
      };

      this.emit("connection:validated", { storeUrl, storeInfo });
      return storeInfo;
    } catch (error) {
      this.emit("connection:failed", { storeUrl, error });
      throw new Error(
        `Failed to validate WooCommerce connection: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Test WooCommerce connection
   */
  async testConnection(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    version = "wc/v3"
  ): Promise<boolean> {
    try {
      await this.validateConnection(storeUrl, consumerKey, consumerSecret, version);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup webhooks for WooCommerce store
   */
  async setupWebhooks(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<void> {
    try {
      const client = this.getClient({ storeUrl, consumerKey, consumerSecret });
      const webhookUrl = `${process.env.API_BASE_URL}/api/integrations/webhooks/woocommerce`;

      const webhookEvents = [
        "order.created",
        "order.updated",
        "order.deleted",
        "product.created",
        "product.updated",
        "product.deleted",
        "customer.created",
        "customer.updated",
        "customer.deleted",
      ];

      for (const event of webhookEvents) {
        try {
          await client.post("/webhooks", {
            name: `Social Proof App - ${event}`,
            topic: event,
            delivery_url: webhookUrl,
            secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET || "social-proof-webhook-secret",
            status: "active",
          });
        } catch (error) {
          console.warn(`Failed to create webhook for ${event}:`, error);
        }
      }

      this.emit("webhooks:setup", { storeUrl, events: webhookEvents });
    } catch (error) {
      this.emit("webhooks:failed", { storeUrl, error });
      throw new Error(
        `Failed to setup webhooks: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<WooCommerceStoreInfo> {
    return this.validateConnection(storeUrl, consumerKey, consumerSecret);
  }

  /**
   * Sync store data
   */
  async syncStoreData(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    userId: string
  ): Promise<void> {
    try {
      const client = this.getClient({ storeUrl, consumerKey, consumerSecret });

      // Sync products
      const products = await this.getProducts(storeUrl, consumerKey, consumerSecret, {
        per_page: 100,
      });

      // Sync orders
      const orders = await this.getOrders(storeUrl, consumerKey, consumerSecret, { per_page: 100 });

      this.emit("data:synced", {
        storeUrl,
        userId,
        products: products.length,
        orders: orders.length,
      });
    } catch (error) {
      this.emit("sync:failed", { storeUrl, userId, error });
      throw new Error(
        `Failed to sync store data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get products from WooCommerce store
   */
  async getProducts(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    params: {
      page?: number;
      per_page?: number;
      search?: string;
      category?: string;
      status?: string;
    } = {}
  ): Promise<WooCommerceProduct[]> {
    try {
      const client = this.getClient({ storeUrl, consumerKey, consumerSecret });
      const response = await client.get("/products", { params });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get products: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get orders from WooCommerce store
   */
  async getOrders(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      customer?: number;
      after?: string;
      before?: string;
    } = {}
  ): Promise<WooCommerceOrder[]> {
    try {
      const client = this.getClient({ storeUrl, consumerKey, consumerSecret });
      const response = await client.get("/orders", { params });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get orders: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("base64");

      return crypto.timingSafeEqual(
        Buffer.from(signature, "base64"),
        Buffer.from(expectedSignature, "base64")
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(
    event: string,
    resource: string,
    data: any,
    storeUrl: string
  ): Promise<void> {
    try {
      this.emit("webhook:received", {
        event,
        resource,
        storeUrl,
        data,
        timestamp: new Date(),
      });

      // Process different event types
      switch (event) {
        case "created":
          await this.handleResourceCreated(resource, data, storeUrl);
          break;
        case "updated":
          await this.handleResourceUpdated(resource, data, storeUrl);
          break;
        case "deleted":
          await this.handleResourceDeleted(resource, data, storeUrl);
          break;
        default:
          console.warn(`Unhandled WooCommerce webhook event: ${event}`);
      }
    } catch (error) {
      this.emit("webhook:error", { event, resource, storeUrl, error });
      throw error;
    }
  }

  /**
   * Handle resource created events
   */
  private async handleResourceCreated(
    resource: string,
    data: any,
    storeUrl: string
  ): Promise<void> {
    this.emit(`${resource}:created`, { data, storeUrl });
  }

  /**
   * Handle resource updated events
   */
  private async handleResourceUpdated(
    resource: string,
    data: any,
    storeUrl: string
  ): Promise<void> {
    this.emit(`${resource}:updated`, { data, storeUrl });
  }

  /**
   * Handle resource deleted events
   */
  private async handleResourceDeleted(
    resource: string,
    data: any,
    storeUrl: string
  ): Promise<void> {
    this.emit(`${resource}:deleted`, { data, storeUrl });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.clients.clear();
    this.removeAllListeners();
  }
}
