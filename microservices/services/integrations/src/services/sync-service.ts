import { Pool } from "pg";
import { EventEmitter } from "events";
import { IntegrationService, Integration } from "./integration-service";

export interface SyncJob {
  id: string;
  integrationId: string;
  provider: string;
  syncType: "full" | "incremental" | "manual";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConfig {
  provider: string;
  syncInterval: number; // in minutes
  batchSize: number;
  retryAttempts: number;
  enabledResources: string[];
  lastSyncTimestamp?: Date;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  duration: number;
}

export class SyncService extends EventEmitter {
  private db: Pool;
  private integrationService: IntegrationService;
  private activeSyncJobs: Map<string, boolean> = new Map();

  constructor() {
    super();
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    this.integrationService = new IntegrationService();
  }

  async createSyncJob(
    integrationId: string,
    syncType: SyncJob["syncType"] = "incremental",
    metadata: Record<string, any> = {}
  ): Promise<SyncJob> {
    const integration = await this.integrationService.getIntegration(integrationId, ""); // TODO: Add proper user context

    if (!integration) {
      throw new Error("Integration not found");
    }

    // Check if there's already an active sync job for this integration
    const activeSyncJob = await this.getActiveSyncJob(integrationId);
    if (activeSyncJob) {
      throw new Error("Sync job already running for this integration");
    }

    const result = await this.db.query(
      `
      INSERT INTO sync_jobs (
        integration_id, provider, sync_type, status, progress, 
        total_records, processed_records, error_count, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        integrationId,
        integration.provider,
        syncType,
        "pending",
        0,
        0,
        0,
        0,
        JSON.stringify(metadata),
      ]
    );

    const syncJob = this.mapRowToSyncJob(result.rows[0]);

    this.emit("sync:job_created", {
      syncJob,
      integration,
    });

    return syncJob;
  }

  async startSyncJob(syncJobId: string): Promise<void> {
    const syncJob = await this.getSyncJob(syncJobId);

    if (!syncJob) {
      throw new Error("Sync job not found");
    }

    if (syncJob.status !== "pending") {
      throw new Error("Sync job is not in pending status");
    }

    // Mark as running
    await this.updateSyncJobStatus(syncJobId, "running", { startedAt: new Date() });
    this.activeSyncJobs.set(syncJobId, true);

    try {
      // Get integration details
      const integration = await this.integrationService.getIntegration(syncJob.integrationId, "");

      if (!integration) {
        throw new Error("Integration not found");
      }

      // Start sync based on provider
      let result: SyncResult;

      switch (syncJob.provider) {
        case "shopify":
          result = await this.syncShopifyData(integration, syncJob);
          break;
        case "woocommerce":
          result = await this.syncWooCommerceData(integration, syncJob);
          break;
        case "stripe":
          result = await this.syncStripeData(integration, syncJob);
          break;
        default:
          throw new Error(`Unsupported provider: ${syncJob.provider}`);
      }

      // Update job as completed
      await this.updateSyncJobStatus(syncJobId, "completed", {
        completedAt: new Date(),
        progress: 100,
        processedRecords: result.recordsProcessed,
        errorCount: result.errors.length,
      });

      this.emit("sync:job_completed", {
        syncJob,
        result,
      });
    } catch (error) {
      await this.updateSyncJobStatus(syncJobId, "failed", {
        lastError: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      });

      this.emit("sync:job_failed", {
        syncJob,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.activeSyncJobs.delete(syncJobId);
    }
  }

  async cancelSyncJob(syncJobId: string): Promise<void> {
    const syncJob = await this.getSyncJob(syncJobId);

    if (!syncJob) {
      throw new Error("Sync job not found");
    }

    if (syncJob.status !== "running") {
      throw new Error("Can only cancel running sync jobs");
    }

    await this.updateSyncJobStatus(syncJobId, "cancelled", {
      completedAt: new Date(),
    });

    this.activeSyncJobs.delete(syncJobId);

    this.emit("sync:job_cancelled", { syncJob });
  }

  async getSyncJob(syncJobId: string): Promise<SyncJob | null> {
    const result = await this.db.query("SELECT * FROM sync_jobs WHERE id = $1", [syncJobId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSyncJob(result.rows[0]);
  }

  async getSyncJobsByIntegration(integrationId: string): Promise<SyncJob[]> {
    const result = await this.db.query(
      "SELECT * FROM sync_jobs WHERE integration_id = $1 ORDER BY created_at DESC",
      [integrationId]
    );

    return result.rows.map((row) => this.mapRowToSyncJob(row));
  }

  async getActiveSyncJob(integrationId: string): Promise<SyncJob | null> {
    const result = await this.db.query(
      "SELECT * FROM sync_jobs WHERE integration_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 1",
      [integrationId, "pending", "running"]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSyncJob(result.rows[0]);
  }

  async scheduleSyncJob(
    integrationId: string,
    scheduleTime: Date,
    syncType: SyncJob["syncType"] = "incremental"
  ): Promise<SyncJob> {
    const syncJob = await this.createSyncJob(integrationId, syncType, {
      scheduledFor: scheduleTime.toISOString(),
    });

    // Schedule the job (this would integrate with a job queue like Bull or Agenda)
    setTimeout(async () => {
      try {
        await this.startSyncJob(syncJob.id);
      } catch (error) {
        console.error("Scheduled sync job failed:", error);
      }
    }, scheduleTime.getTime() - Date.now());

    return syncJob;
  }

  async getSyncConfig(integrationId: string): Promise<SyncConfig | null> {
    const result = await this.db.query("SELECT * FROM sync_configs WHERE integration_id = $1", [
      integrationId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      provider: row.provider,
      syncInterval: row.sync_interval,
      batchSize: row.batch_size,
      retryAttempts: row.retry_attempts,
      enabledResources: JSON.parse(row.enabled_resources),
      lastSyncTimestamp: row.last_sync_timestamp ? new Date(row.last_sync_timestamp) : undefined,
    };
  }

  async updateSyncConfig(integrationId: string, config: Partial<SyncConfig>): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (config.syncInterval !== undefined) {
      updateFields.push(`sync_interval = $${paramIndex++}`);
      updateValues.push(config.syncInterval);
    }

    if (config.batchSize !== undefined) {
      updateFields.push(`batch_size = $${paramIndex++}`);
      updateValues.push(config.batchSize);
    }

    if (config.retryAttempts !== undefined) {
      updateFields.push(`retry_attempts = $${paramIndex++}`);
      updateValues.push(config.retryAttempts);
    }

    if (config.enabledResources !== undefined) {
      updateFields.push(`enabled_resources = $${paramIndex++}`);
      updateValues.push(JSON.stringify(config.enabledResources));
    }

    if (config.lastSyncTimestamp !== undefined) {
      updateFields.push(`last_sync_timestamp = $${paramIndex++}`);
      updateValues.push(config.lastSyncTimestamp);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date());

    updateValues.push(integrationId);

    const query = `
      UPDATE sync_configs 
      SET ${updateFields.join(", ")}
      WHERE integration_id = $${paramIndex}
    `;

    await this.db.query(query, updateValues);
  }

  // Provider-specific sync methods
  private async syncShopifyData(integration: Integration, syncJob: SyncJob): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const errors: string[] = [];

    try {
      // Get sync config
      const config = await this.getSyncConfig(integration.id);
      const batchSize = config?.batchSize || 50;
      const enabledResources = config?.enabledResources || ["orders", "products", "customers"];

      // Sync orders
      if (enabledResources.includes("orders")) {
        const orderResult = await this.syncShopifyOrders(integration, syncJob, batchSize);
        recordsProcessed += orderResult.processed;
        recordsCreated += orderResult.created;
        recordsUpdated += orderResult.updated;
        recordsSkipped += orderResult.skipped;
        errors.push(...orderResult.errors);
      }

      // Sync products
      if (enabledResources.includes("products")) {
        const productResult = await this.syncShopifyProducts(integration, syncJob, batchSize);
        recordsProcessed += productResult.processed;
        recordsCreated += productResult.created;
        recordsUpdated += productResult.updated;
        recordsSkipped += productResult.skipped;
        errors.push(...productResult.errors);
      }

      // Sync customers
      if (enabledResources.includes("customers")) {
        const customerResult = await this.syncShopifyCustomers(integration, syncJob, batchSize);
        recordsProcessed += customerResult.processed;
        recordsCreated += customerResult.created;
        recordsUpdated += customerResult.updated;
        recordsSkipped += customerResult.skipped;
        errors.push(...customerResult.errors);
      }

      // Update last sync timestamp
      await this.updateSyncConfig(integration.id, {
        lastSyncTimestamp: new Date(),
      });

      return {
        success: errors.length === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  private async syncWooCommerceData(
    integration: Integration,
    syncJob: SyncJob
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const errors: string[] = [];

    try {
      // Get sync config
      const config = await this.getSyncConfig(integration.id);
      const batchSize = config?.batchSize || 50;
      const enabledResources = config?.enabledResources || ["orders", "products", "customers"];

      // Sync orders
      if (enabledResources.includes("orders")) {
        const orderResult = await this.syncWooCommerceOrders(integration, syncJob, batchSize);
        recordsProcessed += orderResult.processed;
        recordsCreated += orderResult.created;
        recordsUpdated += orderResult.updated;
        recordsSkipped += orderResult.skipped;
        errors.push(...orderResult.errors);
      }

      // Sync products
      if (enabledResources.includes("products")) {
        const productResult = await this.syncWooCommerceProducts(integration, syncJob, batchSize);
        recordsProcessed += productResult.processed;
        recordsCreated += productResult.created;
        recordsUpdated += productResult.updated;
        recordsSkipped += productResult.skipped;
        errors.push(...productResult.errors);
      }

      // Update last sync timestamp
      await this.updateSyncConfig(integration.id, {
        lastSyncTimestamp: new Date(),
      });

      return {
        success: errors.length === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  private async syncStripeData(integration: Integration, syncJob: SyncJob): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const errors: string[] = [];

    try {
      // Get sync config
      const config = await this.getSyncConfig(integration.id);
      const batchSize = config?.batchSize || 50;
      const enabledResources = config?.enabledResources || ["payments", "customers", "invoices"];

      // Sync payments
      if (enabledResources.includes("payments")) {
        const paymentResult = await this.syncStripePayments(integration, syncJob, batchSize);
        recordsProcessed += paymentResult.processed;
        recordsCreated += paymentResult.created;
        recordsUpdated += paymentResult.updated;
        recordsSkipped += paymentResult.skipped;
        errors.push(...paymentResult.errors);
      }

      // Sync customers
      if (enabledResources.includes("customers")) {
        const customerResult = await this.syncStripeCustomers(integration, syncJob, batchSize);
        recordsProcessed += customerResult.processed;
        recordsCreated += customerResult.created;
        recordsUpdated += customerResult.updated;
        recordsSkipped += customerResult.skipped;
        errors.push(...customerResult.errors);
      }

      // Update last sync timestamp
      await this.updateSyncConfig(integration.id, {
        lastSyncTimestamp: new Date(),
      });

      return {
        success: errors.length === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // Helper methods for specific resource syncing
  private async syncShopifyOrders(integration: Integration, syncJob: SyncJob, batchSize: number) {
    // Implementation would fetch and sync Shopify orders
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncShopifyProducts(integration: Integration, syncJob: SyncJob, batchSize: number) {
    // Implementation would fetch and sync Shopify products
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncShopifyCustomers(
    integration: Integration,
    syncJob: SyncJob,
    batchSize: number
  ) {
    // Implementation would fetch and sync Shopify customers
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncWooCommerceOrders(
    integration: Integration,
    syncJob: SyncJob,
    batchSize: number
  ) {
    // Implementation would fetch and sync WooCommerce orders
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncWooCommerceProducts(
    integration: Integration,
    syncJob: SyncJob,
    batchSize: number
  ) {
    // Implementation would fetch and sync WooCommerce products
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncStripePayments(integration: Integration, syncJob: SyncJob, batchSize: number) {
    // Implementation would fetch and sync Stripe payments
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async syncStripeCustomers(integration: Integration, syncJob: SyncJob, batchSize: number) {
    // Implementation would fetch and sync Stripe customers
    return { processed: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }

  private async updateSyncJobStatus(
    syncJobId: string,
    status: SyncJob["status"],
    updates: Partial<SyncJob> = {}
  ): Promise<void> {
    const updateFields: string[] = ["status = $2"];
    const updateValues: any[] = [syncJobId, status];
    let paramIndex = 3;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        updateFields.push(`${dbKey} = $${paramIndex++}`);
        updateValues.push(value);
      }
    });

    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date());

    const query = `
      UPDATE sync_jobs 
      SET ${updateFields.join(", ")}
      WHERE id = $1
    `;

    await this.db.query(query, updateValues);
  }

  private mapRowToSyncJob(row: any): SyncJob {
    return {
      id: row.id,
      integrationId: row.integration_id,
      provider: row.provider,
      syncType: row.sync_type,
      status: row.status,
      progress: row.progress,
      totalRecords: row.total_records,
      processedRecords: row.processed_records,
      errorCount: row.error_count,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      lastError: row.last_error,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}
