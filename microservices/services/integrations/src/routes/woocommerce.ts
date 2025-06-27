import { Router, Request, Response } from "express";
import { IntegrationService } from "../services/integration-service";
import { WooCommerceService } from "../services/woocommerce-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const integrationService = new IntegrationService();
const wooCommerceService = new WooCommerceService();

// Validation schemas
const connectWooCommerceSchema = z.object({
  storeUrl: z.string().url("Valid store URL is required"),
  consumerKey: z.string().min(1, "Consumer key is required"),
  consumerSecret: z.string().min(1, "Consumer secret is required"),
  version: z.string().default("wc/v3"),
});

const wooCommerceWebhookSchema = z.object({
  topic: z.string(),
  resource: z.string(),
  event: z.string(),
  payload: z.any(),
});

// Connect WooCommerce store
router.post(
  "/connect",
  authMiddleware,
  validateRequest(connectWooCommerceSchema),
  async (req: Request, res: Response) => {
    try {
      const { storeUrl, consumerKey, consumerSecret, version } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Validate the connection and get store info
      const storeInfo = await wooCommerceService.validateConnection(
        storeUrl,
        consumerKey,
        consumerSecret,
        version
      );

      // Store the integration
      const integration = await integrationService.createIntegration({
        userId,
        provider: "woocommerce",
        providerAccountId: storeInfo.id?.toString() || storeUrl,
        accessToken: consumerKey,
        refreshToken: consumerSecret,
        expiresAt: undefined,
        scope: "read_write",
        metadata: {
          storeUrl,
          storeName: storeInfo.name,
          version,
          currency: storeInfo.currency,
          timezone: storeInfo.timezone,
          wooCommerceVersion: storeInfo.wc_version,
        },
      });

      // Set up webhooks
      await wooCommerceService.setupWebhooks(storeUrl, consumerKey, consumerSecret);

      res.json({
        success: true,
        integration: {
          id: integration.id,
          provider: integration.provider,
          storeUrl,
          storeName: storeInfo.name,
          connectedAt: integration.createdAt,
        },
      });
    } catch (error) {
      console.error("WooCommerce connection error:", error);
      res.status(500).json({
        error: "Failed to connect WooCommerce store",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Test WooCommerce connection
router.post(
  "/test",
  authMiddleware,
  validateRequest(connectWooCommerceSchema),
  async (req: Request, res: Response) => {
    try {
      const { storeUrl, consumerKey, consumerSecret, version } = req.body;

      const isValid = await wooCommerceService.testConnection(
        storeUrl,
        consumerKey,
        consumerSecret,
        version
      );

      res.json({ valid: isValid });
    } catch (error) {
      console.error("WooCommerce test connection error:", error);
      res.status(500).json({
        error: "Failed to test WooCommerce connection",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Disconnect WooCommerce store
router.delete("/disconnect/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    await integrationService.deleteIntegration(integrationId, userId);

    res.json({ success: true, message: "WooCommerce integration disconnected" });
  } catch (error) {
    console.error("WooCommerce disconnection error:", error);
    res.status(500).json({
      error: "Failed to disconnect WooCommerce store",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get WooCommerce store info
router.get("/store/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "woocommerce") {
      return res.status(404).json({ error: "WooCommerce integration not found" });
    }

    const storeInfo = await wooCommerceService.getStoreInfo(
      integration.metadata.storeUrl,
      integration.accessToken,
      integration.refreshToken || ''
    );

    res.json(storeInfo);
  } catch (error) {
    console.error("Get WooCommerce store info error:", error);
    res.status(500).json({
      error: "Failed to get store information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Sync WooCommerce data
router.post("/sync/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "woocommerce") {
      return res.status(404).json({ error: "WooCommerce integration not found" });
    }

    // Trigger data sync
    await wooCommerceService.syncStoreData(
      integration.metadata.storeUrl,
      integration.accessToken,
      integration.refreshToken || '',
      userId
    );

    res.json({ success: true, message: "Data sync initiated" });
  } catch (error) {
    console.error("WooCommerce sync error:", error);
    res.status(500).json({
      error: "Failed to sync store data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get WooCommerce products
router.get("/products/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { page = 1, per_page = 20 } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "woocommerce") {
      return res.status(404).json({ error: "WooCommerce integration not found" });
    }

    const products = await wooCommerceService.getProducts(
      integration.metadata.storeUrl,
      integration.accessToken,
      integration.refreshToken || '',
      {
        page: Number(page),
        per_page: Number(per_page),
      }
    );

    res.json(products);
  } catch (error) {
    console.error("Get WooCommerce products error:", error);
    res.status(500).json({
      error: "Failed to get products",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get WooCommerce orders
router.get("/orders/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { page = 1, per_page = 20, status } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "woocommerce") {
      return res.status(404).json({ error: "WooCommerce integration not found" });
    }

    const orders = await wooCommerceService.getOrders(
      integration.metadata.storeUrl,
      integration.accessToken,
      integration.refreshToken || '',
      {
        page: Number(page),
        per_page: Number(per_page),
        status: status as string,
      }
    );

    res.json(orders);
  } catch (error) {
    console.error("Get WooCommerce orders error:", error);
    res.status(500).json({
      error: "Failed to get orders",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
