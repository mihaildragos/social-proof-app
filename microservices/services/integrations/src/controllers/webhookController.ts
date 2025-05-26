import { Request, Response } from "express";
import { ShopifyService, SHOPIFY_WEBHOOK_TOPICS } from "../services/shopifyService";
import { logger } from "@social-proof/shared";

/**
 * Controller for handling webhooks from various integrations
 */
export class WebhookController {
  /**
   * Handle Shopify webhook requests
   * Method should be used with Express route for Shopify webhooks
   */
  static async handleShopifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received Shopify webhook", { 
        headers: req.headers, 
        url: req.url,
        method: req.method 
      });
      
      // Get shop domain from headers
      const shopDomain = req.headers["x-shopify-shop-domain"] as string;

      if (!shopDomain) {
        logger.warn("Missing Shopify shop domain in webhook");
        res.status(400).json({ error: "Missing shop domain" });
        return;
      }

      // Get HMAC signature for verification
      const hmac = req.headers["x-shopify-hmac-sha256"] as string;

      if (!hmac) {
        logger.warn("Missing HMAC signature in Shopify webhook", { shopDomain });
        res.status(401).json({ error: "Missing HMAC signature" });
        return;
      }

      // Get webhook topic
      const topic = req.headers["x-shopify-topic"] as string;

      if (!topic) {
        logger.warn("Missing topic in Shopify webhook", { shopDomain });
        res.status(400).json({ error: "Missing webhook topic" });
        return;
      }

      // Get raw body (should be preserved by bodyParser middleware configured with { verify: rawBodySaver })
      const rawBody = (req as any).rawBody;

      if (!rawBody) {
        logger.warn("Missing raw body in Shopify webhook", { shopDomain, topic });
        res.status(400).json({ error: "Missing request body" });
        return;
      }

      // Debug logging for HMAC verification
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || "webhook_secret";
      console.log("=== HMAC Debug Info ===");
      console.log("Shop Domain:", shopDomain);
      console.log("Topic:", topic);
      console.log("Received HMAC:", hmac);
      console.log("Webhook Secret:", webhookSecret);
      console.log("Raw Body Length:", rawBody.length);
      console.log("Raw Body Preview:", rawBody.substring(0, 200));
      console.log("Parsed Body Preview:", JSON.stringify(req.body).substring(0, 200));
      console.log("========================");

      // Verify HMAC signature
      const isValid = ShopifyService.verifyWebhookSignature(hmac, rawBody, webhookSecret);

      if (!isValid) {
        logger.warn("Invalid HMAC signature in Shopify webhook", { 
          shopDomain, 
          topic,
          receivedHmac: hmac,
          rawBodyLength: rawBody.length
        });
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      logger.info("HMAC signature verified successfully", { shopDomain, topic });

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
      logger.error("Error handling Shopify webhook", { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error,
        shopDomain: req.headers["x-shopify-shop-domain"],
        url: req.url
      });

      // Always return 200 to Shopify to prevent retries
      // Failed events should be handled internally with retry logic
      res.status(200).send("OK");
    }
  }

  /**
   * Middleware to save raw body for HMAC verification
   * Use this middleware on routes that need HMAC validation
   */
  static rawBodySaver(req: Request, res: Response, buf: Buffer, encoding: string): void {
    try {
      if (buf && buf.length) {
        (req as any).rawBody = buf.toString((encoding as BufferEncoding) || "utf8");
      }
    } catch (error) {
      logger.error("Error in rawBodySaver", { error });
      // Don't throw the error, just log it and continue
    }
  }
}
