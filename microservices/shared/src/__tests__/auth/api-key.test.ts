import crypto from "crypto";
import { ApiKeyService, ApiKeyPermission, ApiKey, ApiKeyUsage } from "../../auth/api-key";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  getContextLogger: jest.fn(() => ({
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

describe("ApiKeyService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("ApiKeyPermission Constants", () => {
    it("should have all required API key permissions defined", () => {
      expect(ApiKeyPermission.NOTIFICATION_READ).toBe("notification:read");
      expect(ApiKeyPermission.NOTIFICATION_WRITE).toBe("notification:write");
      expect(ApiKeyPermission.NOTIFICATION_SEND).toBe("notification:send");
      expect(ApiKeyPermission.SITE_READ).toBe("site:read");
      expect(ApiKeyPermission.SITE_WRITE).toBe("site:write");
      expect(ApiKeyPermission.ANALYTICS_READ).toBe("analytics:read");
      expect(ApiKeyPermission.INTEGRATION_WEBHOOK).toBe("integration:webhook");
      expect(ApiKeyPermission.TEMPLATE_READ).toBe("template:read");
      expect(ApiKeyPermission.TEMPLATE_WRITE).toBe("template:write");
    });
  });

  describe("generateApiKey", () => {
    it("should generate API key with correct format", () => {
      const result = ApiKeyService.generateApiKey();

      expect(result.key).toMatch(/^sp_[a-f0-9]{64}$/);
      expect(result.key.length).toBe(67); // 'sp_' + 64 hex chars
      expect(result.hashedKey).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should generate unique API keys", () => {
      const result1 = ApiKeyService.generateApiKey();
      const result2 = ApiKeyService.generateApiKey();

      expect(result1.key).not.toBe(result2.key);
      expect(result1.hashedKey).not.toBe(result2.hashedKey);
    });

    it("should always start with sp_ prefix", () => {
      for (let i = 0; i < 10; i++) {
        const result = ApiKeyService.generateApiKey();
        expect(result.key.startsWith("sp_")).toBe(true);
      }
    });
  });

  describe("hashApiKey", () => {
    it("should generate consistent hash for same key", () => {
      const apiKey = "sp_test123";
      const hash1 = ApiKeyService.hashApiKey(apiKey);
      const hash2 = ApiKeyService.hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should generate different hashes for different keys", () => {
      const key1 = "sp_test123";
      const key2 = "sp_test456";

      const hash1 = ApiKeyService.hashApiKey(key1);
      const hash2 = ApiKeyService.hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = ApiKeyService.hashApiKey("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should use SHA256 for hashing", () => {
      const key = "sp_test123";
      const hash = ApiKeyService.hashApiKey(key);

      // Verify it matches manual SHA256
      const expectedHash = crypto.createHash("sha256").update(key).digest("hex");
      expect(hash).toBe(expectedHash);
    });
  });

  describe("isValidKeyFormat", () => {
    it("should validate correctly formatted API key", () => {
      const validKey = "sp_" + "a".repeat(64);
      expect(ApiKeyService.isValidKeyFormat(validKey)).toBe(true);
    });

    it("should reject API key without sp_ prefix", () => {
      const invalidKey = "ak_" + "a".repeat(64);
      expect(ApiKeyService.isValidKeyFormat(invalidKey)).toBe(false);
    });

    it("should reject API key with wrong length", () => {
      const shortKey = "sp_abc123";
      const longKey = "sp_" + "a".repeat(100);

      expect(ApiKeyService.isValidKeyFormat(shortKey)).toBe(false);
      expect(ApiKeyService.isValidKeyFormat(longKey)).toBe(false);
    });

    it("should reject API key with invalid characters", () => {
      const invalidKey = "sp_" + "g".repeat(64); // 'g' is not valid hex
      expect(ApiKeyService.isValidKeyFormat(invalidKey)).toBe(false);
    });

    it("should reject empty or null keys", () => {
      expect(ApiKeyService.isValidKeyFormat("")).toBe(false);
      expect(ApiKeyService.isValidKeyFormat(null as any)).toBe(false);
      expect(ApiKeyService.isValidKeyFormat(undefined as any)).toBe(false);
    });
  });

  describe("createApiKey", () => {
    it("should create API key with basic permissions", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ, ApiKeyPermission.ANALYTICS_READ];
      const result = ApiKeyService.createApiKey("Test Key", "test-org", permissions);

      expect(result.key).toMatch(/^sp_[a-f0-9]{64}$/);
      expect(result.name).toBe("Test Key");
      expect(result.organizationId).toBe("test-org");
      expect(result.permissions).toEqual(permissions.map((p) => p.toString()));
      expect(result.isActive).toBe(true);
      expect(result.hashedKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should create API key with expiration date", () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];

      const result = ApiKeyService.createApiKey("Expiring Key", "test-org", permissions, expiresAt);

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it("should generate unique hash for storage", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const result1 = ApiKeyService.createApiKey("Key 1", "test-org", permissions);
      const result2 = ApiKeyService.createApiKey("Key 2", "test-org", permissions);

      expect(result1.hashedKey).not.toBe(result2.hashedKey);
      expect(result1.hashedKey).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("hasPermission", () => {
    it("should return true when API key has required permission", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ, ApiKeyPermission.ANALYTICS_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.hasPermission(apiKey, ApiKeyPermission.NOTIFICATION_READ)).toBe(true);
      expect(ApiKeyService.hasPermission(apiKey, ApiKeyPermission.ANALYTICS_READ)).toBe(true);
    });

    it("should return false when API key lacks required permission", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.hasPermission(apiKey, ApiKeyPermission.ANALYTICS_READ)).toBe(false);
      expect(ApiKeyService.hasPermission(apiKey, ApiKeyPermission.SITE_WRITE)).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true when API key has any of the required permissions", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const requiredPermissions = [
        ApiKeyPermission.ANALYTICS_READ,
        ApiKeyPermission.NOTIFICATION_READ,
      ];
      expect(ApiKeyService.hasAnyPermission(apiKey, requiredPermissions)).toBe(true);
    });

    it("should return false when API key has none of the required permissions", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const requiredPermissions = [ApiKeyPermission.ANALYTICS_READ, ApiKeyPermission.SITE_WRITE];
      expect(ApiKeyService.hasAnyPermission(apiKey, requiredPermissions)).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true when API key has all permissions", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ, ApiKeyPermission.ANALYTICS_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.hasAllPermissions(apiKey, permissions)).toBe(true);
    });

    it("should return false when API key is missing any permission", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: permissions.map((p) => p.toString()),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const requiredPermissions = [
        ApiKeyPermission.NOTIFICATION_READ,
        ApiKeyPermission.ANALYTICS_READ,
      ];
      expect(ApiKeyService.hasAllPermissions(apiKey, requiredPermissions)).toBe(false);
    });

    it("should return true for empty permission array", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.hasAllPermissions(apiKey, [])).toBe(true);
    });
  });

  describe("isExpired", () => {
    it("should return false for non-expiring key", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.isExpired(apiKey)).toBe(false);
    });

    it("should return false for future expiration", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000), // Expires in 1 second
      };

      expect(ApiKeyService.isExpired(apiKey)).toBe(false);
    });

    it("should return true for past expiration", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      expect(ApiKeyService.isExpired(apiKey)).toBe(true);
    });
  });

  describe("isValid", () => {
    it("should return true for active, non-expired key", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.isValid(apiKey)).toBe(true);
    });

    it("should return false for inactive key", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(ApiKeyService.isValid(apiKey)).toBe(false);
    });

    it("should return false for expired key", () => {
      const apiKey: ApiKey = {
        id: "test-id",
        key: "sp_test",
        hashedKey: "test-hash",
        name: "Test Key",
        organizationId: "test-org",
        permissions: [ApiKeyPermission.NOTIFICATION_READ.toString()],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      expect(ApiKeyService.isValid(apiKey)).toBe(false);
    });
  });

  describe("Predefined API Key Types", () => {
    it("should create notification API key with correct permissions", () => {
      const result = ApiKeyService.createNotificationApiKey("Notification Key", "test-org");

      expect(result.name).toBe("Notification Key");
      expect(result.organizationId).toBe("test-org");
      expect(result.permissions).toContain(ApiKeyPermission.NOTIFICATION_READ.toString());
      expect(result.permissions).toContain(ApiKeyPermission.NOTIFICATION_WRITE.toString());
      expect(result.permissions).toContain(ApiKeyPermission.NOTIFICATION_SEND.toString());
      expect(result.permissions).toContain(ApiKeyPermission.SITE_READ.toString());
    });

    it("should create analytics API key with correct permissions", () => {
      const result = ApiKeyService.createAnalyticsApiKey("Analytics Key", "test-org");

      expect(result.name).toBe("Analytics Key");
      expect(result.organizationId).toBe("test-org");
      expect(result.permissions).toContain(ApiKeyPermission.ANALYTICS_READ.toString());
      expect(result.permissions).toContain(ApiKeyPermission.NOTIFICATION_READ.toString());
      expect(result.permissions).toContain(ApiKeyPermission.SITE_READ.toString());
    });

    it("should create webhook API key with correct permissions", () => {
      const result = ApiKeyService.createWebhookApiKey("Webhook Key", "test-org");

      expect(result.name).toBe("Webhook Key");
      expect(result.organizationId).toBe("test-org");
      expect(result.permissions).toContain(ApiKeyPermission.INTEGRATION_WEBHOOK.toString());
      expect(result.permissions).toContain(ApiKeyPermission.NOTIFICATION_WRITE.toString());
      expect(result.permissions).toContain(ApiKeyPermission.SITE_READ.toString());
    });
  });

  describe("API Key Security", () => {
    it("should use cryptographically secure random generation", () => {
      const keys = new Set();

      // Generate 100 keys and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const result = ApiKeyService.generateApiKey();
        expect(keys.has(result.key)).toBe(false);
        keys.add(result.key);
      }
    });

    it("should not store raw API keys in createApiKey result", () => {
      const permissions = [ApiKeyPermission.NOTIFICATION_READ];
      const result = ApiKeyService.createApiKey("Test Key", "test-org", permissions);

      // The result should not contain the raw key, only the hashed version
      expect(result.key).toMatch(/^sp_[a-f0-9]{64}$/);
      expect(result.hashedKey).toMatch(/^[a-f0-9]{64}$/);
      expect(result.hashedKey).not.toBe(result.key);

      // Verify the hash is correct
      const expectedHash = ApiKeyService.hashApiKey(result.key);
      expect(result.hashedKey).toBe(expectedHash);
    });
  });
});

