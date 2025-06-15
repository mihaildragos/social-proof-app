import { z } from "zod";

/**
 * Event version information
 */
export interface EventVersion {
  version: string;
  schema: z.ZodSchema<any>;
  deprecated?: boolean;
  deprecationDate?: Date;
  migrationPath?: string[];
}

/**
 * Event migration function type
 */
export type EventMigration = (event: any) => any;

/**
 * Event versioning manager
 */
export class EventVersionManager {
  private versions: Map<string, Map<string, EventVersion>> = new Map();
  private migrations: Map<string, EventMigration> = new Map();

  /**
   * Register an event version
   */
  registerVersion(
    eventType: string,
    version: string,
    schema: z.ZodSchema<any>,
    options?: {
      deprecated?: boolean;
      deprecationDate?: Date;
      migrationPath?: string[];
    }
  ): void {
    if (!this.versions.has(eventType)) {
      this.versions.set(eventType, new Map());
    }

    const eventVersions = this.versions.get(eventType)!;
    eventVersions.set(version, {
      version,
      schema,
      deprecated: options?.deprecated,
      deprecationDate: options?.deprecationDate,
      migrationPath: options?.migrationPath,
    });
  }

  /**
   * Register a migration function
   */
  registerMigration(
    fromVersion: string,
    toVersion: string,
    eventType: string,
    migration: EventMigration
  ): void {
    const key = `${eventType}:${fromVersion}->${toVersion}`;
    this.migrations.set(key, migration);
  }

  /**
   * Get the latest version for an event type
   */
  getLatestVersion(eventType: string): string | null {
    const eventVersions = this.versions.get(eventType);
    if (!eventVersions || eventVersions.size === 0) {
      return null;
    }

    // Sort versions and return the latest non-deprecated one
    const sortedVersions = Array.from(eventVersions.entries())
      .filter(([_, versionInfo]) => !versionInfo.deprecated)
      .sort(([a], [b]) => this.compareVersions(b, a));

    return sortedVersions.length > 0 ? sortedVersions[0][0] : null;
  }

  /**
   * Validate an event against its schema
   */
  validateEvent(event: any): { valid: boolean; errors?: string[]; migratedEvent?: any } {
    try {
      const eventType = event.type;
      const eventVersion = event.version || "1.0.0";

      // Check if we have a schema for this version
      const eventVersions = this.versions.get(eventType);
      if (!eventVersions) {
        return { valid: false, errors: [`Unknown event type: ${eventType}`] };
      }

      const versionInfo = eventVersions.get(eventVersion);
      if (!versionInfo) {
        // Try to migrate to latest version
        const latestVersion = this.getLatestVersion(eventType);
        if (latestVersion && latestVersion !== eventVersion) {
          const migratedEvent = this.migrateEvent(event, eventType, eventVersion, latestVersion);
          if (migratedEvent) {
            const latestVersionInfo = eventVersions.get(latestVersion)!;
            const result = latestVersionInfo.schema.safeParse(migratedEvent);
            if (result.success) {
              return { valid: true, migratedEvent: result.data };
            } else {
              return { valid: false, errors: result.error.errors.map((e) => e.message) };
            }
          }
        }
        return {
          valid: false,
          errors: [`Unknown version ${eventVersion} for event type ${eventType}`],
        };
      }

      // Validate against the schema
      const result = versionInfo.schema.safeParse(event);
      if (result.success) {
        return { valid: true };
      } else {
        return { valid: false, errors: result.error.errors.map((e) => e.message) };
      }
    } catch (error) {
      return { valid: false, errors: [`Validation error: ${error}`] };
    }
  }

