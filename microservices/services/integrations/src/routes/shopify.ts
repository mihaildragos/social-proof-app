import { Router, Request, Response } from "express";
import { IntegrationService } from "../services/integration-service";
import { ShopifyService } from "../services/shopify-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const integrationService = new IntegrationService();
const shopifyService = new ShopifyService();

// Validation schemas
const connectShopifySchema = z.object({
  shop: z.string().min(1, "Shop domain is required"),
  accessToken: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

const shopifyWebhookSchema = z.object({
  topic: z.string(),
  shop_domain: z.string(),
  payload: z.any(),
});

// Connect Shopify store
router.post(
  "/connect",
  authMiddleware,
  validateRequest(connectShopifySchema),
  async (req: Request, res: Response) => {
    try {
      const { shop, accessToken, scopes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // If no access token provided, initiate OAuth flow
      if (!accessToken) {
        const authUrl = await shopifyService.generateAuthUrl(shop, scopes);
        return res.json({
          authUrl,
          message: "Please complete OAuth authorization",
        });
      }

      // Validate the access token and get shop info
      const shopInfo = await shopifyService.validateConnection(shop, accessToken);

      // Store the integration
      const integration = await integrationService.createIntegration({
        userId,
        provider: "shopify",
        providerAccountId: shopInfo.id.toString(),
        accessToken,
        refreshToken: null,
        expiresAt: null,
        scope: scopes?.join(","),
        metadata: {
          shop: shopInfo.domain,
          shopName: shopInfo.name,
          email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
        },
      });

      // Set up webhooks
      await shopifyService.setupWebhooks(shop, accessToken);

      res.json({
        success: true,
        integration: {
          id: integration.id,
          provider: integration.provider,
          shop: shopInfo.domain,
          shopName: shopInfo.name,
          connectedAt: integration.createdAt,
        },
      });
    } catch (error) {
      console.error("Shopify connection error:", error);
      res.status(500).json({
        error: "Failed to connect Shopify store",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Handle OAuth callback
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, shop, state } = req.query;

    if (!code || !shop) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Exchange code for access token
    const tokenData = await shopifyService.exchangeCodeForToken(shop as string, code as string);

    // Redirect to frontend with token data
    const redirectUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/shopify/success?token=${tokenData.access_token}&shop=${shop}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    const errorUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/shopify/error`;
    res.redirect(errorUrl);
  }
});

// Disconnect Shopify store
router.delete("/disconnect/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    await integrationService.deleteIntegration(integrationId, userId);

    res.json({ success: true, message: "Shopify integration disconnected" });
  } catch (error) {
    console.error("Shopify disconnection error:", error);
    res.status(500).json({
      error: "Failed to disconnect Shopify store",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get Shopify store info
router.get("/store/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "shopify") {
      return res.status(404).json({ error: "Shopify integration not found" });
    }

    const storeInfo = await shopifyService.getStoreInfo(
      integration.metadata.shop,
      integration.accessToken
    );

    res.json(storeInfo);
  } catch (error) {
    console.error("Get Shopify store info error:", error);
    res.status(500).json({
      error: "Failed to get store information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Sync Shopify data
router.post("/sync/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "shopify") {
      return res.status(404).json({ error: "Shopify integration not found" });
    }

    // Trigger data sync
    await shopifyService.syncStoreData(integration.metadata.shop, integration.accessToken, userId);

    res.json({ success: true, message: "Data sync initiated" });
  } catch (error) {
    console.error("Shopify sync error:", error);
    res.status(500).json({
      error: "Failed to sync store data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
