import { prisma } from "../lib/prisma";
import { logger } from "./logger";

interface ClerkWebhookUser {
  id: string;
  email_addresses: Array<{
    email_address: string;
    primary: boolean;
  }>;
  first_name?: string;
  last_name?: string;
  username?: string;
  created_at: number;
  updated_at: number;
}

interface SyncUserData {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Comprehensive User Sync Strategy for Clerk + Supabase + PostgreSQL
 *
 * Architecture:
 * 1. Frontend uses Clerk for authentication
 * 2. Frontend uses Supabase for immediate data access (RLS protected)
 * 3. Microservices use PostgreSQL + Prisma for business logic
 * 4. Sync happens via webhooks and event streams
 * 
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Clerk Auth     │    │   Microservices     │
│                 │    │                  │    │                     │
│ • Next.js 14    │◄──►│ • Authentication │◄──►│ • PostgreSQL +      │
│ • Supabase RLS  │    │ • Webhooks       │    │   Prisma            │
│ • Real-time UI  │    │ • JWT Tokens     │    │ • Business Logic    │
└─────────────────┘    └──────────────────┘    │ • Event Streams     │
         ▲                        │            └─────────────────────┘
         │                        ▼                         ▲
         │               ┌─────────────────┐                │
         └──────────────►│  Sync Service   │◄───────────────┘
                         │                 │
                         │ • ClerkWebhooks │
                         │ • Data Sync     │
                         │ • Error Retry   │
                         │ • Health Checks │
                         └─────────────────┘
 */
class ClerkSyncService {
  /**
   * Handle Clerk webhook events for user sync
   */
  async handleClerkWebhook(eventType: string, data: ClerkWebhookUser): Promise<void> {
    logger.info("Processing Clerk webhook", { eventType, userId: data.id });

    switch (eventType) {
      case "user.created":
        await this.syncUserCreated(data);
        break;
      case "user.updated":
        await this.syncUserUpdated(data);
        break;
      case "user.deleted":
        await this.syncUserDeleted(data.id);
        break;
      default:
        logger.warn("Unhandled Clerk webhook event", { eventType });
    }
  }

