import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Database connection instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface ShopifyStore {
  id: string;
  site_id: string;
  shop_domain: string;
  access_token?: string;
  scope?: string;
  installed_at?: Date;
  uninstalled_at?: Date;
  status: 'active' | 'inactive' | 'error';
  error_message?: string;
  settings?: ShopifySettings;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShopifySettings {
  display_notifications: boolean;
  notification_position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  notification_delay?: number;
  notification_types?: string[];
  excluded_products?: string[];
  excluded_collections?: string[];
  custom_css?: string;
  [key: string]: any;
}

export interface ShopifyWebhook {
  id: string;
  store_id: string;
  topic: string;
  address: string;
  format: 'json' | 'xml';
  created_at?: Date;
}

/**
 * ShopifyIntegration model class
 */
export class ShopifyIntegration {
  /**
   * Find a Shopify store by domain
   * @param domain Shopify store domain
   * @returns ShopifyStore or null if not found
   */
  static async findByDomain(domain: string): Promise<ShopifyStore | null> {
    try {
      // Find integration record by shop domain
      const integrationResult = await pool.query(`
        SELECT i.id, i.site_id, i.name, i.status, i.error_message, i.settings, i.created_at, i.updated_at
        FROM integrations i
        JOIN integration_types it ON i.integration_type_id = it.id
        WHERE it.name = 'shopify' 
        AND i.settings->>'shop_domain' = $1
      `, [domain]);

      if (integrationResult.rows.length === 0) {
        return null;
      }

      const integration = integrationResult.rows[0];
      
      // Get OAuth credentials if available
      const oauthResult = await pool.query(`
        SELECT access_token_encrypted, refresh_token_encrypted, scope, expires_at
        FROM integration_oauth
        WHERE integration_id = $1
      `, [integration.id]);

      let accessToken = null;
      let scope = null;
      
      if (oauthResult.rows.length > 0) {
        // In a real implementation, you would decrypt these values
        // using the decrypt_value function from the database
        accessToken = oauthResult.rows[0].access_token_encrypted;
        scope = oauthResult.rows[0].scope;
      }

      // Construct ShopifyStore object from query results
      const shopifyStore: ShopifyStore = {
        id: integration.id,
        site_id: integration.site_id,
        shop_domain: integration.settings.shop_domain,
        access_token: accessToken,
        scope: scope,
        status: integration.status as 'active' | 'inactive' | 'error',
        error_message: integration.error_message,
        settings: integration.settings,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
      };

      return shopifyStore;
    } catch (error) {
      console.error('Error finding Shopify store:', error);
      return null;
    }
  }

  /**
   * Create a new Shopify store integration
   * @param storeData ShopifyStore data
   * @returns Created ShopifyStore or null if creation failed
   */
  static async create(storeData: Partial<ShopifyStore>): Promise<ShopifyStore | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First, get the integration_type_id for 'shopify'
      const typeResult = await client.query(`
        SELECT id FROM integration_types WHERE name = 'shopify'
      `);
      
      if (typeResult.rows.length === 0) {
        throw new Error('Shopify integration type not found');
      }
      
      const integrationTypeId = typeResult.rows[0].id;
      const integrationId = uuidv4();
      
      // Insert into integrations table
      const integrationResult = await client.query(`
        INSERT INTO integrations (
          id, site_id, integration_type_id, name, status, error_message, settings, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id, site_id, name, status, error_message, settings, created_at, updated_at
      `, [
        integrationId,
        storeData.site_id,
        integrationTypeId,
        storeData.shop_domain || 'Shopify Store',
        storeData.status || 'inactive',
        storeData.error_message || null,
        JSON.stringify({
          shop_domain: storeData.shop_domain,
          ...storeData.settings
        }),
        storeData.site_id // Assuming site owner is the creator
      ]);
      
      // If OAuth credentials are provided, store them
      if (storeData.access_token) {
        await client.query(`
          INSERT INTO integration_oauth (
            integration_id, access_token_encrypted, scope
          ) VALUES (
            $1, $2, $3
          )
        `, [
          integrationId,
          storeData.access_token, // In real implementation, this would be encrypted
          storeData.scope || ''
        ]);
      }
      
      await client.query('COMMIT');
      
      const integration = integrationResult.rows[0];
      
      // Construct and return the new ShopifyStore object
      const newStore: ShopifyStore = {
        id: integration.id,
        site_id: integration.site_id,
        shop_domain: storeData.shop_domain!,
        access_token: storeData.access_token,
        scope: storeData.scope,
        status: integration.status as 'active' | 'inactive' | 'error',
        error_message: integration.error_message,
        settings: integration.settings,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
      };
      
      return newStore;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating Shopify store:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing Shopify store integration
   * @param id Shopify integration ID
   * @param updateData Data to update
   * @returns Updated ShopifyStore or null if update failed
   */
  static async update(id: string, updateData: Partial<ShopifyStore>): Promise<ShopifyStore | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current integration data
      const currentResult = await client.query(`
        SELECT i.id, i.site_id, i.name, i.status, i.error_message, i.settings, i.created_at, i.updated_at
        FROM integrations i
        WHERE i.id = $1
      `, [id]);
      
      if (currentResult.rows.length === 0) {
        throw new Error('Shopify integration not found');
      }
      
      const current = currentResult.rows[0];
      
      // Update integration settings
      const newSettings = {
        ...current.settings,
        ...updateData.settings
      };
      
      // Update the integration record
      const updateResult = await client.query(`
        UPDATE integrations
        SET name = $1,
            status = $2,
            error_message = $3,
            settings = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, site_id, name, status, error_message, settings, created_at, updated_at
      `, [
        updateData.shop_domain || current.name,
        updateData.status || current.status,
        updateData.error_message !== undefined ? updateData.error_message : current.error_message,
        JSON.stringify(newSettings),
        id
      ]);
      
      // If OAuth credentials are provided, update them
      if (updateData.access_token) {
        // Check if OAuth record already exists
        const oauthExists = await client.query(`
          SELECT 1 FROM integration_oauth WHERE integration_id = $1
        `, [id]);
        
        if (oauthExists.rows.length > 0) {
          await client.query(`
            UPDATE integration_oauth
            SET access_token_encrypted = $1,
                scope = $2,
                updated_at = NOW()
            WHERE integration_id = $3
          `, [
            updateData.access_token, // In real implementation, this would be encrypted
            updateData.scope || current.settings.scope,
            id
          ]);
        } else {
          await client.query(`
            INSERT INTO integration_oauth (
              integration_id, access_token_encrypted, scope
            ) VALUES (
              $1, $2, $3
            )
          `, [
            id,
            updateData.access_token, // In real implementation, this would be encrypted
            updateData.scope || ''
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      const updated = updateResult.rows[0];
      
      // Get updated OAuth credentials
      const oauthResult = await client.query(`
        SELECT access_token_encrypted, scope
        FROM integration_oauth
        WHERE integration_id = $1
      `, [id]);
      
      let accessToken = null;
      let scope = null;
      
      if (oauthResult.rows.length > 0) {
        // In a real implementation, these values would be decrypted
        accessToken = oauthResult.rows[0].access_token_encrypted;
        scope = oauthResult.rows[0].scope;
      }
      
      // Construct and return the updated ShopifyStore object
      const updatedStore: ShopifyStore = {
        id: updated.id,
        site_id: updated.site_id,
        shop_domain: updated.settings.shop_domain,
        access_token: accessToken,
        scope: scope,
        status: updated.status as 'active' | 'inactive' | 'error',
        error_message: updated.error_message,
        settings: updated.settings,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      };
      
      return updatedStore;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating Shopify store:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Register a webhook with a Shopify store
   * @param storeId Shopify integration ID
   * @param topic Webhook topic (e.g., orders/create)
   * @param address Webhook callback URL
   * @returns Created webhook or null if registration failed
   */
  static async registerWebhook(storeId: string, topic: string, address: string): Promise<ShopifyWebhook | null> {
    try {
      // Insert webhook record
      const result = await pool.query(`
        INSERT INTO webhooks (
          integration_id, name, endpoint_url, topics, format
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING id, integration_id, endpoint_url, topics, format, created_at
      `, [
        storeId,
        `Shopify ${topic}`,
        address,
        [topic],
        'json'
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const webhook = result.rows[0];
      
      // Construct and return ShopifyWebhook object
      return {
        id: webhook.id,
        store_id: webhook.integration_id,
        topic: webhook.topics[0],
        address: webhook.endpoint_url,
        format: webhook.format,
        created_at: webhook.created_at
      };
    } catch (error) {
      console.error('Error registering webhook:', error);
      return null;
    }
  }
} 