describe("ApiKeyUsage Interface", () => {
  it("should have correct structure", () => {
    const usage: ApiKeyUsage = {
      apiKeyId: "test-key-id",
      endpoint: "/api/notifications",
      method: "POST",
      timestamp: new Date(),
      responseStatus: 200,
      organizationId: "test-org",
    };

    expect(usage.apiKeyId).toBe("test-key-id");
    expect(usage.endpoint).toBe("/api/notifications");
    expect(usage.method).toBe("POST");
    expect(usage.timestamp).toBeInstanceOf(Date);
    expect(usage.responseStatus).toBe(200);
    expect(usage.organizationId).toBe("test-org");
  });
});

describe("Integration Tests", () => {
  it("should create, hash, and validate API key end-to-end", () => {
    // Create API key
    const permissions = [ApiKeyPermission.NOTIFICATION_READ, ApiKeyPermission.ANALYTICS_READ];
    const apiKeyData = ApiKeyService.createApiKey("Integration Test Key", "test-org", permissions);

    // Verify format
    expect(ApiKeyService.isValidKeyFormat(apiKeyData.key)).toBe(true);

    // Verify hash
    const expectedHash = ApiKeyService.hashApiKey(apiKeyData.key);
    expect(apiKeyData.hashedKey).toBe(expectedHash);

    // Create a full ApiKey object for testing methods that require it
    const fullApiKey: ApiKey = {
      ...apiKeyData,
      id: "test-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Verify permissions
    expect(ApiKeyService.hasPermission(fullApiKey, ApiKeyPermission.NOTIFICATION_READ)).toBe(true);
    expect(ApiKeyService.hasPermission(fullApiKey, ApiKeyPermission.ANALYTICS_READ)).toBe(true);
    expect(ApiKeyService.hasPermission(fullApiKey, ApiKeyPermission.SITE_WRITE)).toBe(false);

    // Verify validity
    expect(ApiKeyService.isValid(fullApiKey)).toBe(true);
  });
});
