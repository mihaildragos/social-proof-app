import crypto from "crypto";
import { getContextLogger } from "../utils/logger";

const logger = getContextLogger({ service: "api-key" });

export interface ApiKey {
  id: string;
  key: string;
  hashedKey: string;
  name: string;
  organizationId: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyUsage {
  apiKeyId: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  responseStatus: number;
  organizationId: string;
}

export enum ApiKeyPermission {
  // Notification permissions
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_WRITE = "notification:write",
  NOTIFICATION_SEND = "notification:send",

  // Site permissions
  SITE_READ = "site:read",
  SITE_WRITE = "site:write",

  // Analytics permissions
  ANALYTICS_READ = "analytics:read",

  // Integration permissions
  INTEGRATION_WEBHOOK = "integration:webhook",

  // Template permissions
  TEMPLATE_READ = "template:read",
  TEMPLATE_WRITE = "template:write",
}

export class ApiKeyService {
  private static readonly KEY_PREFIX = "sp_";
  private static readonly KEY_LENGTH = 32;
  private static readonly HASH_ALGORITHM = "sha256";

  /**
   * Generate a new API key
   */
  static generateApiKey(): { key: string; hashedKey: string } {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const key = this.KEY_PREFIX + randomBytes.toString("hex");
    const hashedKey = this.hashApiKey(key);

    return { key, hashedKey };
  }

  /**
   * Hash an API key for secure storage
   */
  static hashApiKey(key: string): string {
    return crypto.createHash(this.HASH_ALGORITHM).update(key).digest("hex");
  }

  /**
   * Validate API key format
   */
  static isValidKeyFormat(key: string): boolean {
    if (!key || typeof key !== "string") {
      return false;
    }

    if (!key.startsWith(this.KEY_PREFIX)) {
      return false;
    }

    const keyPart = key.slice(this.KEY_PREFIX.length);
    return keyPart.length === this.KEY_LENGTH * 2 && /^[a-f0-9]+$/.test(keyPart);
  }

  /**
   * Create a new API key record
   */
  static createApiKey(
    name: string,
    organizationId: string,
    permissions: ApiKeyPermission[],
    expiresAt?: Date
  ): Omit<ApiKey, "id" | "lastUsedAt" | "createdAt" | "updatedAt"> {
    const { key, hashedKey } = this.generateApiKey();

    return {
      key,
      hashedKey,
      name,
      organizationId,
      permissions: permissions.map((p) => p.toString()),
      isActive: true,
      expiresAt,
    };
  }

