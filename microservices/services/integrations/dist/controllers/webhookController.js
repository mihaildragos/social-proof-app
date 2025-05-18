import { ShopifyService, SHOPIFY_WEBHOOK_TOPICS } from "../services/shopifyService";
import { logger } from "../../../../shared/src/utils/logger";
/**
 * Controller for handling webhooks from various integrations
 */
export class WebhookController {
  /**
   * Handle Shopify webhook requests
   * Method should be used with Express route for Shopify webhooks
   */
  static async handleShopifyWebhook(req, res) {
    try {
      // Get shop domain from headers
      const shopDomain = req.headers["x-shopify-shop-domain"];
      if (!shopDomain) {
        logger.warn("Missing Shopify shop domain in webhook");
        res.status(400).json({ error: "Missing shop domain" });
        return;
      }
      // Get HMAC signature for verification
      const hmac = req.headers["x-shopify-hmac-sha256"];
      if (!hmac) {
        logger.warn("Missing HMAC signature in Shopify webhook", { shopDomain });
        res.status(401).json({ error: "Missing HMAC signature" });
        return;
      }
      // Get webhook topic
      const topic = req.headers["x-shopify-topic"];
      if (!topic) {
        logger.warn("Missing topic in Shopify webhook", { shopDomain });
        res.status(400).json({ error: "Missing webhook topic" });
        return;
      }
      // Get raw body (should be preserved by bodyParser middleware configured with { verify: rawBodySaver })
      const rawBody = req.rawBody;
      if (!rawBody) {
        logger.warn("Missing raw body in Shopify webhook", { shopDomain, topic });
        res.status(400).json({ error: "Missing request body" });
        return;
      }
      // TODO: Fetch the shop's webhook secret from the database
      // For now using an environment variable
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || "webhook_secret";
      // Verify HMAC signature
      const isValid = ShopifyService.verifyWebhookSignature(hmac, rawBody, webhookSecret);
      if (!isValid) {
        logger.warn("Invalid HMAC signature in Shopify webhook", { shopDomain, topic });
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      // Process webhook by topic
      switch (topic) {
        case SHOPIFY_WEBHOOK_TOPICS.ORDERS_CREATE:
        case SHOPIFY_WEBHOOK_TOPICS.ORDERS_PAID:
          await ShopifyService.processOrderWebhook(shopDomain, req.body);
          break;
        case SHOPIFY_WEBHOOK_TOPICS.APP_UNINSTALLED:
          await ShopifyService.processAppUninstalledWebhook(shopDomain);
          break;
        default:
          logger.info(`Received unhandled Shopify webhook topic: ${topic}`, { shopDomain });
          break;
      }
      // Return 200 OK to acknowledge receipt
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling Shopify webhook", { error });
      // Always return 200 to Shopify to prevent retries
      // Failed events should be handled internally with retry logic
      res.status(200).send("OK");
    }
  }
  /**
   * Middleware to save raw body for HMAC verification
   * Use this middleware on routes that need HMAC validation
   */
  static rawBodySaver(req, res, buf, encoding) {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || "utf8");
    }
  }
}
//# sourceMappingURL=webhookController.js.map