  /**
   * Migrate an event from one version to another
   */
  migrateEvent(event: any, eventType: string, fromVersion: string, toVersion: string): any | null {
    if (fromVersion === toVersion) {
      return event;
    }

    const eventVersions = this.versions.get(eventType);
    if (!eventVersions) {
      return null;
    }

    const fromVersionInfo = eventVersions.get(fromVersion);
    const toVersionInfo = eventVersions.get(toVersion);

    if (!fromVersionInfo || !toVersionInfo) {
      return null;
    }

    // Direct migration
    const directMigrationKey = `${eventType}:${fromVersion}->${toVersion}`;
    const directMigration = this.migrations.get(directMigrationKey);
    if (directMigration) {
      return directMigration(event);
    }

    // Try to find a migration path
    if (fromVersionInfo.migrationPath) {
      let currentEvent = event;
      let currentVersion = fromVersion;

      for (const nextVersion of fromVersionInfo.migrationPath) {
        if (nextVersion === toVersion) {
          const migrationKey = `${eventType}:${currentVersion}->${nextVersion}`;
          const migration = this.migrations.get(migrationKey);
          if (migration) {
            return migration(currentEvent);
          }
        }

        const migrationKey = `${eventType}:${currentVersion}->${nextVersion}`;
        const migration = this.migrations.get(migrationKey);
        if (migration) {
          currentEvent = migration(currentEvent);
          currentVersion = nextVersion;
        } else {
          break;
        }
      }
    }

    return null;
  }

  /**
   * Get deprecated versions for an event type
   */
  getDeprecatedVersions(eventType: string): EventVersion[] {
    const eventVersions = this.versions.get(eventType);
    if (!eventVersions) {
      return [];
    }

    return Array.from(eventVersions.values()).filter((v) => v.deprecated);
  }

  /**
   * Check if a version is deprecated
   */
  isVersionDeprecated(eventType: string, version: string): boolean {
    const eventVersions = this.versions.get(eventType);
    if (!eventVersions) {
      return false;
    }

    const versionInfo = eventVersions.get(version);
    return versionInfo?.deprecated || false;
  }

