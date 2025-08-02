import { Router } from "express";
import bodyParser from "body-parser";
import { WebhookController } from "../controllers/webhookController";

const router = Router();

// Configure body parser with raw body saver for HMAC verification
const jsonParser = bodyParser.json({
  verify: WebhookController.rawBodySaver,
});

/**
 * Shopify webhook routes
 */
router.post("/shopify/orders-create", jsonParser, WebhookController.handleShopifyWebhook);
router.post("/shopify/orders-updated", jsonParser, WebhookController.handleShopifyWebhook);
router.post("/shopify/orders-paid", jsonParser, WebhookController.handleShopifyWebhook);
router.post("/shopify/app-uninstalled", jsonParser, WebhookController.handleShopifyWebhook);

// Generic route to handle all Shopify webhooks
router.post("/shopify/:topic", jsonParser, WebhookController.handleShopifyWebhook);

export default router;
