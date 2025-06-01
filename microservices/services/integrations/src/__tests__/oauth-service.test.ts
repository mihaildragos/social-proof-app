import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import axios from "axios";
import { OAuthService, GenerateAuthUrlParams, ExchangeTokenParams, RefreshTokenParams, RevokeTokenParams, ValidateTokenParams } from "../services/oauth-service";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("OAuthService", () => {
  let oauthService: OAuthService;
  let mockEventListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    oauthService = new OAuthService();
    mockEventListener = jest.fn();
    
    // Set up environment variables for testing
    process.env.SHOPIFY_CLIENT_ID = "test_shopify_client_id";
    process.env.SHOPIFY_CLIENT_SECRET = "test_shopify_client_secret";
    process.env.GOOGLE_CLIENT_ID = "test_google_client_id";
    process.env.GOOGLE_CLIENT_SECRET = "test_google_client_secret";
    process.env.STRIPE_CLIENT_ID = "test_stripe_client_id";
    process.env.STRIPE_CLIENT_SECRET = "test_stripe_client_secret";
    process.env.API_BASE_URL = "https://api.example.com";
  });

  afterEach(async () => {
    await oauthService.cleanup();
    jest.restoreAllMocks();
  });

  describe("Provider Management", () => {
    it("should return supported providers", async () => {
      const providers = await oauthService.getSupportedProviders();
      
      expect(providers).toHaveLength(5);
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "shopify", name: "Shopify" }),
          expect.objectContaining({ id: "google", name: "Google" }),
          expect.objectContaining({ id: "facebook", name: "Facebook" }),
          expect.objectContaining({ id: "stripe", name: "Stripe" }),
          expect.objectContaining({ id: "zapier", name: "Zapier" }),
        ])
      );
    });

    it("should return provider config without client secret", async () => {
      const config = await oauthService.getProviderConfig("google");
      
      expect(config).toBeDefined();
      expect(config?.id).toBe("google");
      expect(config?.name).toBe("Google");
      expect(config?.authUrl).toBe("https://accounts.google.com/oauth2/v2/auth");
      expect(config?.clientId).toBe("test_google_client_id");
      expect(config).not.toHaveProperty("clientSecret");
    });

    it("should return null for unsupported provider", async () => {
      const config = await oauthService.getProviderConfig("unsupported");
      expect(config).toBeNull();
    });

    it("should return available scopes for provider", async () => {
      const scopes = await oauthService.getAvailableScopes("shopify");
      
      expect(scopes).toEqual([
        "read_products",
        "read_orders", 
        "read_customers",
        "write_script_tags"
      ]);
    });

    it("should throw error for unsupported provider scopes", async () => {
      await expect(oauthService.getAvailableScopes("unsupported"))
        .rejects.toThrow("Unsupported OAuth provider: unsupported");
    });
  });

  describe("generateAuthUrl", () => {
    it("should generate auth URL for Google", async () => {
      oauthService.on("auth:url_generated", mockEventListener);
      
      const params: GenerateAuthUrlParams = {
        provider: "google",
        userId: "user123",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      
      expect(authUrl).toContain("https://accounts.google.com/oauth2/v2/auth");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("client_id=test_google_client_id");
      expect(authUrl).toContain("redirect_uri=");
      expect(authUrl).toContain("scope=");
      expect(authUrl).toContain("state=");
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          userId: "user123",
          authUrl: expect.stringContaining("https://accounts.google.com")
        })
      );
    });

    it("should generate auth URL with custom parameters", async () => {
      const params: GenerateAuthUrlParams = {
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
      const params: GenerateAuthUrlParams = {
        provider: "shopify",
        userId: "user123",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      
      expect(authUrl).toContain("https://{shop}.myshopify.com/admin/oauth/authorize");
      expect(authUrl).toContain("client_id=test_shopify_client_id");
    });

    it("should throw error for unsupported provider", async () => {
      oauthService.on("auth:url_failed", mockEventListener);
      
      const params: GenerateAuthUrlParams = {
        provider: "unsupported",
        userId: "user123",
      };
      
      await expect(oauthService.generateAuthUrl(params))
        .rejects.toThrow("Failed to generate auth URL: Unsupported OAuth provider: unsupported");
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "unsupported",
          userId: "user123",
          error: expect.any(Error)
        })
      );
    });
  });

  describe("exchangeCodeForTokens", () => {
    const mockTokenResponse = {
      access_token: "access_token_123",
      refresh_token: "refresh_token_123",
      expires_in: 3600,
      scope: "read write",
      token_type: "Bearer"
    };

    const mockUserInfo = {
      id: "user_123",
      name: "Test User",
      email: "test@example.com"
    };

    beforeEach(() => {
      // Don't set up default mocks here - let each test set up its own mocks
      jest.clearAllMocks();
    });

    it("should exchange code for tokens successfully", async () => {
      // Set up mocks for this specific test
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });
      mockedAxios.get.mockResolvedValueOnce({ data: mockUserInfo });
      
      oauthService.on("token:exchanged", mockEventListener);
      
      const params: ExchangeTokenParams = {
        provider: "google",
        code: "auth_code_123",
        state: Buffer.from("user123:1234567890:random").toString("base64"),
      };
      
      const tokenData = await oauthService.exchangeCodeForTokens(params);
      
      expect(tokenData).toEqual({
        userId: "user123",
        accountId: "user_123",
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        expiresAt: expect.any(Date),
        scope: "read write",
        metadata: {
          ...mockUserInfo,
          tokenType: "Bearer"
        }
      });
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          grant_type: "authorization_code",
          client_id: "test_google_client_id",
          client_secret: "test_google_client_secret",
          code: "auth_code_123",
          redirect_uri: expect.stringContaining("/oauth/callback/google")
        }),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          }
        })
      );
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          userId: "user123",
          tokenData: expect.objectContaining({
            accessToken: "access_token_123"
          })
        })
      );
    });

    it("should handle different user info response formats", async () => {
      // Reset mocks and set up fresh mocks for this test
      jest.clearAllMocks();
      
      // Mock token exchange first
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });
      
      // Test with 'sub' field (common in JWT)
      mockedAxios.get.mockResolvedValueOnce({ 
        data: { sub: "user_456", name: "Test User" }
      });
      
      const params: ExchangeTokenParams = {
        provider: "google",
        code: "auth_code_123",
        state: Buffer.from("user123:1234567890:random").toString("base64"),
      };
      
      const tokenData = await oauthService.exchangeCodeForTokens(params);
      expect(tokenData.accountId).toBe("user_456");
      expect(tokenData.metadata.sub).toBe("user_456");
      expect(tokenData.metadata.name).toBe("Test User");
    });

    it("should handle providers without user info endpoint", async () => {
      // Set up mock for token exchange (no user info call needed for shopify)
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });
      
      const params: ExchangeTokenParams = {
        provider: "shopify",
        code: "auth_code_123",
        state: Buffer.from("user123:1234567890:random").toString("base64"),
      };
      
      const tokenData = await oauthService.exchangeCodeForTokens(params);
      expect(tokenData.accountId).toBe("shopify_user");
      expect(tokenData.metadata.name).toBe("Shopify User");
    });

    it("should throw error for unsupported provider", async () => {
      oauthService.on("token:exchange_failed", mockEventListener);
      
      const params: ExchangeTokenParams = {
        provider: "unsupported",
        code: "auth_code_123",
        state: "valid_state",
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Failed to exchange code for tokens: Unsupported OAuth provider: unsupported");
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "unsupported",
          code: "auth_code_123",
          error: expect.any(Error)
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      // Reset mocks to clear previous setup
      jest.clearAllMocks();
      
      // Mock axios.post to reject with an error
      mockedAxios.post.mockRejectedValueOnce(new Error("API Error"));
      
      const params: ExchangeTokenParams = {
        provider: "google",
        code: "invalid_code",
        state: Buffer.from("user123:1234567890:random").toString("base64"),
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Failed to exchange code for tokens: API Error");
    });
  });

  describe("refreshToken", () => {
    const mockRefreshResponse = {
      access_token: "new_access_token",
      refresh_token: "new_refresh_token",
      expires_in: 3600,
      token_type: "Bearer"
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should refresh token successfully", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });
      
      oauthService.on("token:refreshed", mockEventListener);
      
      const params: RefreshTokenParams = {
        provider: "google",
        refreshToken: "old_refresh_token",
        integrationId: "integration_123",
      };
      
      const tokenData = await oauthService.refreshToken(params);
      
      expect(tokenData).toEqual({
        userId: "",
        accountId: "",
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
        expiresAt: expect.any(Date),
        scope: "",
        metadata: {
          tokenType: "Bearer"
        }
      });
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          grant_type: "refresh_token",
          client_id: "test_google_client_id",
          client_secret: "test_google_client_secret",
          refresh_token: "old_refresh_token"
        }),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          }
        })
      );
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          integrationId: "integration_123",
          tokenData: expect.objectContaining({
            accessToken: "new_access_token"
          })
        })
      );
    });

    it("should keep old refresh token if none provided", async () => {
      const responseWithoutRefreshToken = {
        access_token: "new_access_token",
        expires_in: 3600,
        token_type: "Bearer"
      };
      
      mockedAxios.post.mockResolvedValueOnce({ data: responseWithoutRefreshToken });
      
      const params: RefreshTokenParams = {
        provider: "google",
        refreshToken: "old_refresh_token",
        integrationId: "integration_123",
      };
      
      const tokenData = await oauthService.refreshToken(params);
      expect(tokenData.refreshToken).toBe("old_refresh_token");
    });

    it("should handle refresh token errors", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      oauthService.on("token:refresh_failed", mockEventListener);
      mockedAxios.post.mockRejectedValueOnce(new Error("Invalid refresh token"));
      
      const params: RefreshTokenParams = {
        provider: "google",
        refreshToken: "invalid_token",
        integrationId: "integration_123",
      };
      
      await expect(oauthService.refreshToken(params))
        .rejects.toThrow("Failed to refresh token: Invalid refresh token");
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          integrationId: "integration_123",
          error: expect.any(Error)
        })
      );
    });
  });

  describe("revokeToken", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should revoke Google token", async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      
      oauthService.on("token:revoked", mockEventListener);
      
      const params: RevokeTokenParams = {
        provider: "google",
        accessToken: "access_token_123",
      };
      
      await oauthService.revokeToken(params);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/revoke?token=access_token_123"
      );
      
      expect(mockEventListener).toHaveBeenCalledWith({
        provider: "google",
        accessToken: "access_token_123"
      });
    });

    it("should revoke Facebook token", async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });
      
      const params: RevokeTokenParams = {
        provider: "facebook",
        accessToken: "access_token_123",
      };
      
      await oauthService.revokeToken(params);
      
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        "https://graph.facebook.com/me/permissions?access_token=access_token_123"
      );
    });

    it("should handle Stripe provider (no-op)", async () => {
      const params: RevokeTokenParams = {
        provider: "stripe",
        accessToken: "access_token_123",
      };
      
      await expect(oauthService.revokeToken(params)).resolves.toBeUndefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(mockedAxios.delete).not.toHaveBeenCalled();
    });

    it("should warn for unsupported provider but not fail", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      
      const params: RevokeTokenParams = {
        provider: "unsupported",
        accessToken: "access_token_123",
      };
      
      await oauthService.revokeToken(params);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Token revocation not implemented for provider: unsupported"
      );
      
      consoleSpy.mockRestore();
    });

    it("should handle revocation errors", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      oauthService.on("token:revoke_failed", mockEventListener);
      mockedAxios.post.mockRejectedValueOnce(new Error("Revocation failed"));
      
      const params: RevokeTokenParams = {
        provider: "google",
        accessToken: "invalid_token",
      };
      
      await expect(oauthService.revokeToken(params))
        .rejects.toThrow("Failed to revoke token: Revocation failed");
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          error: expect.any(Error)
        })
      );
    });
  });

  describe("validateToken", () => {
    it("should validate token successfully", async () => {
      mockedAxios.get.mockResolvedValueOnce({ 
        data: { id: "user_123", name: "Test User" }
      });
      
      const params: ValidateTokenParams = {
        provider: "google",
        accessToken: "valid_token",
        integrationId: "integration_123",
      };
      
      const isValid = await oauthService.validateToken(params);
      expect(isValid).toBe(true);
    });

    it("should return false for invalid token", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      oauthService.on("token:validation_failed", mockEventListener);
      mockedAxios.get.mockRejectedValueOnce(new Error("Invalid token"));
      
      const params: ValidateTokenParams = {
        provider: "google",
        accessToken: "invalid_token",
        integrationId: "integration_123",
      };
      
      const isValid = await oauthService.validateToken(params);
      expect(isValid).toBe(false);
      
      expect(mockEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          integrationId: "integration_123",
          error: expect.any(Error)
        })
      );
    });
  });

  describe("State Management", () => {
    it("should generate and extract user ID from state", async () => {
      const params: GenerateAuthUrlParams = {
        provider: "google",
        userId: "user123",
      };
      
      const authUrl = await oauthService.generateAuthUrl(params);
      const urlParams = new URLSearchParams(authUrl.split("?")[1]);
      const state = urlParams.get("state");
      
      expect(state).toBeTruthy();
      
      // Test extraction by using the state in a token exchange
      const exchangeParams: ExchangeTokenParams = {
        provider: "google",
        code: "test_code",
        state: state!,
      };
      
      mockedAxios.post.mockResolvedValueOnce({ 
        data: { access_token: "token" }
      });
      mockedAxios.get.mockResolvedValueOnce({ 
        data: { id: "user_123" }
      });
      
      const tokenData = await oauthService.exchangeCodeForTokens(exchangeParams);
      expect(tokenData.userId).toBe("user123");
    });

    it("should throw error for invalid state format", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      
      const params: ExchangeTokenParams = {
        provider: "google",
        code: "test_code",
        state: "invalid!", // Contains character not allowed in base64
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("Invalid state parameter");
    });

    it("should throw error for missing state", async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      
      const params: ExchangeTokenParams = {
        provider: "google",
        code: "test_code",
        // state is undefined
      };
      
      await expect(oauthService.exchangeCodeForTokens(params))
        .rejects.toThrow("State parameter is required");
    });
  });

  describe("getUserInfo", () => {
    it("should get user info for different providers", async () => {
      const testCases = [
        {
          provider: "google",
          expectedUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
          response: { id: "123", name: "Google User" }
        },
        {
          provider: "facebook", 
          expectedUrl: "https://graph.facebook.com/me?fields=id,name,email",
          response: { id: "456", name: "Facebook User" }
        },
        {
          provider: "zapier",
          expectedUrl: "https://zapier.com/api/v1/me",
          response: { id: "789", name: "Zapier User" }
        }
      ];
      
      for (const testCase of testCases) {
        // Reset mocks for each test case
        jest.clearAllMocks();
        
        const params: ExchangeTokenParams = {
          provider: testCase.provider,
          code: "test_code",
          state: Buffer.from("user123:1234567890:random").toString("base64"),
        };
        
        mockedAxios.post.mockResolvedValueOnce({ 
          data: { access_token: "token" }
        });
        
        mockedAxios.get.mockResolvedValueOnce({ data: testCase.response });
        
        await oauthService.exchangeCodeForTokens(params);
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          testCase.expectedUrl,
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer token"
            })
          })
        );
      }
    });

    it("should handle providers without user info endpoints", async () => {
      const providers = ["shopify", "stripe"];
      
      for (const provider of providers) {
        // Reset mocks for each provider
        jest.clearAllMocks();
        
        const params: ExchangeTokenParams = {
          provider,
          code: "test_code",
          state: Buffer.from("user123:1234567890:random").toString("base64"),
        };
        
        mockedAxios.post.mockResolvedValueOnce({ 
          data: { access_token: "token" }
        });
        
        const tokenData = await oauthService.exchangeCodeForTokens(params);
        expect(tokenData.accountId).toMatch(/user$/);
      }
    });
  });

  describe("cleanup", () => {
    it("should clean up resources", async () => {
      oauthService.on("test", mockEventListener);
      
      await oauthService.cleanup();
      
      const providers = await oauthService.getSupportedProviders();
      expect(providers).toHaveLength(0);
      
      oauthService.emit("test");
      expect(mockEventListener).not.toHaveBeenCalled();
    });
  });
});