import { EventEmitter } from "events";
import axios from "axios";
import crypto from "crypto";

export interface OAuthProvider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

export interface OAuthTokenData {
  userId: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string;
  metadata: Record<string, any>;
}

export interface GenerateAuthUrlParams {
  provider: string;
  userId: string;
  redirectUri?: string;
  scopes?: string[];
  state?: string;
}

export interface ExchangeTokenParams {
  provider: string;
  code: string;
  state?: string;
}

export interface RefreshTokenParams {
  provider: string;
  refreshToken: string;
  integrationId: string;
}

export interface RevokeTokenParams {
  provider: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ValidateTokenParams {
  provider: string;
  accessToken: string;
  integrationId: string;
}

export class OAuthService extends EventEmitter {
  private providers: Map<string, OAuthProvider> = new Map();

  constructor() {
    super();
    this.initializeProviders();
  }

  /**
   * Initialize OAuth providers configuration
   */
  private initializeProviders(): void {
    const providers: OAuthProvider[] = [
      {
        id: "shopify",
        name: "Shopify",
        authUrl: "https://{shop}.myshopify.com/admin/oauth/authorize",
        tokenUrl: "https://{shop}.myshopify.com/admin/oauth/access_token",
        clientId: process.env.SHOPIFY_CLIENT_ID || "",
        clientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
        scopes: ["read_products", "read_orders", "read_customers", "write_script_tags"],
        redirectUri: `${process.env.API_BASE_URL}/api/integrations/oauth/callback/shopify`,
      },
      {
        id: "google",
        name: "Google",
        authUrl: "https://accounts.google.com/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        scopes: [
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
        redirectUri: `${process.env.API_BASE_URL}/api/integrations/oauth/callback/google`,
      },
      {
        id: "facebook",
        name: "Facebook",
        authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
        clientId: process.env.FACEBOOK_CLIENT_ID || "",
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
        scopes: ["email", "public_profile"],
        redirectUri: `${process.env.API_BASE_URL}/api/integrations/oauth/callback/facebook`,
      },
      {
        id: "stripe",
        name: "Stripe",
        authUrl: "https://connect.stripe.com/oauth/authorize",
        tokenUrl: "https://connect.stripe.com/oauth/token",
        clientId: process.env.STRIPE_CLIENT_ID || "",
        clientSecret: process.env.STRIPE_CLIENT_SECRET || "",
        scopes: ["read_write"],
        redirectUri: `${process.env.API_BASE_URL}/api/integrations/oauth/callback/stripe`,
      },
      {
        id: "zapier",
        name: "Zapier",
        authUrl: "https://zapier.com/oauth/authorize",
        tokenUrl: "https://zapier.com/oauth/access_token",
        clientId: process.env.ZAPIER_CLIENT_ID || "",
        clientSecret: process.env.ZAPIER_CLIENT_SECRET || "",
        scopes: ["read", "write"],
        redirectUri: `${process.env.API_BASE_URL}/api/integrations/oauth/callback/zapier`,
      },
    ];

    providers.forEach((provider) => {
      this.providers.set(provider.id, provider);
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(params: GenerateAuthUrlParams): Promise<string> {
    try {
      const { provider, userId, redirectUri, scopes, state } = params;

      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      const authState = state || this.generateState(userId);
      const authScopes = scopes || providerConfig.scopes;
      const finalRedirectUri = redirectUri || providerConfig.redirectUri;

      const authParams = new URLSearchParams({
        response_type: "code",
        client_id: providerConfig.clientId,
        redirect_uri: finalRedirectUri,
        scope: authScopes.join(" "),
        state: authState,
      });

      // Handle provider-specific parameters
      if (provider === "shopify") {
        // Shopify requires shop parameter to be handled separately
        const authUrl = `${providerConfig.authUrl}?${authParams.toString()}`;
        this.emit("auth:url_generated", { provider, userId, authUrl });
        return authUrl;
      }

      const authUrl = `${providerConfig.authUrl}?${authParams.toString()}`;

      this.emit("auth:url_generated", { provider, userId, authUrl });
      return authUrl;
    } catch (error) {
      this.emit("auth:url_failed", { provider: params.provider, userId: params.userId, error });
      throw new Error(
        `Failed to generate auth URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(params: ExchangeTokenParams): Promise<OAuthTokenData> {
    try {
      const { provider, code, state } = params;

      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      const tokenParams = {
        grant_type: "authorization_code",
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        redirect_uri: providerConfig.redirectUri,
      };

      const response = await axios.post(providerConfig.tokenUrl, tokenParams, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      });

      const tokenData = response.data;
      const userId = this.extractUserIdFromState(state);

      // Get user info from provider
      const userInfo = await this.getUserInfo(provider, tokenData.access_token);

      const oauthTokenData: OAuthTokenData = {
        userId,
        accountId: userInfo.id || userInfo.sub || userInfo.user_id || "unknown",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:
          tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
        scope: tokenData.scope || providerConfig.scopes.join(" "),
        metadata: {
          ...userInfo,
          tokenType: tokenData.token_type,
        },
      };

      this.emit("token:exchanged", { provider, userId, tokenData: oauthTokenData });
      return oauthTokenData;
    } catch (error) {
      this.emit("token:exchange_failed", { provider: params.provider, code: params.code, error });
      throw new Error(
        `Failed to exchange code for tokens: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(params: RefreshTokenParams): Promise<OAuthTokenData> {
    try {
      const { provider, refreshToken, integrationId } = params;

      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      const tokenParams = {
        grant_type: "refresh_token",
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        refresh_token: refreshToken,
      };

      const response = await axios.post(providerConfig.tokenUrl, tokenParams, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      });

      const tokenData = response.data;

      const refreshedTokenData: OAuthTokenData = {
        userId: "", // Will be filled by caller
        accountId: "", // Will be filled by caller
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt:
          tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
        scope: tokenData.scope || "",
        metadata: {
          tokenType: tokenData.token_type,
        },
      };

      this.emit("token:refreshed", { provider, integrationId, tokenData: refreshedTokenData });
      return refreshedTokenData;
    } catch (error) {
      this.emit("token:refresh_failed", {
        provider: params.provider,
        integrationId: params.integrationId,
        error,
      });
      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(params: RevokeTokenParams): Promise<void> {
    try {
      const { provider, accessToken, refreshToken } = params;

      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      // Provider-specific revocation
      switch (provider) {
        case "google":
          await axios.post(`https://oauth2.googleapis.com/revoke?token=${accessToken}`);
          break;
        case "facebook":
          await axios.delete(
            `https://graph.facebook.com/me/permissions?access_token=${accessToken}`
          );
          break;
        case "stripe":
          // Stripe revocation is handled by StripeService
          break;
        default:
          console.warn(`Token revocation not implemented for provider: ${provider}`);
      }

      this.emit("token:revoked", { provider, accessToken });
    } catch (error) {
      this.emit("token:revoke_failed", { provider: params.provider, error });
      throw new Error(
        `Failed to revoke token: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get supported OAuth providers
   */
  async getSupportedProviders(): Promise<Array<{ id: string; name: string; scopes: string[] }>> {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      name: provider.name,
      scopes: provider.scopes,
    }));
  }

  /**
   * Get provider configuration
   */
  async getProviderConfig(provider: string): Promise<Omit<OAuthProvider, "clientSecret"> | null> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      return null;
    }

    const { clientSecret, ...config } = providerConfig;
    return config;
  }

  /**
   * Validate OAuth token
   */
  async validateToken(params: ValidateTokenParams): Promise<boolean> {
    try {
      const { provider, accessToken } = params;

      // Try to get user info with the token
      await this.getUserInfo(provider, accessToken);
      return true;
    } catch (error) {
      this.emit("token:validation_failed", {
        provider: params.provider,
        integrationId: params.integrationId,
        error,
      });
      return false;
    }
  }

  /**
   * Get available scopes for provider
   */
  async getAvailableScopes(provider: string): Promise<string[]> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    return providerConfig.scopes;
  }

  /**
   * Get user information from provider
   */
  private async getUserInfo(provider: string, accessToken: string): Promise<any> {
    try {
      let userInfoUrl: string;
      let headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      switch (provider) {
        case "google":
          userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
          break;
        case "facebook":
          userInfoUrl = "https://graph.facebook.com/me?fields=id,name,email";
          break;
        case "shopify":
          // Shopify doesn't have a standard user info endpoint
          return { id: "shopify_user", name: "Shopify User" };
        case "stripe":
          // Stripe user info is handled differently
          return { id: "stripe_user", name: "Stripe User" };
        case "zapier":
          userInfoUrl = "https://zapier.com/api/v1/me";
          break;
        default:
          throw new Error(`User info not supported for provider: ${provider}`);
      }

      const response = await axios.get(userInfoUrl, { headers });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get user info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate state parameter for OAuth flow
   */
  private generateState(userId: string): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString("hex");
    return Buffer.from(`${userId}:${timestamp}:${random}`).toString("base64");
  }

  /**
   * Extract user ID from state parameter
   */
  private extractUserIdFromState(state?: string): string {
    if (!state) {
      throw new Error("State parameter is required");
    }

    try {
      const decoded = Buffer.from(state, "base64").toString("utf8");
      const [userId] = decoded.split(":");
      return userId;
    } catch (error) {
      throw new Error("Invalid state parameter");
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.providers.clear();
    this.removeAllListeners();
  }
}
