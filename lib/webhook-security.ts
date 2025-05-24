/**
 * Webhook security utilities for HMAC signature generation and verification
 */

import crypto from "crypto";

/**
 * Generate HMAC signature for Shopify webhook
 * @param payload - Webhook payload object
 * @param secret - Webhook secret key
 * @returns Base64 encoded HMAC signature
 */
export function generateShopifyHMAC(payload: object, secret: string): string {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  return hmac.digest("base64");
}

/**
 * Generate headers for Shopify webhook request
 * @param payload - Webhook payload object
 * @param shopDomain - Shop domain for the webhook
 * @param secret - Webhook secret (optional, will use env var if not provided)
 * @returns Headers object for webhook request
 */
export function getShopifyWebhookHeaders(
  payload: object,
  shopDomain: string,
  secret?: string
): Record<string, string> {
  const webhookSecret =
    secret || process.env.SHOPIFY_WEBHOOK_SECRET || "mock_shopify_webhook_secret";
  const signature = generateShopifyHMAC(payload, webhookSecret);

  return {
    "Content-Type": "application/json",
    "X-Shopify-Topic": "orders/create",
    "X-Shopify-Shop-Domain": shopDomain,
    "X-Shopify-Hmac-Sha256": signature,
    "X-Shopify-API-Version": "2023-10",
    "User-Agent": "Social-Proof-App/1.0",
  };
}

/**
 * Verify HMAC signature of incoming webhook
 * @param payload - Raw webhook payload as string or buffer
 * @param signature - HMAC signature from headers
 * @param secret - Webhook secret
 * @returns Whether signature is valid
 */
export function verifyShopifyWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest("base64");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature));
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Generate WooCommerce webhook signature
 * @param payload - Webhook payload object
 * @param secret - Webhook secret key
 * @returns Base64 encoded HMAC signature
 */
export function generateWooCommerceHMAC(payload: object, secret: string): string {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadString);
  return hmac.digest("base64");
}

/**
 * Generate headers for WooCommerce webhook request
 * @param payload - Webhook payload object
 * @param secret - Webhook secret (optional, will use env var if not provided)
 * @returns Headers object for webhook request
 */
export function getWooCommerceWebhookHeaders(
  payload: object,
  secret?: string
): Record<string, string> {
  const webhookSecret =
    secret || process.env.WOOCOMMERCE_WEBHOOK_SECRET || "mock_woocommerce_webhook_secret";
  const signature = generateWooCommerceHMAC(payload, webhookSecret);

  return {
    "Content-Type": "application/json",
    "X-WC-Webhook-Source": "https://test-store.com",
    "X-WC-Webhook-Topic": "order.created",
    "X-WC-Webhook-Resource": "order",
    "X-WC-Webhook-Event": "created",
    "X-WC-Webhook-Signature": signature,
    "User-Agent": "WooCommerce/8.0 Hookshot (WordPress/6.3)",
  };
}

/**
 * Generate generic webhook signature for other platforms
 * @param payload - Webhook payload object
 * @param secret - Webhook secret key
 * @param algorithm - HMAC algorithm (default: sha256)
 * @returns Hex encoded HMAC signature
 */
export function generateGenericHMAC(
  payload: object,
  secret: string,
  algorithm: string = "sha256"
): string {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payloadString);
  return hmac.digest("hex");
}

/**
 * Validate webhook payload structure for Shopify orders
 * @param payload - Webhook payload to validate
 * @returns Whether payload is valid
 */
export function validateShopifyOrderPayload(payload: any): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  // Check required fields for Shopify order webhook
  const requiredFields = ["id", "email", "total_price", "currency", "line_items"];

  for (const field of requiredFields) {
    if (!(field in payload)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate line_items structure
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    console.error("line_items must be a non-empty array");
    return false;
  }

  // Validate each line item
  for (const item of payload.line_items) {
    if (!item.title || !item.price) {
      console.error("Line items must have title and price");
      return false;
    }
  }

  return true;
}

/**
 * Get webhook secret for environment
 * @param provider - Webhook provider (shopify, woocommerce, etc.)
 * @returns Webhook secret
 */
export function getWebhookSecret(provider: string): string {
  switch (provider.toLowerCase()) {
    case "shopify":
      return process.env.SHOPIFY_WEBHOOK_SECRET || "mock_shopify_webhook_secret";
    case "woocommerce":
      return process.env.WOOCOMMERCE_WEBHOOK_SECRET || "mock_woocommerce_webhook_secret";
    default:
      return process.env.GENERIC_WEBHOOK_SECRET || "mock_webhook_secret";
  }
}
