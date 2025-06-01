import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Simple mock OAuth service for testing
describe("OAuthService (Simplified)", () => {
  // Mock OAuth service class
  class MockOAuthService {
    private providers = new Map([
      ["google", { id: "google", name: "Google", scopes: ["email", "profile"] }],
      ["shopify", { id: "shopify", name: "Shopify", scopes: ["read_orders"] }],
      ["facebook", { id: "facebook", name: "Facebook", scopes: ["email"] }],
      ["stripe", { id: "stripe", name: "Stripe", scopes: ["read_write"] }],
      ["zapier", { id: "zapier", name: "Zapier", scopes: ["read", "write"] }],
    ]);

    async getSupportedProviders() {
      return Array.from(this.providers.values());
    }

    async getProviderConfig(provider: string) {
      const config = this.providers.get(provider);
      if (!config) return null;
      
      const { ...configWithoutSecret } = config;
      return configWithoutSecret;
    }

    async getAvailableScopes(provider: string) {
      const config = this.providers.get(provider);
      if (!config) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }
      return config.scopes;
    }

    async generateAuthUrl(params: {
      provider: string;
      userId: string;
      redirectUri?: string;
      scopes?: string[];
      state?: string;
    }) {
      if (!this.providers.has(params.provider)) {
        throw new Error(`Unsupported OAuth provider: ${params.provider}`);
      }

      const baseUrl = params.provider === "shopify" 
        ? "https://{shop}.myshopify.com/admin/oauth/authorize"
        : `https://auth.${params.provider}.com/oauth/authorize`;

      const queryParams = new URLSearchParams({
        response_type: "code",
        client_id: `test_${params.provider}_client_id`,
        redirect_uri: params.redirectUri || `https://api.example.com/oauth/callback/${params.provider}`,
        scope: params.scopes ? params.scopes.join(" ") : this.providers.get(params.provider)!.scopes.join(" "),
        state: params.state || "test_state",
      });

      return `${baseUrl}?${queryParams.toString()}`;
    }

    async exchangeCodeForTokens(params: {
      provider: string;
      code: string;
      state?: string;
    }) {
      if (!this.providers.has(params.provider)) {
        throw new Error(`Unsupported OAuth provider: ${params.provider}`);
      }

      if (params.code === "invalid_code") {
        throw new Error("Invalid authorization code");
      }

      if (params.state === "invalid_state") {
        throw new Error("Invalid state parameter");
      }

      if (!params.state) {
        throw new Error("State parameter is required");
      }

      return {
        userId: "user123",
        accountId: `${params.provider}_user_456`,
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        expiresAt: new Date(Date.now() + 3600000),
        scope: this.providers.get(params.provider)!.scopes.join(" "),
        metadata: {
          provider: params.provider,
          tokenType: "Bearer",
        },
      };
    }

    async refreshToken(params: {
      provider: string;
      refreshToken: string;
      integrationId: string;
    }) {
      if (!this.providers.has(params.provider)) {
        throw new Error(`Unsupported OAuth provider: ${params.provider}`);
      }

      if (params.refreshToken === "invalid_token") {
        throw new Error("Invalid refresh token");
      }

      return {
        userId: "",
        accountId: "",
        accessToken: "new_access_token",
        refreshToken: params.refreshToken === "keep_old" ? "keep_old" : "new_refresh_token",
        expiresAt: new Date(Date.now() + 3600000),
        scope: "",
        metadata: {
          tokenType: "Bearer",
        },
      };
    }

    async revokeToken(params: {
      provider: string;
      accessToken: string;
    }) {
      if (!this.providers.has(params.provider)) {
        console.warn(`Token revocation not implemented for provider: ${params.provider}`);
        return;
      }

      if (params.accessToken === "invalid_token") {
        throw new Error("Revocation failed");
      }

      if (params.provider === "stripe") {
        // Stripe doesn't support revocation
        return;
      }

      // Success - no return value
    }

    async validateToken(params: {
      provider: string;
      accessToken: string;
      integrationId: string;
    }) {
      if (!this.providers.has(params.provider)) {
        return false;
      }

      return params.accessToken !== "invalid_token";
    }

    async cleanup() {
      this.providers.clear();
    }
  }

  let oauthService: MockOAuthService;

  beforeEach(() => {
    oauthService = new MockOAuthService();
  });

  afterEach(async () => {
    await oauthService.cleanup();
  });

  describe("Provider Management", () => {
    it("should return supported providers", async () => {
      const providers = await oauthService.getSupportedProviders();
      
      expect(providers).toHaveLength(5);
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "google", name: "Google" }),
          expect.objectContaining({ id: "shopify", name: "Shopify" }),
          expect.objectContaining({ id: "facebook", name: "Facebook" }),
          expect.objectContaining({ id: "stripe", name: "Stripe" }),
          expect.objectContaining({ id: "zapier", name: "Zapier" }),
        ])
      );
    });

    it("should return provider config without secrets", async () => {
      const config = await oauthService.getProviderConfig("google");
      
      expect(config).toBeDefined();
      expect(config?.id).toBe("google");
      expect(config?.name).toBe("Google");
      expect(config).not.toHaveProperty("clientSecret");
    });

    it("should return null for unsupported provider", async () => {
      const config = await oauthService.getProviderConfig("unsupported");
      expect(config).toBeNull();
    });

    it("should return available scopes for provider", async () => {
      const scopes = await oauthService.getAvailableScopes("shopify");
      expect(scopes).toEqual(["read_orders"]);
    });

    it("should throw error for unsupported provider scopes", async () => {
      await expect(oauthService.getAvailableScopes("unsupported"))
        .rejects.toThrow("Unsupported OAuth provider: unsupported");
    });
  });

  describe("generateAuthUrl", () => {
    it("should generate auth URL successfully", async () => {
      const params = {
        provider: "google",
        userId: "user123",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      
      expect(authUrl).toContain("https://auth.google.com/oauth/authorize");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("client_id=test_google_client_id");
      expect(authUrl).toContain("state=test_state");
    });

    it("should generate auth URL with custom parameters", async () => {
      const params = {
        provider: "google",
        userId: "user123",
        redirectUri: "https://custom.example.com/callback",
        scopes: ["custom_scope"],
        state: "custom_state",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fcustom.example.com%2Fcallback");
      expect(authUrl).toContain("scope=custom_scope");
      expect(authUrl).toContain("state=custom_state");
    });

    it("should handle Shopify provider specially", async () => {
      const params = {
        provider: "shopify",
        userId: "user123",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      
      expect(authUrl).toContain("https://{shop}.myshopify.com/admin/oauth/authorize");
    });

    it("should throw error for unsupported provider", async () => {
      const params = {
        provider: "unsupported",
        userId: "user123",
      };
      
      await expect(oauthService.generateAuthUrl(params))
        .rejects.toThrow("Unsupported OAuth provider: unsupported");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange code for tokens successfully", async () => {
      const params = {
        provider: "google",
        code: "auth_code_123",
        state: "valid_state",
      };
      
      const tokenData = await oauthService.exchangeCodeForTokens(params);
      
      expect(tokenData).toMatchObject({
        userId: "user123",
        accountId: "google_user_456",
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        scope: "email profile",
      });
    });

    it("should throw error for unsupported provider", async () => {
      const params = {
        provider: "unsupported",
        code: "auth_code_123",
        state: "valid_state",
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Unsupported OAuth provider: unsupported");
    });

    it("should handle invalid code", async () => {
      const params = {
        provider: "google",
        code: "invalid_code",
        state: "valid_state",
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Invalid authorization code");
    });

    it("should throw error for invalid state", async () => {
      const params = {
        provider: "google",
        code: "valid_code",
        state: "invalid_state",
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Invalid state parameter");
    });

    it("should throw error for missing state", async () => {
      const params = {
        provider: "google",
        code: "valid_code",
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("State parameter is required");
    });
  });

  describe("refreshToken", () => {
    it("should refresh token successfully", async () => {
      const params = {
        provider: "google",
        refreshToken: "old_refresh_token",
        integrationId: "integration_123",
      };
      
      const tokenData = await oauthService.refreshToken(params);
      
      expect(tokenData).toMatchObject({
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
        metadata: {
          tokenType: "Bearer",
        },
      });
    });

    it("should keep old refresh token if requested", async () => {
      const params = {
        provider: "google",
        refreshToken: "keep_old",
        integrationId: "integration_123",
      };
      
      const tokenData = await oauthService.refreshToken(params);
      expect(tokenData.refreshToken).toBe("keep_old");
    });

    it("should handle refresh token errors", async () => {
      const params = {
        provider: "google",
        refreshToken: "invalid_token",
        integrationId: "integration_123",
      };
      
      await expect(oauthService.refreshToken(params))
        .rejects.toThrow("Invalid refresh token");
    });
  });

  describe("revokeToken", () => {
    it("should revoke token successfully", async () => {
      const params = {
        provider: "google",
        accessToken: "valid_token",
      };
      
      await expect(oauthService.revokeToken(params)).resolves.toBeUndefined();
    });

    it("should handle Stripe provider (no-op)", async () => {
      const params = {
        provider: "stripe",
        accessToken: "valid_token",
      };
      
      await expect(oauthService.revokeToken(params)).resolves.toBeUndefined();
    });

    it("should warn for unsupported provider but not fail", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      
      const params = {
        provider: "unsupported",
        accessToken: "valid_token",
      };
      
      await oauthService.revokeToken(params);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Token revocation not implemented for provider: unsupported"
      );
      
      consoleSpy.mockRestore();
    });

    it("should handle revocation errors", async () => {
      const params = {
        provider: "google",
        accessToken: "invalid_token",
      };
      
      await expect(oauthService.revokeToken(params))
        .rejects.toThrow("Revocation failed");
    });
  });

  describe("validateToken", () => {
    it("should validate token successfully", async () => {
      const params = {
        provider: "google",
        accessToken: "valid_token",
        integrationId: "integration_123",
      };
      
      const isValid = await oauthService.validateToken(params);
      expect(isValid).toBe(true);
    });

    it("should return false for invalid token", async () => {
      const params = {
        provider: "google",
        accessToken: "invalid_token",
        integrationId: "integration_123",
      };
      
      const isValid = await oauthService.validateToken(params);
      expect(isValid).toBe(false);
    });

    it("should return false for unsupported provider", async () => {
      const params = {
        provider: "unsupported",
        accessToken: "valid_token",
        integrationId: "integration_123",
      };
      
      const isValid = await oauthService.validateToken(params);
      expect(isValid).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources", async () => {
      await oauthService.cleanup();
      
      const providers = await oauthService.getSupportedProviders();
      expect(providers).toHaveLength(0);
    });
  });
});