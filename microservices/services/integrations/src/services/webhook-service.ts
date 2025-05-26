import { Pool } from "pg";
import { EventEmitter } from "events";
import crypto from "crypto";
import { IntegrationService } from "./integration-service";

export interface WebhookEvent {
  id: string;
  provider: string;
  topic: string;
  payload: any;
  headers: Record<string, string>;
  signature?: string;
  timestamp: Date;
  status: "pending" | "processed" | "failed" | "retrying";
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopifyWebhookData {
  topic: string;
  shopDomain: string;
  payload: any;
  headers: Record<string, string>;
}

export interface WooCommerceWebhookData {
  event: string;
  resource: string;
  source: string;
  payload: any;
  headers: Record<string, string>;
}

export interface CustomWebhookData {
  provider: string;
  payload: any;
  headers: Record<string, string>;
  timestamp: string;
}

export class WebhookService extends EventEmitter {
  private db: Pool;
  private integrationService: IntegrationService;

  constructor() {
    super();
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    this.integrationService = new IntegrationService();
  }

  async verifyShopifyWebhook(
    rawBody: string,
    hmacHeader: string,
    shopDomain: string
  ): Promise<boolean> {
    try {
      // Get the webhook secret for this shop
      const secret = await this.getShopifyWebhookSecret(shopDomain);

      if (!secret) {
        console.error("No webhook secret found for shop:", shopDomain);
        return false;
      }

      // Calculate HMAC
      const calculatedHmac = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      return crypto.timingSafeEqual(
        Buffer.from(hmacHeader, "base64"),
        Buffer.from(calculatedHmac, "base64")
      );
    } catch (error) {
      console.error("Shopify webhook verification error:", error);
      return false;
    }
  }

  async verifyWooCommerceWebhook(
    rawBody: string,
    signature: string,
    source: string
  ): Promise<boolean> {
    try {
      // Get the webhook secret for this WooCommerce store
      const secret = await this.getWooCommerceWebhookSecret(source);

      if (!secret) {
        console.error("No webhook secret found for WooCommerce store:", source);
        return false;
      }

      // Calculate signature
      const calculatedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      return crypto.timingSafeEqual(
        Buffer.from(signature, "base64"),
        Buffer.from(calculatedSignature, "base64")
      );
    } catch (error) {
      console.error("WooCommerce webhook verification error:", error);
      return false;
    }
  }

  async verifyStripeWebhook(rawBody: string, signature: string): Promise<any> {
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!secret) {
        throw new Error("Stripe webhook secret not configured");
      }

      // Parse signature header
      const elements = signature.split(",");
      const signatureElements: Record<string, string> = {};

      elements.forEach((element) => {
        const [key, value] = element.split("=");
        signatureElements[key] = value;
      });

      const timestamp = signatureElements.t;
      const signatures = [signatureElements.v1];

      if (!timestamp || !signatures[0]) {
        throw new Error("Invalid signature format");
      }

      // Check timestamp tolerance (5 minutes)
      const timestampTolerance = 300;
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);

      if (Math.abs(currentTimestamp - webhookTimestamp) > timestampTolerance) {
        throw new Error("Webhook timestamp too old");
      }