  /**
   * Sync new user creation from Clerk to both Supabase and PostgreSQL
   */
  private async syncUserCreated(clerkUser: ClerkWebhookUser): Promise<void> {
    try {
      const primaryEmail = clerkUser.email_addresses.find((e) => e.primary)?.email_address;
      if (!primaryEmail) {
        throw new Error("No primary email found for user");
      }

      const userData: SyncUserData = {
        clerkUserId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.first_name,
        lastName: clerkUser.last_name,
        username: clerkUser.username,
      };

      // 1. Create user in microservice PostgreSQL database
      const microserviceUser = await this.createMicroserviceUser(userData);

      // 2. Sync to Supabase for frontend access (with retry mechanism)
      await this.syncToSupabase("create", userData, microserviceUser.id);

      // 3. Create sync tracking record
      await this.createSyncRecord(clerkUser.id, microserviceUser.id, "created");

      logger.info("User sync completed", {
        clerkUserId: clerkUser.id,
        microserviceUserId: microserviceUser.id,
      });
    } catch (error) {
      logger.error("Failed to sync user creation", {
        clerkUserId: clerkUser.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Queue for retry
      await this.queueFailedSync("user.created", clerkUser);
      throw error;
    }
  }

  /**
   * Create user in microservice PostgreSQL database
   */
  private async createMicroserviceUser(userData: SyncUserData): Promise<{ id: string }> {
    // Check if user already exists (idempotency)
    const existingUser = await prisma.user.findFirst({
      where: { clerkUserId: userData.clerkUserId },
      select: { id: true },
    });

    if (existingUser) {
      logger.info("User already exists in microservice", {
        clerkUserId: userData.clerkUserId,
        microserviceUserId: existingUser.id,
      });
      return existingUser;
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        clerkUserId: userData.clerkUserId,
        email: userData.email, // Note: Should be encrypted in production
        emailEncrypted: userData.email, // Placeholder for encrypted email
        fullName:
          userData.firstName && userData.lastName ?
            `${userData.firstName} ${userData.lastName}`
          : userData.username || userData.email.split("@")[0],
        fullNameEncrypted:
          userData.firstName && userData.lastName ?
            `${userData.firstName} ${userData.lastName}`
          : userData.username || userData.email.split("@")[0],
        authProvider: "clerk",
        accountStatus: "active",
        preferredLanguage: "en",
        preferredTimezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    return user;
  }

  /**
   * Sync user updates from Clerk
   */
  private async syncUserUpdated(clerkUser: ClerkWebhookUser): Promise<void> {
    try {
      const primaryEmail = clerkUser.email_addresses.find((e) => e.primary)?.email_address;
      if (!primaryEmail) {
        throw new Error("No primary email found for user");
      }

      // Find existing user
      const existingUser = await prisma.user.findFirst({
        where: { clerkUserId: clerkUser.id },
        select: { id: true },
      });

      if (!existingUser) {
        logger.warn("User not found for update, creating new user", { clerkUserId: clerkUser.id });
        await this.syncUserCreated(clerkUser);
        return;
      }

      const userData: SyncUserData = {
        clerkUserId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.first_name,
        lastName: clerkUser.last_name,
        username: clerkUser.username,
      };

      // Update microservice user
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: userData.email,
          emailEncrypted: userData.email,
          fullName:
            userData.firstName && userData.lastName ?
              `${userData.firstName} ${userData.lastName}`
            : userData.username || userData.email.split("@")[0],
          fullNameEncrypted:
            userData.firstName && userData.lastName ?
              `${userData.firstName} ${userData.lastName}`
            : userData.username || userData.email.split("@")[0],
          updatedAt: new Date(),
        },
      });

      // Sync to Supabase
      await this.syncToSupabase("update", userData, existingUser.id);

      // Update sync record
      await this.updateSyncRecord(clerkUser.id, "updated");

      logger.info("User update sync completed", {
        clerkUserId: clerkUser.id,
        microserviceUserId: existingUser.id,
      });
    } catch (error) {
      logger.error("Failed to sync user update", {
        clerkUserId: clerkUser.id,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.queueFailedSync("user.updated", clerkUser);
      throw error;
    }
  }

  /**
   * Sync user deletion from Clerk
   */
  private async syncUserDeleted(clerkUserId: string): Promise<void> {
    try {
      // Find existing user
      const existingUser = await prisma.user.findFirst({
        where: { clerkUserId },
        select: { id: true },
      });

      if (!existingUser) {
        logger.warn("User not found for deletion", { clerkUserId });
        return;
      }

      // Soft delete in microservice (maintain data integrity)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          accountStatus: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Remove from Supabase
      await this.syncToSupabase("delete", { clerkUserId, email: "" }, existingUser.id);

      // Update sync record
      await this.updateSyncRecord(clerkUserId, "deleted");

      logger.info("User deletion sync completed", {
        clerkUserId,
        microserviceUserId: existingUser.id,
      });
    } catch (error) {
      logger.error("Failed to sync user deletion", {
        clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.queueFailedSync("user.deleted", { id: clerkUserId } as ClerkWebhookUser);
      throw error;
    }
  }

  /**
   * Sync user data to Supabase for frontend access
   * Note: This is a stub - in production, this would use the Supabase client
   */
  private async syncToSupabase(
    operation: "create" | "update" | "delete",
    userData: SyncUserData,
    microserviceUserId: string
  ): Promise<void> {
    try {
      // In production, this would use the Supabase client to sync data
      // For now, we'll just log the operation
      logger.info("Syncing to Supabase", {
        operation,
        clerkUserId: userData.clerkUserId,
        microserviceUserId,
      });

      // TODO: Implement actual Supabase sync
      // const supabase = createClient(supabaseUrl, supabaseServiceKey);
      //
      // switch (operation) {
      //   case "create":
      //     await supabase.from("users").insert({
      //       id: microserviceUserId,
      //       clerk_user_id: userData.clerkUserId,
      //       email: userData.email,
      //       full_name: userData.firstName && userData.lastName
      //         ? `${userData.firstName} ${userData.lastName}`
      //         : userData.username,
      //       created_at: new Date().toISOString(),
      //       updated_at: new Date().toISOString(),
      //     });
      //     break;
      //   case "update":
      //     await supabase.from("users").update({
      //       email: userData.email,
      //       full_name: userData.firstName && userData.lastName
      //         ? `${userData.firstName} ${userData.lastName}`
      //         : userData.username,
      //       updated_at: new Date().toISOString(),
      //     }).eq("clerk_user_id", userData.clerkUserId);
      //     break;
      //   case "delete":
      //     await supabase.from("users").delete().eq("clerk_user_id", userData.clerkUserId);
      //     break;
      // }
    } catch (error) {
      logger.error("Failed to sync to Supabase", {
        operation,
        clerkUserId: userData.clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create sync tracking record
   */
  private async createSyncRecord(
    clerkUserId: string,
    microserviceUserId: string,
    status: string
  ): Promise<void> {
    await prisma.userClerkSync.create({
      data: {
        clerkUserId,
        microserviceUserId,
        status,
        lastSyncedAt: new Date(),
        syncAttempts: 1,
      },
    });
  }

  /**
   * Update sync tracking record
   */
  private async updateSyncRecord(clerkUserId: string, status: string): Promise<void> {
    await prisma.userClerkSync.updateMany({
      where: { clerkUserId },
      data: {
        status,
        lastSyncedAt: new Date(),
        syncAttempts: { increment: 1 },
      },
    });
  }

  /**
   * Queue failed sync for retry
   */
  private async queueFailedSync(eventType: string, clerkUser: ClerkWebhookUser): Promise<void> {
    // In production, this would queue the sync for retry using a message queue
    logger.error("Queueing failed sync for retry", {
      eventType,
      clerkUserId: clerkUser.id,
    });

    // TODO: Implement actual retry queue (Redis/SQS/etc.)
    // await redisClient.lpush("failed_syncs", JSON.stringify({
    //   eventType,
    //   clerkUser,
    //   timestamp: Date.now(),
    //   retryCount: 0,
    // }));
  }

  /**
   * Manually trigger sync for a specific user (for data recovery)
   */
  async manualSync(clerkUserId: string): Promise<void> {
    try {
      // This would typically fetch user data from Clerk API
      logger.info("Manual sync triggered", { clerkUserId });

      // TODO: Implement manual sync from Clerk API
      // const clerkUser = await clerkClient.users.getUser(clerkUserId);
      // await this.syncUserUpdated(clerkUser);
    } catch (error) {
      logger.error("Manual sync failed", {
        clerkUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(clerkUserId: string): Promise<any> {
    const syncRecord = await prisma.userClerkSync.findFirst({
      where: { clerkUserId },
      select: {
        status: true,
        lastSyncedAt: true,
        syncAttempts: true,
        microserviceUserId: true,
      },
    });

    return syncRecord;
  }

  /**
   * Health check for sync service
   */
  async healthCheck(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const checks = {
      postgresConnection: false,
      recentSyncs: false,
    };

    try {
      // Check PostgreSQL connection
      await prisma.$queryRaw`SELECT 1`;
      checks.postgresConnection = true;

      // Check recent syncs (within last hour)
      const recentSyncs = await prisma.userClerkSync.count({
        where: {
          lastSyncedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
      });
      checks.recentSyncs = recentSyncs > 0;
    } catch (error) {
      logger.error("Health check failed", { error });
    }

    const status = Object.values(checks).every((check) => check) ? "healthy" : "unhealthy";

    return { status, checks };
  }
}

export const clerkSync = new ClerkSyncService();
