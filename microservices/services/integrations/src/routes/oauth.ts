import { Router, Request, Response } from "express";
import { IntegrationService } from "../services/integration-service";
import { OAuthService } from "../services/oauth-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const integrationService = new IntegrationService();
const oauthService = new OAuthService();

// Validation schemas
const oauthInitiateSchema = z.object({
  provider: z.enum(["shopify", "google", "facebook", "stripe", "zapier"]),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  state: z.string().optional(),
});

const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// Initiate OAuth flow
router.post(
  "/initiate",
  authMiddleware,
  validateRequest(oauthInitiateSchema),
  async (req: Request, res: Response) => {
    try {
      const { provider, redirectUri, scopes, state } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Generate OAuth URL
      const authUrl = await oauthService.generateAuthUrl({
        provider,
        userId,
        redirectUri,
        scopes,
        state,
      });

      res.json({
        authUrl,
        provider,
        message: "Please complete OAuth authorization",
      });
    } catch (error) {
      console.error("OAuth initiate error:", error);
      res.status(500).json({
        error: "Failed to initiate OAuth flow",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Handle OAuth callback
router.get("/callback/:provider", async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errorUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/${provider}/error?error=${error}&description=${error_description}`;
      return res.redirect(errorUrl);
    }

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    // Exchange code for tokens
    const tokenData = await oauthService.exchangeCodeForTokens({
      provider,
      code: code as string,
      state: state as string,
    });

    // Store the integration
    const integration = await integrationService.createIntegration({
      userId: tokenData.userId,
      provider,
      providerAccountId: tokenData.accountId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      scope: tokenData.scope,
      metadata: tokenData.metadata,
    });

    // Redirect to success page
    const successUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/${provider}/success?integration_id=${integration.id}`;
    res.redirect(successUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const errorUrl = `${process.env.FRONTEND_URL}/dashboard/integrations/${req.params.provider}/error`;
    res.redirect(errorUrl);
  }
});

// Refresh OAuth token
router.post("/refresh/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    if (!integration.refreshToken) {
      return res.status(400).json({ error: "No refresh token available" });
    }

    // Refresh the token
    const newTokenData = await oauthService.refreshToken({
      provider: integration.provider,
      refreshToken: integration.refreshToken,
      integrationId,
    });

    // Update integration with new tokens
    await integrationService.updateIntegration(integrationId, {
      accessToken: newTokenData.accessToken,
      refreshToken: newTokenData.refreshToken,
      expiresAt: newTokenData.expiresAt,
    });

    res.json({
      success: true,
      message: "Token refreshed successfully",
      expiresAt: newTokenData.expiresAt,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: "Failed to refresh token",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Revoke OAuth token
router.post("/revoke/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Revoke the token
    await oauthService.revokeToken({
      provider: integration.provider,
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
    });

    // Delete the integration
    await integrationService.deleteIntegration(integrationId, userId);

    res.json({
      success: true,
      message: "Integration revoked and deleted successfully",
    });
  } catch (error) {
    console.error("Token revoke error:", error);
    res.status(500).json({
      error: "Failed to revoke token",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get OAuth provider info
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const providers = await oauthService.getSupportedProviders();

    res.json({
      providers,
      count: providers.length,
    });
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({
      error: "Failed to get provider information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get OAuth provider configuration
router.get("/providers/:provider", async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const config = await oauthService.getProviderConfig(provider);

    if (!config) {
      return res.status(404).json({ error: "Provider not found" });
    }

    res.json(config);
  } catch (error) {
    console.error("Get provider config error:", error);
    res.status(500).json({
      error: "Failed to get provider configuration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Validate OAuth token
router.post("/validate/:integrationId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const integration = await integrationService.getIntegration(integrationId, userId);

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Validate the token
    const isValid = await oauthService.validateToken({
      integrationId: integration.id,
      provider: integration.provider,
      accessToken: integration.accessToken,
    });

    res.json({
      valid: isValid,
      provider: integration.provider,
      expiresAt: integration.expiresAt,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(500).json({
      error: "Failed to validate token",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get OAuth scopes for provider
router.get("/scopes/:provider", async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const scopes = await oauthService.getAvailableScopes(provider);

    res.json({
      provider,
      scopes,
    });
  } catch (error) {
    console.error("Get scopes error:", error);
    res.status(500).json({
      error: "Failed to get available scopes",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