      // Calculate expected signature
      const payload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      // Verify signature
      const isValid = signatures.some((signature) =>
        crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))
      );

      if (!isValid) {
        throw new Error("Invalid signature");
      }

      return JSON.parse(rawBody);
    } catch (error) {
      console.error("Stripe webhook verification error:", error);
      return null;
    }
  }

  async verifyCustomWebhook(
    rawBody: string,
    signature: string,
    timestamp: string,
    provider: string
  ): Promise<boolean> {
    try {
      // Get the webhook secret for this custom provider
      const secret = await this.getCustomWebhookSecret(provider);

      if (!secret) {
        console.error("No webhook secret found for provider:", provider);
        return false;
      }

      // Calculate signature
      const payload = `${timestamp}.${rawBody}`;
      const calculatedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(calculatedSignature, "hex")
      );
    } catch (error) {
      console.error("Custom webhook verification error:", error);
      return false;
    }
  }

  async processShopifyWebhook(data: ShopifyWebhookData): Promise<void> {
    const webhookEvent = await this.logWebhookEvent({
      provider: "shopify",
      topic: data.topic,
      payload: data.payload,
      headers: data.headers,
      signature: data.headers["x-shopify-hmac-sha256"],
    });

    try {
      // Process based on topic
      switch (data.topic) {
        case "orders/create":
          await this.handleShopifyOrderCreated(data);
          break;
        case "orders/updated":
          await this.handleShopifyOrderUpdated(data);
          break;
        case "orders/paid":
          await this.handleShopifyOrderPaid(data);
          break;
        case "app/uninstalled":
          await this.handleShopifyAppUninstalled(data);
          break;
        default:
          console.log("Unhandled Shopify webhook topic:", data.topic);
      }

      await this.updateWebhookEventStatus(webhookEvent.id, "processed");

      this.emit("webhook:processed", {
        provider: "shopify",
        topic: data.topic,
        webhookId: webhookEvent.id,
      });
    } catch (error) {
      await this.updateWebhookEventStatus(
        webhookEvent.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );

      this.emit("webhook:failed", {
        provider: "shopify",
        topic: data.topic,
        webhookId: webhookEvent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async processWooCommerceWebhook(data: WooCommerceWebhookData): Promise<void> {
    const webhookEvent = await this.logWebhookEvent({
      provider: "woocommerce",
      topic: `${data.resource}.${data.event}`,
      payload: data.payload,
      headers: data.headers,
      signature: data.headers["x-wc-webhook-signature"],
    });

    try {
      // Process based on resource and event
      const eventKey = `${data.resource}.${data.event}`;

      switch (eventKey) {
        case "order.created":
          await this.handleWooCommerceOrderCreated(data);
          break;
        case "order.updated":
          await this.handleWooCommerceOrderUpdated(data);
          break;
        case "product.created":
          await this.handleWooCommerceProductCreated(data);
          break;
        case "product.updated":
          await this.handleWooCommerceProductUpdated(data);
          break;
        default:
          console.log("Unhandled WooCommerce webhook event:", eventKey);
      }

      await this.updateWebhookEventStatus(webhookEvent.id, "processed");

      this.emit("webhook:processed", {
        provider: "woocommerce",
        topic: eventKey,
        webhookId: webhookEvent.id,
      });
    } catch (error) {
      await this.updateWebhookEventStatus(
        webhookEvent.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );

      this.emit("webhook:failed", {
        provider: "woocommerce",
        topic: `${data.resource}.${data.event}`,
        webhookId: webhookEvent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async processStripeWebhook(event: any): Promise<void> {
    const webhookEvent = await this.logWebhookEvent({
      provider: "stripe",
      topic: event.type,
      payload: event,
      headers: {},
      signature: event.id,
    });

    try {
      // Process based on event type
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handleStripePaymentSucceeded(event);
          break;
        case "payment_intent.payment_failed":
          await this.handleStripePaymentFailed(event);
          break;
        case "customer.created":
          await this.handleStripeCustomerCreated(event);
          break;
        case "invoice.payment_succeeded":
          await this.handleStripeInvoicePaymentSucceeded(event);
          break;
        default:
          console.log("Unhandled Stripe webhook event:", event.type);
      }

      await this.updateWebhookEventStatus(webhookEvent.id, "processed");

      this.emit("webhook:processed", {
        provider: "stripe",
        topic: event.type,
        webhookId: webhookEvent.id,
      });
    } catch (error) {
      await this.updateWebhookEventStatus(
        webhookEvent.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );

      this.emit("webhook:failed", {
        provider: "stripe",
        topic: event.type,
        webhookId: webhookEvent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async processCustomWebhook(data: CustomWebhookData): Promise<void> {
    const webhookEvent = await this.logWebhookEvent({
      provider: data.provider,
      topic: "custom",
      payload: data.payload,
      headers: data.headers,
      signature: data.headers["x-webhook-signature"],
    });

    try {
      // Emit custom webhook event for processing
      this.emit("webhook:custom", {
        provider: data.provider,
        payload: data.payload,
        headers: data.headers,
        webhookId: webhookEvent.id,
      });

      await this.updateWebhookEventStatus(webhookEvent.id, "processed");
    } catch (error) {
      await this.updateWebhookEventStatus(
        webhookEvent.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async getWebhookLogs(options: {
    provider?: string;
    limit: number;
    offset: number;
    status?: string;
  }): Promise<WebhookEvent[]> {
    let query = "SELECT * FROM webhook_events WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (options.provider) {
      query += ` AND provider = $${paramIndex++}`;
      params.push(options.provider);
    }

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(options.limit, options.offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToWebhookEvent(row));
  }

  async retryWebhook(webhookId: string): Promise<boolean> {
    const webhook = await this.getWebhookEvent(webhookId);

    if (!webhook) {
      throw new Error("Webhook event not found");
    }

    if (webhook.retryCount >= 3) {
      throw new Error("Maximum retry attempts exceeded");
    }

    try {
      // Increment retry count
      await this.updateWebhookEventRetry(webhookId, webhook.retryCount + 1);

      // Reprocess webhook based on provider
      switch (webhook.provider) {
        case "shopify":
          await this.processShopifyWebhook({
            topic: webhook.topic,
            shopDomain: webhook.headers["x-shopify-shop-domain"] || "",
            payload: webhook.payload,
            headers: webhook.headers,
          });
          break;
        case "woocommerce":
          const [resource, event] = webhook.topic.split(".");
          await this.processWooCommerceWebhook({
            event,
            resource,
            source: webhook.headers["x-wc-webhook-source"] || "",
            payload: webhook.payload,
            headers: webhook.headers,
          });
          break;
        case "stripe":
          await this.processStripeWebhook(webhook.payload);
          break;
        default:
          await this.processCustomWebhook({
            provider: webhook.provider,
            payload: webhook.payload,
            headers: webhook.headers,
            timestamp: webhook.timestamp.toISOString(),
          });
      }

      return true;
    } catch (error) {
      await this.updateWebhookEventStatus(
        webhookId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
      return false;
    }
  }

  // Private helper methods
  private async logWebhookEvent(data: {
    provider: string;
    topic: string;
    payload: any;
    headers: Record<string, string>;
    signature?: string;
  }): Promise<WebhookEvent> {
    const result = await this.db.query(
      `
      INSERT INTO webhook_events (
        provider, topic, payload, headers, signature, status, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        data.provider,
        data.topic,
        JSON.stringify(data.payload),
        JSON.stringify(data.headers),
        data.signature,
        "pending",
        0,
      ]
    );

    return this.mapRowToWebhookEvent(result.rows[0]);
  }

  private async updateWebhookEventStatus(
    id: string,
    status: WebhookEvent["status"],
    error?: string
  ): Promise<void> {
    await this.db.query(
      "UPDATE webhook_events SET status = $1, last_error = $2, updated_at = $3 WHERE id = $4",
      [status, error, new Date(), id]
    );
  }

  private async updateWebhookEventRetry(id: string, retryCount: number): Promise<void> {
    await this.db.query(
      "UPDATE webhook_events SET retry_count = $1, status = $2, updated_at = $3 WHERE id = $4",
      ["retrying", retryCount, new Date(), id]
    );
  }

  private async getWebhookEvent(id: string): Promise<WebhookEvent | null> {
    const result = await this.db.query("SELECT * FROM webhook_events WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWebhookEvent(result.rows[0]);
  }

  private mapRowToWebhookEvent(row: any): WebhookEvent {
    return {
      id: row.id,
      provider: row.provider,
      topic: row.topic,
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      headers: typeof row.headers === "string" ? JSON.parse(row.headers) : row.headers,
      signature: row.signature,
      timestamp: new Date(row.timestamp || row.created_at),
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Webhook secret getters (these would be implemented based on your storage strategy)
  private async getShopifyWebhookSecret(shopDomain: string): Promise<string | null> {
    // Implementation would fetch from database or environment
    return process.env.SHOPIFY_WEBHOOK_SECRET || null;
  }

  private async getWooCommerceWebhookSecret(source: string): Promise<string | null> {
    // Implementation would fetch from database or environment
    return process.env.WOOCOMMERCE_WEBHOOK_SECRET || null;
  }

  private async getCustomWebhookSecret(provider: string): Promise<string | null> {
    // Implementation would fetch from database or environment
    return process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || null;
  }

  // Webhook event handlers (implement based on your business logic)
  private async handleShopifyOrderCreated(data: ShopifyWebhookData): Promise<void> {
    // Implement order created logic
    console.log("Shopify order created:", data.payload.id);
  }

  private async handleShopifyOrderUpdated(data: ShopifyWebhookData): Promise<void> {
    // Implement order updated logic
    console.log("Shopify order updated:", data.payload.id);
  }

  private async handleShopifyOrderPaid(data: ShopifyWebhookData): Promise<void> {
    // Implement order paid logic
    console.log("Shopify order paid:", data.payload.id);
  }

  private async handleShopifyAppUninstalled(data: ShopifyWebhookData): Promise<void> {
    // Implement app uninstalled logic
    console.log("Shopify app uninstalled for shop:", data.shopDomain);
  }

  private async handleWooCommerceOrderCreated(data: WooCommerceWebhookData): Promise<void> {
    // Implement order created logic
    console.log("WooCommerce order created:", data.payload.id);
  }

  private async handleWooCommerceOrderUpdated(data: WooCommerceWebhookData): Promise<void> {
    // Implement order updated logic
    console.log("WooCommerce order updated:", data.payload.id);
  }

  private async handleWooCommerceProductCreated(data: WooCommerceWebhookData): Promise<void> {
    // Implement product created logic
    console.log("WooCommerce product created:", data.payload.id);
  }

  private async handleWooCommerceProductUpdated(data: WooCommerceWebhookData): Promise<void> {
    // Implement product updated logic
    console.log("WooCommerce product updated:", data.payload.id);
  }

  private async handleStripePaymentSucceeded(event: any): Promise<void> {
    // Implement payment succeeded logic
    console.log("Stripe payment succeeded:", event.data.object.id);
  }

  private async handleStripePaymentFailed(event: any): Promise<void> {
    // Implement payment failed logic
    console.log("Stripe payment failed:", event.data.object.id);
  }

  private async handleStripeCustomerCreated(event: any): Promise<void> {
    // Implement customer created logic
    console.log("Stripe customer created:", event.data.object.id);
  }

  private async handleStripeInvoicePaymentSucceeded(event: any): Promise<void> {
    // Implement invoice payment succeeded logic
    console.log("Stripe invoice payment succeeded:", event.data.object.id);
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}
