import { Router, Request, Response } from "express";
import { IntegrationService } from "../services/integration-service";
import { StripeService } from "../services/stripe-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const integrationService = new IntegrationService();
const stripeService = new StripeService();

// Validation schemas
const connectStripeSchema = z.object({
  accountId: z.string().optional(),
  authorizationCode: z.string().optional(),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
});

const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  type: z.string(),
  data: z.any(),
  created: z.number(),
});

// Connect Stripe account
router.post(
  "/connect",
  authMiddleware,
  validateRequest(connectStripeSchema),
  async (req: Request, res: Response) => {
    try {
      const { accountId, authorizationCode, refreshToken, scope } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let stripeAccountData;

      // If authorization code provided, exchange for access token
      if (authorizationCode) {
        stripeAccountData = await stripeService.exchangeCodeForToken(authorizationCode);
      } else if (accountId) {
        // Direct account connection
        stripeAccountData = await stripeService.getAccountInfo(accountId);
      } else {
        // Generate OAuth URL for Stripe Connect
        const authUrl = await stripeService.generateAuthUrl(userId);
        return res.json({
          authUrl,
          message: "Please complete Stripe Connect authorization",
        });
      }

      // Store the integration
      const integration = await integrationService.createIntegration({
        userId,
        provider: "stripe",
        providerAccountId: stripeAccountData.stripe_user_id || accountId,
        accessToken: stripeAccountData.access_token,
        refreshToken: stripeAccountData.refresh_token || refreshToken,
        expiresAt: null,
        scope: stripeAccountData.scope || scope,
        metadata: {
          accountId: stripeAccountData.stripe_user_id || accountId,
          publishableKey: stripeAccountData.stripe_publishable_key,
          accountType: stripeAccountData.account_type,
          country: stripeAccountData.country,
          currency: stripeAccountData.default_currency,
          businessName: stripeAccountData.business_name,
          email: stripeAccountData.email,
        },
      });

      // Set up webhooks
      await stripeService.setupWebhooks(stripeAccountData.stripe_user_id || accountId);

      res.json({
        success: true,
        integration: {
          id: integration.id,
          provider: integration.provider,
          accountId: stripeAccountData.stripe_user_id || accountId,
          businessName: stripeAccountData.business_name,
          connectedAt: integration.createdAt,
        },
      });
    } catch (error) {
      console.error("Stripe connection error:", error);
      res.status(500).json({
        error: "Failed to connect Stripe account",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Handle OAuth callback
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const errorUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/stripe/error?error=${error}`;
      return res.redirect(errorUrl);
    }

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    // Exchange code for access token
    const tokenData = await stripeService.exchangeCodeForToken(code as string);

    // Redirect to frontend with success
    const redirectUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/stripe/success?account_id=${tokenData.stripe_user_id}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Stripe OAuth callback error:", error);
    const errorUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/stripe/error`;
    res.redirect(errorUrl);
  }
});

// Disconnect Stripe account
router.delete("/disconnect/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "stripe") {
      return res.status(404).json({ error: "Stripe integration not found" });
    }

    // Revoke access token
    await stripeService.revokeAccess(integration.metadata.accountId);

    // Delete integration
    await integrationService.deleteIntegration(integrationId, userId);

    res.json({ success: true, message: "Stripe integration disconnected" });
  } catch (error) {
    console.error("Stripe disconnection error:", error);
    res.status(500).json({
      error: "Failed to disconnect Stripe account",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get Stripe account info
router.get("/account/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "stripe") {
      return res.status(404).json({ error: "Stripe integration not found" });
    }

    const accountInfo = await stripeService.getAccountInfo(integration.metadata.accountId);

    res.json(accountInfo);
  } catch (error) {
    console.error("Get Stripe account info error:", error);
    res.status(500).json({
      error: "Failed to get account information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get Stripe payments
router.get("/payments/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { limit = 20, starting_after, ending_before } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "stripe") {
      return res.status(404).json({ error: "Stripe integration not found" });
    }

    const payments = await stripeService.getPayments(integration.metadata.accountId, {
      limit: Number(limit),
      starting_after: starting_after as string,
      ending_before: ending_before as string,
    });

    res.json(payments);
  } catch (error) {
    console.error("Get Stripe payments error:", error);
    res.status(500).json({
      error: "Failed to get payments",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get Stripe customers
router.get("/customers/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const { limit = 20, starting_after, ending_before } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "stripe") {
      return res.status(404).json({ error: "Stripe integration not found" });
    }

    const customers = await stripeService.getCustomers(integration.metadata.accountId, {
      limit: Number(limit),
      starting_after: starting_after as string,
      ending_before: ending_before as string,
    });

    res.json(customers);
  } catch (error) {
    console.error("Get Stripe customers error:", error);
    res.status(500).json({
      error: "Failed to get customers",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Sync Stripe data
router.post("/sync/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration || integration.provider !== "stripe") {
      return res.status(404).json({ error: "Stripe integration not found" });
    }

    // Trigger data sync
    await stripeService.syncAccountData(integration.metadata.accountId, userId);

    res.json({ success: true, message: "Data sync initiated" });
  } catch (error) {
    console.error("Stripe sync error:", error);
    res.status(500).json({
      error: "Failed to sync account data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
