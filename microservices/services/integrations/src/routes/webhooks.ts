import { Router, Request, Response } from "express";
import { WebhookService } from "../services/webhook-service";
import { validateWebhookSignature } from "../middleware/webhook-validation";
import { z } from "zod";
import crypto from "crypto";

const router = Router();
const webhookService = new WebhookService();

// Validation schemas
const shopifyWebhookSchema = z.object({
  id: z.number(),
  topic: z.string(),
  shop_domain: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const wooCommerceWebhookSchema = z.object({
  id: z.number(),
  event: z.string(),
  resource: z.string(),
  created_at: z.string(),
});

const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal("event"),
  type: z.string(),
  data: z.object({
    object: z.any(),
  }),
  created: z.number(),
});

// Raw body parser middleware for webhook signature verification
const rawBodyParser = (req: Request, res: Response, next: any) => {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", () => {
    (req as any).rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      req.body = {};
    }
    next();
  });
};

// Shopify webhook handler
router.post("/shopify/:topic?", rawBodyParser, async (req: Request, res: Response) => {
  try {
    const topic = req.params.topic || (req.headers["x-shopify-topic"] as string);
    const shopDomain = req.headers["x-shopify-shop-domain"] as string;
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;

    if (!topic || !shopDomain || !hmacHeader) {
      return res.status(400).json({
        error: "Missing required Shopify webhook headers",
      });
    }

    // Verify webhook signature
    const isValid = await webhookService.verifyShopifyWebhook(
      (req as any).rawBody,
      hmacHeader,
      shopDomain
    );

    if (!isValid) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // Process webhook
    await webhookService.processShopifyWebhook({
      topic,
      shopDomain,
      payload: req.body,
      headers: req.headers as Record<string, string>,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Shopify webhook error:", error);
    res.status(500).json({
      error: "Failed to process webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// WooCommerce webhook handler
router.post("/woocommerce/:event?", rawBodyParser, async (req: Request, res: Response) => {
  try {
    const event = req.params.event || (req.headers["x-wc-webhook-event"] as string);
    const resource = req.headers["x-wc-webhook-resource"] as string;
    const signature = req.headers["x-wc-webhook-signature"] as string;
    const source = req.headers["x-wc-webhook-source"] as string;

    if (!event || !resource || !signature || !source) {
      return res.status(400).json({
        error: "Missing required WooCommerce webhook headers",
      });
    }

    // Verify webhook signature
    const isValid = await webhookService.verifyWooCommerceWebhook(
      (req as any).rawBody,
      signature,
      source
    );

    if (!isValid) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // Process webhook
    await webhookService.processWooCommerceWebhook({
      event,
      resource,
      source,
      payload: req.body,
      headers: req.headers as Record<string, string>,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("WooCommerce webhook error:", error);
    res.status(500).json({
      error: "Failed to process webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Stripe webhook handler
router.post("/stripe", rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      return res.status(400).json({
        error: "Missing Stripe webhook signature",
      });
    }

    // Verify webhook signature
    const event = await webhookService.verifyStripeWebhook((req as any).rawBody, signature);

    if (!event) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // Process webhook
    await webhookService.processStripeWebhook(event);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(500).json({
      error: "Failed to process webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Generic webhook handler for custom integrations
router.post("/custom/:provider", rawBodyParser, async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;

    if (!provider) {
      return res.status(400).json({ error: "Provider is required" });
    }

    // Verify webhook if signature provided
    if (signature) {
      const isValid = await webhookService.verifyCustomWebhook(
        (req as any).rawBody,
        signature,
        timestamp,
        provider
      );

      if (!isValid) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    // Process webhook
    await webhookService.processCustomWebhook({
      provider,
      payload: req.body,
      headers: req.headers as Record<string, string>,
      timestamp: timestamp || new Date().toISOString(),
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Custom webhook error:", error);
    res.status(500).json({
      error: "Failed to process webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Webhook health check
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "webhook-handler",
  });
});

// Get webhook logs
router.get("/logs/:provider?", async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const { limit = 50, offset = 0, status } = req.query;

    const logs = await webhookService.getWebhookLogs({
      provider,
      limit: Number(limit),
      offset: Number(offset),
      status: status as string,
    });

    res.json(logs);
  } catch (error) {
    console.error("Get webhook logs error:", error);
    res.status(500).json({
      error: "Failed to get webhook logs",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Retry failed webhook
router.post("/retry/:webhookId", async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;

    const result = await webhookService.retryWebhook(webhookId);

    res.json({
      success: true,
      result,
      message: "Webhook retry initiated",
    });
  } catch (error) {
    console.error("Webhook retry error:", error);
    res.status(500).json({
      error: "Failed to retry webhook",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
