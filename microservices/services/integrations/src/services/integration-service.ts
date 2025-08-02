import { Pool } from "pg";
import { EventEmitter } from "events";

export interface Integration {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata: Record<string, any>;
  status: "active" | "inactive" | "error" | "pending";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntegrationData {
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, any>;
}

export interface UpdateIntegrationData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, any>;
  status?: "active" | "inactive" | "error" | "pending";
}

export class IntegrationService extends EventEmitter {
  private db: Pool;

  constructor() {
    super();
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }

  private async getOAuthTokens(integrationId: string): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    scope: string | null;
  }> {
    try {
      // Use the database function to get OAuth tokens (supports both storage methods)
      const result = await this.db.query(
        "SELECT * FROM get_oauth_tokens($1)",
        [integrationId]
      );

      if (result.rows.length === 0) {
        return {
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          scope: null,
        };
      }

      const row = result.rows[0];
      return {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
        scope: row.scope,
      };
    } catch (error) {
      // Fallback to direct column access if function fails
      const result = await this.db.query(
        "SELECT access_token, refresh_token, expires_at, scope FROM integrations WHERE id = $1",
        [integrationId]
      );

      if (result.rows.length === 0) {
        return {
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          scope: null,
        };
      }

      const row = result.rows[0];
      return {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
        scope: row.scope,
      };
    }
  }

  async createIntegration(data: CreateIntegrationData): Promise<Integration> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Check if integration already exists for this user and provider
      const existingResult = await client.query(
        "SELECT id FROM integrations WHERE user_id = $1 AND provider = $2 AND provider_account_id = $3",
        [data.userId, data.provider, data.providerAccountId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error("Integration already exists for this provider and account");
      }

      // Create new integration
      const result = await client.query(
        `
        INSERT INTO integrations (
          user_id, provider, provider_account_id, access_token, 
          refresh_token, expires_at, scope, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
        [
          data.userId,
          data.provider,
          data.providerAccountId,
          data.accessToken,
          data.refreshToken,
          data.expiresAt,
          data.scope,
          JSON.stringify(data.metadata || {}),
          "active",
        ]
      );

      await client.query("COMMIT");

      const integration = this.mapRowToIntegration(result.rows[0]);

      // Emit integration created event
      this.emit("integration:created", {
        integration,
        userId: data.userId,
        provider: data.provider,
      });

      return integration;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getIntegration(id: string, userId: string): Promise<Integration | null> {
    const result = await this.db.query(
      "SELECT * FROM integrations WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToIntegration(result.rows[0]);
  }

  async getIntegrationsByUser(userId: string): Promise<Integration[]> {
    const result = await this.db.query(
      "SELECT * FROM integrations WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return result.rows.map((row) => this.mapRowToIntegration(row));
  }

  async getIntegrationsByProvider(userId: string, provider: string): Promise<Integration[]> {
    const result = await this.db.query(
      "SELECT * FROM integrations WHERE user_id = $1 AND provider = $2 ORDER BY created_at DESC",
      [userId, provider]
    );

    return result.rows.map((row) => this.mapRowToIntegration(row));
  }

  async updateIntegration(id: string, data: UpdateIntegrationData): Promise<Integration> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (data.accessToken !== undefined) {
        updateFields.push(`access_token = $${paramIndex++}`);
        updateValues.push(data.accessToken);
      }

      if (data.refreshToken !== undefined) {
        updateFields.push(`refresh_token = $${paramIndex++}`);
        updateValues.push(data.refreshToken);
      }

      if (data.expiresAt !== undefined) {
        updateFields.push(`expires_at = $${paramIndex++}`);
        updateValues.push(data.expiresAt);
      }

      if (data.scope !== undefined) {
        updateFields.push(`scope = $${paramIndex++}`);
        updateValues.push(data.scope);
      }

      if (data.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(data.metadata));
      }

      if (data.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(data.status);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      updateValues.push(id);

      const query = `
        UPDATE integrations 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, updateValues);

      if (result.rows.length === 0) {
        throw new Error("Integration not found");
      }

      await client.query("COMMIT");

      const integration = this.mapRowToIntegration(result.rows[0]);

      // Emit integration updated event
      this.emit("integration:updated", {
        integration,
        changes: data,
      });

      return integration;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteIntegration(id: string, userId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Get integration before deletion for event
      const integration = await this.getIntegration(id, userId);

      if (!integration) {
        throw new Error("Integration not found");
      }

      // Delete integration
      const result = await client.query("DELETE FROM integrations WHERE id = $1 AND user_id = $2", [
        id,
        userId,
      ]);

      if (result.rowCount === 0) {
        throw new Error("Integration not found or not authorized");
      }

      await client.query("COMMIT");

      // Emit integration deleted event
      this.emit("integration:deleted", {
        integration,
        userId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getIntegrationByProviderAccount(
    userId: string,
    provider: string,
    providerAccountId: string
  ): Promise<Integration | null> {
    const result = await this.db.query(
      "SELECT * FROM integrations WHERE user_id = $1 AND provider = $2 AND provider_account_id = $3",
      [userId, provider, providerAccountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToIntegration(result.rows[0]);
  }

  async updateIntegrationStatus(id: string, status: Integration["status"]): Promise<void> {
    await this.db.query("UPDATE integrations SET status = $1, updated_at = $2 WHERE id = $3", [
      status,
      new Date(),
      id,
    ]);

    // Emit status change event
    this.emit("integration:status_changed", {
      integrationId: id,
      status,
    });
  }

  async getExpiredIntegrations(): Promise<Integration[]> {
    const result = await this.db.query(
      "SELECT * FROM integrations WHERE expires_at < $1 AND status = $2",
      [new Date(), "active"]
    );

    return result.rows.map((row) => this.mapRowToIntegration(row));
  }

  async getIntegrationStats(userId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    byProvider: Record<string, number>;
  }> {
    const result = await this.db.query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error,
        provider,
        COUNT(*) as provider_count
      FROM integrations 
      WHERE user_id = $1 
      GROUP BY provider
    `,
      [userId]
    );

    const stats = {
      total: 0,
      active: 0,
      inactive: 0,
      error: 0,
      byProvider: {} as Record<string, number>,
    };

    if (result.rows.length > 0) {
      const firstRow = result.rows[0];
      stats.total = parseInt(firstRow.total);
      stats.active = parseInt(firstRow.active);
      stats.inactive = parseInt(firstRow.inactive);
      stats.error = parseInt(firstRow.error);

      result.rows.forEach((row) => {
        stats.byProvider[row.provider] = parseInt(row.provider_count);
      });
    }

    return stats;
  }

  async testIntegrationConnection(id: string, userId: string): Promise<boolean> {
    const integration = await this.getIntegration(id, userId);

    if (!integration) {
      throw new Error("Integration not found");
    }

    try {
      // This would be implemented based on the specific provider
      // For now, we'll just check if the token exists and hasn't expired
      if (!integration.accessToken) {
        return false;
      }

      if (integration.expiresAt && integration.expiresAt < new Date()) {
        return false;
      }

      // Emit test connection event
      this.emit("integration:connection_tested", {
        integration,
        success: true,
      });

      return true;
    } catch (error) {
      this.emit("integration:connection_tested", {
        integration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return false;
    }
  }

  private mapRowToIntegration(row: any): Integration {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      scope: row.scope,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getIntegrationWithTokens(id: string, userId: string): Promise<Integration | null> {
    const integration = await this.getIntegration(id, userId);
    if (!integration) {
      return null;
    }

    // Get OAuth tokens using the helper method (supports both storage methods)
    const tokens = await this.getOAuthTokens(id);
    
    return {
      ...integration,
      accessToken: tokens.accessToken || integration.accessToken,
      refreshToken: tokens.refreshToken || integration.refreshToken,
      expiresAt: tokens.expiresAt || integration.expiresAt,
      scope: tokens.scope || integration.scope,
    };
  }

  async updateOAuthTokens(
    id: string,
    tokens: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
      scope?: string;
    }
  ): Promise<boolean> {
    try {
      // Use the database function for secure token updates
      const result = await this.db.query(
        "SELECT update_oauth_tokens($1, $2, $3, $4, $5)",
        [
          id,
          tokens.accessToken || null,
          tokens.refreshToken || null,
          tokens.expiresAt || null,
          tokens.scope || null,
        ]
      );

      return result.rows[0]?.update_oauth_tokens || false;
    } catch (error) {
      // Fallback to regular update if function fails
      return await this.updateIntegration(id, tokens).then(() => true).catch(() => false);
    }
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}