  /**
   * Compare two version strings
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }
}

// Global version manager instance
export const eventVersionManager = new EventVersionManager();

// Register current event schemas (version 1.0.0)
import {
  UserRegisteredEventSchema,
  UserLoginEventSchema,
  UserLogoutEventSchema,
  SiteCreatedEventSchema,
  SiteUpdatedEventSchema,
  SiteDeletedEventSchema,
  NotificationCreatedEventSchema,
  NotificationTriggeredEventSchema,
  NotificationDisplayedEventSchema,
  NotificationClickedEventSchema,
  NotificationClosedEventSchema,
  IntegrationConnectedEventSchema,
  IntegrationDisconnectedEventSchema,
  WebhookReceivedEventSchema,
  SubscriptionCreatedEventSchema,
  SubscriptionUpdatedEventSchema,
  PaymentProcessedEventSchema,
  UsageRecordedEventSchema,
  PageViewEventSchema,
  ConversionEventSchema,
  CampaignStartedEventSchema,
  CampaignEndedEventSchema,
  ABTestStartedEventSchema,
  ABTestEndedEventSchema,
  EVENT_TYPES,
} from "./schemas";

// Register all current schemas as version 1.0.0
eventVersionManager.registerVersion(
  EVENT_TYPES.USER_REGISTERED,
  "1.0.0",
  UserRegisteredEventSchema
);
eventVersionManager.registerVersion(EVENT_TYPES.USER_LOGIN, "1.0.0", UserLoginEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.USER_LOGOUT, "1.0.0", UserLogoutEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.SITE_CREATED, "1.0.0", SiteCreatedEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.SITE_UPDATED, "1.0.0", SiteUpdatedEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.SITE_DELETED, "1.0.0", SiteDeletedEventSchema);
eventVersionManager.registerVersion(
  EVENT_TYPES.NOTIFICATION_CREATED,
  "1.0.0",
  NotificationCreatedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.NOTIFICATION_TRIGGERED,
  "1.0.0",
  NotificationTriggeredEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.NOTIFICATION_DISPLAYED,
  "1.0.0",
  NotificationDisplayedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.NOTIFICATION_CLICKED,
  "1.0.0",
  NotificationClickedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.NOTIFICATION_CLOSED,
  "1.0.0",
  NotificationClosedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.INTEGRATION_CONNECTED,
  "1.0.0",
  IntegrationConnectedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.INTEGRATION_DISCONNECTED,
  "1.0.0",
  IntegrationDisconnectedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.WEBHOOK_RECEIVED,
  "1.0.0",
  WebhookReceivedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.SUBSCRIPTION_CREATED,
  "1.0.0",
  SubscriptionCreatedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.SUBSCRIPTION_UPDATED,
  "1.0.0",
  SubscriptionUpdatedEventSchema
);
eventVersionManager.registerVersion(
  EVENT_TYPES.PAYMENT_PROCESSED,
  "1.0.0",
  PaymentProcessedEventSchema
);
eventVersionManager.registerVersion(EVENT_TYPES.USAGE_RECORDED, "1.0.0", UsageRecordedEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.PAGE_VIEW, "1.0.0", PageViewEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.CONVERSION, "1.0.0", ConversionEventSchema);
eventVersionManager.registerVersion(
  EVENT_TYPES.CAMPAIGN_STARTED,
  "1.0.0",
  CampaignStartedEventSchema
);
eventVersionManager.registerVersion(EVENT_TYPES.CAMPAIGN_ENDED, "1.0.0", CampaignEndedEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.AB_TEST_STARTED, "1.0.0", ABTestStartedEventSchema);
eventVersionManager.registerVersion(EVENT_TYPES.AB_TEST_ENDED, "1.0.0", ABTestEndedEventSchema);

/**
 * Example migration functions for future versions
 */

// Example: Migration from 1.0.0 to 1.1.0 for user.registered events
// This would be used when we add new fields or change existing ones
eventVersionManager.registerMigration(
  "1.0.0",
  "1.1.0",
  EVENT_TYPES.USER_REGISTERED,
  (event: any) => {
    // Example: Add a new field with default value
    return {
      ...event,
      version: "1.1.0",
      data: {
        ...event.data,
        // Example: Add timezone field with default
        timezone: event.data.timezone || "UTC",
      },
    };
  }
);

// Example: Migration from 1.0.0 to 1.1.0 for notification events
// This would handle changes to notification structure
eventVersionManager.registerMigration(
  "1.0.0",
  "1.1.0",
  EVENT_TYPES.NOTIFICATION_DISPLAYED,
  (event: any) => {
    return {
      ...event,
      version: "1.1.0",
      data: {
        ...event.data,
        // Example: Restructure position data
        position: {
          coordinates: {
            x: event.data.position?.x || 0,
            y: event.data.position?.y || 0,
          },
          viewport: {
            width: 1920, // Default values
            height: 1080,
          },
        },
      },
    };
  }
);

/**
 * Utility functions for event versioning
 */

/**
 * Create a new event with proper versioning
 */
export function createVersionedEvent(
  eventType: string,
  data: any,
  options?: {
    version?: string;
    source?: string;
    organizationId?: string;
    siteId?: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }
): any {
  const version = options?.version || eventVersionManager.getLatestVersion(eventType) || "1.0.0";

  return {
    id: crypto.randomUUID(),
    type: eventType,
    version,
    timestamp: new Date().toISOString(),
    source: options?.source || "social-proof-app",
    organizationId: options?.organizationId,
    siteId: options?.siteId,
    userId: options?.userId,
    sessionId: options?.sessionId,
    correlationId: options?.correlationId,
    metadata: options?.metadata,
    data,
  };
}

/**
 * Validate and potentially migrate an event to the latest version
 */
export function validateAndMigrateEvent(event: any): {
  valid: boolean;
  event?: any;
  errors?: string[];
  migrated?: boolean;
} {
  const validation = eventVersionManager.validateEvent(event);

  if (validation.valid) {
    return {
      valid: true,
      event: validation.migratedEvent || event,
      migrated: !!validation.migratedEvent,
    };
  } else {
    return {
      valid: false,
      errors: validation.errors,
    };
  }
}

/**
 * Get schema for a specific event type and version
 */
export function getEventSchema(eventType: string, version?: string): z.ZodSchema<any> | null {
  const eventVersions = eventVersionManager["versions"].get(eventType);
  if (!eventVersions) {
    return null;
  }

  const targetVersion = version || eventVersionManager.getLatestVersion(eventType);
  if (!targetVersion) {
    return null;
  }

  const versionInfo = eventVersions.get(targetVersion);
  return versionInfo?.schema || null;
}

/**
 * Check if an event type supports a specific version
 */
export function supportsVersion(eventType: string, version: string): boolean {
  const eventVersions = eventVersionManager["versions"].get(eventType);
  return eventVersions?.has(version) || false;
}

/**
 * Get all supported versions for an event type
 */
export function getSupportedVersions(eventType: string): string[] {
  const eventVersions = eventVersionManager["versions"].get(eventType);
  if (!eventVersions) {
    return [];
  }

  return Array.from(eventVersions.keys()).sort((a, b) =>
    eventVersionManager["compareVersions"](b, a)
  );
}