  /**
   * Validate API key and return key info
   */
  static async validateApiKey(key: string): Promise<ApiKey | null> {
    try {
      if (!this.isValidKeyFormat(key)) {
        logger.warn("Invalid API key format", { keyPrefix: key.slice(0, 10) });
        return null;
      }

      const hashedKey = this.hashApiKey(key);

      // TODO: Query database for API key
      // This is a placeholder - in real implementation, query the database
      logger.debug("Validating API key", { hashedKey: hashedKey.slice(0, 10) });

      // For now, return null - this will be implemented when database layer is ready
      return null;
    } catch (error) {
      logger.error("Failed to validate API key", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if API key has specific permission
   */
  static hasPermission(apiKey: ApiKey, permission: ApiKeyPermission): boolean {
    return apiKey.permissions.includes(permission.toString());
  }

  /**
   * Check if API key has any of the specified permissions
   */
  static hasAnyPermission(apiKey: ApiKey, permissions: ApiKeyPermission[]): boolean {
    return permissions.some((permission) => this.hasPermission(apiKey, permission));
  }

  /**
   * Check if API key has all of the specified permissions
   */
  static hasAllPermissions(apiKey: ApiKey, permissions: ApiKeyPermission[]): boolean {
    return permissions.every((permission) => this.hasPermission(apiKey, permission));
  }

  /**
   * Check if API key is expired
   */
  static isExpired(apiKey: ApiKey): boolean {
    if (!apiKey.expiresAt) {
      return false;
    }
    return new Date() > apiKey.expiresAt;
  }

  /**
   * Check if API key is valid (active and not expired)
   */
  static isValid(apiKey: ApiKey): boolean {
    return apiKey.isActive && !this.isExpired(apiKey);
  }

  /**
   * Record API key usage
   */
  static async recordUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    responseStatus: number,
    organizationId: string
  ): Promise<void> {
    try {
      const usage: ApiKeyUsage = {
        apiKeyId,
        endpoint,
        method,
        timestamp: new Date(),
        responseStatus,
        organizationId,
      };

      // TODO: Store usage in database
      logger.debug("Recording API key usage", usage);
    } catch (error) {
      logger.error("Failed to record API key usage", {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId,
      });
    }
  }

  /**
   * Update last used timestamp
   */
  static async updateLastUsed(apiKeyId: string): Promise<void> {
    try {
      // TODO: Update database record
      logger.debug("Updating API key last used timestamp", { apiKeyId });
    } catch (error) {
      logger.error("Failed to update API key last used timestamp", {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId,
      });
    }
  }

  /**
   * Revoke API key
   */
  static async revokeApiKey(apiKeyId: string): Promise<void> {
    try {
      // TODO: Update database to set isActive = false
      logger.info("API key revoked", { apiKeyId });
    } catch (error) {
      logger.error("Failed to revoke API key", {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId,
      });
      throw error;
    }
  }

  /**
   * Get API keys for organization
   */
  static async getOrganizationApiKeys(organizationId: string): Promise<ApiKey[]> {
    try {
      // TODO: Query database for organization API keys
      logger.debug("Getting API keys for organization", { organizationId });
      return [];
    } catch (error) {
      logger.error("Failed to get organization API keys", {
        error: error instanceof Error ? error.message : String(error),
        organizationId,
      });
      return [];
    }
  }

  /**
   * Get API key usage statistics
   */
  static async getUsageStats(
    apiKeyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalRequests: number; successfulRequests: number; errorRequests: number }> {
    try {
      // TODO: Query database for usage statistics
      logger.debug("Getting API key usage stats", { apiKeyId, startDate, endDate });
      return {
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
      };
    } catch (error) {
      logger.error("Failed to get API key usage stats", {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId,
      });
      return {
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
      };
    }
  }

  /**
   * Clean up expired API keys
   */
  static async cleanupExpiredKeys(): Promise<number> {
    try {
      // TODO: Query and deactivate expired API keys
      logger.info("Cleaning up expired API keys");
      return 0;
    } catch (error) {
      logger.error("Failed to cleanup expired API keys", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Generate API key with specific permissions for common use cases
   */
  static createNotificationApiKey(name: string, organizationId: string, expiresAt?: Date) {
    return this.createApiKey(
      name,
      organizationId,
      [
        ApiKeyPermission.NOTIFICATION_READ,
        ApiKeyPermission.NOTIFICATION_WRITE,
        ApiKeyPermission.NOTIFICATION_SEND,
        ApiKeyPermission.SITE_READ,
        ApiKeyPermission.TEMPLATE_READ,
      ],
      expiresAt
    );
  }

  /**
   * Generate API key for analytics access
   */
  static createAnalyticsApiKey(name: string, organizationId: string, expiresAt?: Date) {
    return this.createApiKey(
      name,
      organizationId,
      [
        ApiKeyPermission.ANALYTICS_READ,
        ApiKeyPermission.NOTIFICATION_READ,
        ApiKeyPermission.SITE_READ,
      ],
      expiresAt
    );
  }

  /**
   * Generate API key for webhook integrations
   */
  static createWebhookApiKey(name: string, organizationId: string, expiresAt?: Date) {
    return this.createApiKey(
      name,
      organizationId,
      [
        ApiKeyPermission.INTEGRATION_WEBHOOK,
        ApiKeyPermission.NOTIFICATION_WRITE,
        ApiKeyPermission.SITE_READ,
      ],
      expiresAt
    );
  }
}

// Export commonly used permission sets
export const ApiKeyPermissionSets = {
  FULL_ACCESS: Object.values(ApiKeyPermission),

  NOTIFICATION_MANAGEMENT: [
    ApiKeyPermission.NOTIFICATION_READ,
    ApiKeyPermission.NOTIFICATION_WRITE,
    ApiKeyPermission.NOTIFICATION_SEND,
    ApiKeyPermission.SITE_READ,
    ApiKeyPermission.TEMPLATE_READ,
    ApiKeyPermission.TEMPLATE_WRITE,
  ],

  READ_ONLY: [
    ApiKeyPermission.NOTIFICATION_READ,
    ApiKeyPermission.SITE_READ,
    ApiKeyPermission.ANALYTICS_READ,
    ApiKeyPermission.TEMPLATE_READ,
  ],

  WEBHOOK_ONLY: [
    ApiKeyPermission.INTEGRATION_WEBHOOK,
    ApiKeyPermission.NOTIFICATION_WRITE,
    ApiKeyPermission.SITE_READ,
  ],
};
