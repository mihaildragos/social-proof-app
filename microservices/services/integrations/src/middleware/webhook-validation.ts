import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Shopify webhook validation middleware
 */
export const validateShopifyWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const body = req.body;
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!hmacHeader) {
      res.status(401).json({ error: "Missing Shopify HMAC header" });
      return;
    }

    if (!secret) {
      res.status(500).json({ error: "Shopify webhook secret not configured" });
      return;
    }

    // Calculate expected HMAC
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(bodyString, "utf8")
      .digest("base64");

    // Compare HMACs
    if (!crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(expectedHmac))) {
      res.status(401).json({ error: "Invalid Shopify webhook signature" });
      return;
    }

    // Add webhook metadata to request
    (req as any).webhook = {
      provider: "shopify",
      topic: req.get("X-Shopify-Topic"),
      shop: req.get("X-Shopify-Shop-Domain"),
      verified: true,
    };

    next();
  } catch (error) {
    console.error("Shopify webhook validation error:", error);
    res.status(500).json({ error: "Webhook validation failed" });
    return;
  }
};

/**
 * WooCommerce webhook validation middleware
 */
export const validateWooCommerceWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const signature = req.get("X-WC-Webhook-Signature");
    const body = req.body;
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

    if (!signature) {
      res.status(401).json({ error: "Missing WooCommerce webhook signature" });
      return;
    }

    if (!secret) {
      res.status(500).json({ error: "WooCommerce webhook secret not configured" });
      return;
    }

    // Calculate expected signature
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyString, "utf8")
      .digest("base64");

    // Compare signatures
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      res.status(401).json({ error: "Invalid WooCommerce webhook signature" });
      return;
    }

    // Add webhook metadata to request
    (req as any).webhook = {
      provider: "woocommerce",
      event: req.get("X-WC-Webhook-Event"),
      resource: req.get("X-WC-Webhook-Resource"),
      verified: true,
    };

    next();
  } catch (error) {
    console.error("WooCommerce webhook validation error:", error);
    res.status(500).json({ error: "Webhook validation failed" });
    return;
  }
};

/**
 * Stripe webhook validation middleware
 */
export const validateStripeWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const signature = req.get("stripe-signature");
    const body = req.body;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature) {
      res.status(401).json({ error: "Missing Stripe webhook signature" });
      return;
    }

    if (!secret) {
      res.status(500).json({ error: "Stripe webhook secret not configured" });
      return;
    }

    // Parse signature header
    const elements = signature.split(",");
    const signatureElements: { [key: string]: string } = {};

    for (const element of elements) {
      const [key, value] = element.split("=");
      signatureElements[key] = value;
    }

    if (!signatureElements.t || !signatureElements.v1) {
      res.status(401).json({ error: "Invalid Stripe signature format" });
      return;
    }

    // Check timestamp (prevent replay attacks)
    const timestamp = parseInt(signatureElements.t, 10);
    const tolerance = 300; // 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);

    if (Math.abs(currentTime - timestamp) > tolerance) {
      res.status(401).json({ error: "Stripe webhook timestamp too old" });
      return;
    }

    // Calculate expected signature
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    const payload = `${timestamp}.${bodyString}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    // Compare signatures
    if (
      !crypto.timingSafeEqual(Buffer.from(signatureElements.v1), Buffer.from(expectedSignature))
    ) {
      res.status(401).json({ error: "Invalid Stripe webhook signature" });
      return;
    }

    // Add webhook metadata to request
    (req as any).webhook = {
      provider: "stripe",
      timestamp,
      verified: true,
    };

    next();
  } catch (error) {
    console.error("Stripe webhook validation error:", error);
    res.status(500).json({ error: "Webhook validation failed" });
    return;
  }
};

/**
 * Generic webhook validation middleware
 */
export const validateGenericWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const signature = req.get("X-Webhook-Signature") || req.get("X-Hub-Signature-256");
    const body = req.body;
    const secret = process.env.GENERIC_WEBHOOK_SECRET;

    if (!signature) {
      // Allow webhooks without signatures for testing
      if (process.env.NODE_ENV === "development") {
        (req as any).webhook = {
          provider: "generic",
          verified: false,
        };
        next();
        return;
      }

      res.status(401).json({ error: "Missing webhook signature" });
      return;
    }

    if (!secret) {
      res.status(500).json({ error: "Generic webhook secret not configured" });
      return;
    }

    // Handle different signature formats
    let expectedSignature: string;
    let providedSignature: string;

    if (signature.startsWith("sha256=")) {
      // GitHub style
      providedSignature = signature.substring(7);
      const bodyString = typeof body === "string" ? body : JSON.stringify(body);
      expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyString, "utf8")
        .digest("hex");
    } else {
      // Base64 style
      providedSignature = signature;
      const bodyString = typeof body === "string" ? body : JSON.stringify(body);
      expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyString, "utf8")
        .digest("base64");
    }

    // Compare signatures
    if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // Add webhook metadata to request
    (req as any).webhook = {
      provider: "generic",
      verified: true,
    };

    next();
  } catch (error) {
    console.error("Generic webhook validation error:", error);
    res.status(500).json({ error: "Webhook validation failed" });
    return;
  }
};

/**
 * Webhook provider detection middleware
 */
export const detectWebhookProvider = (req: Request, res: Response, next: NextFunction): void => {
  try {
    let provider = "unknown";

    // Detect provider based on headers
    if (req.get("X-Shopify-Topic")) {
      provider = "shopify";
    } else if (req.get("X-WC-Webhook-Event")) {
      provider = "woocommerce";
    } else if (req.get("Stripe-Signature")) {
      provider = "stripe";
    } else if (req.get("X-GitHub-Event")) {
      provider = "github";
    } else if (req.get("X-Zapier-Event")) {
      provider = "zapier";
    }

    // Add provider to request
    (req as any).webhookProvider = provider;

    next();
  } catch (error) {
    console.error("Webhook provider detection error:", error);
    res.status(500).json({ error: "Provider detection failed" });
    return;
  }
};

/**
 * Webhook rate limiting middleware
 */
export const webhookRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const provider = (req as any).webhookProvider || "unknown";
    const clientIp = req.ip || req.connection.remoteAddress;

    // Simple in-memory rate limiting (in production, use Redis)
    const rateLimitKey = `webhook:${provider}:${clientIp}`;
    const maxRequests = 100; // per minute
    const windowMs = 60 * 1000; // 1 minute

    // TODO: Implement proper rate limiting with Redis
    // For now, just log the request
    console.log(`Webhook request from ${clientIp} for provider ${provider}`);

    next();
  } catch (error) {
    console.error("Webhook rate limiting error:", error);
    res.status(500).json({ error: "Rate limiting failed" });
    return;
  }
};

/**
 * Webhook logging middleware
 */
export const logWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const provider = (req as any).webhookProvider || "unknown";
    const webhook = (req as any).webhook || {};
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] Webhook received:`, {
      provider,
      verified: webhook.verified,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      contentType: req.get("Content-Type"),
      bodySize: JSON.stringify(req.body).length,
    });

    next();
  } catch (error) {
    console.error("Webhook logging error:", error);
    // Don't fail the request for logging errors
    next();
  }
};
