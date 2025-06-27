import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger";
import {
  NotificationInput,
  Notification,
  NotificationTemplate,
  NotificationEventRecord,
} from "../types/events";
import { TemplateRenderer } from "../utils/templateRenderer";

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
}

export class NotificationService {
  private pool: Pool;
  private templateRenderer: TemplateRenderer;

  constructor(
    dbConfig: DbConfig,
    private readonly logger: Logger
  ) {
    this.pool = new Pool(dbConfig);
    this.templateRenderer = new TemplateRenderer(logger);

    // Error handler
    this.pool.on("error", (err: Error) => {
      this.logger.error("Unexpected error on idle database client", err);
    });
  }

  /**
   * Find notification templates for a specific event type and site
   */
  public async findTemplatesForEvent(
    siteId: string,
    eventType: string
  ): Promise<NotificationTemplate[]> {
    try {
      const query = `
        SELECT id, site_id, name, description, channels, content, css, html, event_types, status
        FROM templates
        WHERE site_id = $1 
        AND status = 'active'
        AND $2 = ANY(event_types)
      `;

      const result = await this.pool.query(query, [siteId, eventType]);

      return result.rows.map((row: any) => ({
        id: row.id,
        siteId: row.site_id,
        name: row.name,
        description: row.description,
        channels: row.channels,
        content: row.content,
        css: row.css,
        html: row.html,
        eventTypes: row.event_types,
        status: row.status,
      }));
    } catch (error) {
      this.logger.error("Error finding templates for event", {
        siteId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create a new notification from event data and template
   */
  public async createNotification(input: NotificationInput): Promise<Notification> {
    try {
      // Get the template to render the notification
      const template = await this.getTemplateById(input.templateId);

      if (!template) {
        throw new Error(`Template not found: ${input.templateId}`);
      }

      // Render the notification content using the template and event data
      const content = await this.templateRenderer.render(template, input.eventData);

      // Create the notification in the database
      const notificationId = uuidv4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO notifications (
          id, site_id, template_id, event_type, content, channels, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING id, site_id, template_id, event_type, content, channels, status, created_at, updated_at
      `;

      const values = [
        notificationId,
        input.siteId,
        input.templateId,
        input.eventType,
        content,
        input.channels,
        input.status,
        now,
      ];

      const result = await this.pool.query(query, values);
      const notification = result.rows[0];

      return {
        id: notification.id,
        siteId: notification.site_id,
        templateId: notification.template_id,
        eventType: notification.event_type,
        content: notification.content,
        channels: notification.channels,
        status: notification.status,
        createdAt: notification.created_at,
        updatedAt: notification.updated_at,
      };
    } catch (error) {
      this.logger.error("Error creating notification", {
        templateId: input.templateId,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a notification template by ID
   */
  private async getTemplateById(templateId: string): Promise<NotificationTemplate | null> {
    try {
      const query = `
        SELECT id, site_id, name, description, channels, content, css, html, event_types, status
        FROM templates
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [templateId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        siteId: row.site_id,
        name: row.name,
        description: row.description,
        channels: row.channels,
        content: row.content,
        css: row.css,
        html: row.html,
        eventTypes: row.event_types,
        status: row.status,
      };
    } catch (error) {
      this.logger.error("Error getting template by ID", {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Evaluate targeting rules for a notification
   * Returns true if the notification should be displayed
   */
  public async evaluateTargetingRules(
    notificationId: string,
    eventData: Record<string, any>
  ): Promise<boolean> {
    try {
      // Get targeting rules for the notification
      const query = `
        SELECT trg.id as group_id, trg.operator as group_operator, tr.attribute, tr.operator, tr.value
        FROM targeting_rule_groups trg
        JOIN targeting_rules tr ON tr.rule_group_id = trg.id
        JOIN notifications n ON trg.notification_id = n.id
        WHERE n.id = $1
      `;

      const result = await this.pool.query(query, [notificationId]);

      // If no rules exist, return true (show to everyone)
      if (result.rows.length === 0) {
        return true;
      }

      // Group rules by rule group
      const ruleGroups = new Map<string, { operator: string; rules: any[] }>();

      for (const row of result.rows) {
        if (!ruleGroups.has(row.group_id)) {
          ruleGroups.set(row.group_id, {
            operator: row.group_operator,
            rules: [],
          });
        }

        ruleGroups.get(row.group_id)?.rules.push({
          attribute: row.attribute,
          operator: row.operator,
          value: row.value,
        });
      }

      // Evaluate each rule group (if any group matches, the notification is shown)
      for (const [_, group] of ruleGroups) {
        if (this.evaluateRuleGroup(group, eventData)) {
          return true;
        }
      }

      // If no rule groups match, don't show the notification
      return false;
    } catch (error) {
      this.logger.error("Error evaluating targeting rules", {
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Default to showing notification if there's an error evaluating rules
      return true;
    }
  }

  /**
   * Evaluate a single targeting rule group against event data
   */
  private evaluateRuleGroup(
    group: { operator: string; rules: any[] },
    eventData: Record<string, any>
  ): boolean {
    // If AND, all rules must match
    // If OR, at least one rule must match
    const isAnd = group.operator.toLowerCase() === "and";

    for (const rule of group.rules) {
      const ruleMatches = this.evaluateRule(rule, eventData);

      if (isAnd && !ruleMatches) {
        return false; // Short-circuit for AND
      }

      if (!isAnd && ruleMatches) {
        return true; // Short-circuit for OR
      }
    }

    return isAnd; // If AND, all rules matched; if OR, no rules matched
  }

  /**
   * Evaluate a single targeting rule against event data
   */
  private evaluateRule(
    rule: { attribute: string; operator: string; value: any },
    eventData: Record<string, any>
  ): boolean {
    // Get the attribute value from event data using dot notation
    const attributePath = rule.attribute.split(".");
    let actual = eventData;

    for (const key of attributePath) {
      if (actual === undefined || actual === null) {
        return false;
      }
      actual = actual[key];
    }

    // If the attribute doesn't exist in the event data, rule doesn't match
    if (actual === undefined || actual === null) {
      return false;
    }

    // Evaluate based on operator
    switch (rule.operator.toLowerCase()) {
      case "equals":
        return actual === rule.value;
      case "not_equals":
        return actual !== rule.value;
      case "contains":
        return String(actual).includes(String(rule.value));
      case "not_contains":
        return !String(actual).includes(String(rule.value));
      case "greater_than":
        return Number(actual) > Number(rule.value);
      case "less_than":
        return Number(actual) < Number(rule.value);
      case "in":
        return Array.isArray(rule.value) && rule.value.includes(actual);
      case "not_in":
        return Array.isArray(rule.value) && !rule.value.includes(actual);
      default:
        this.logger.warn("Unknown rule operator", { operator: rule.operator });
        return false;
    }
  }

  /**
   * Update notification status
   */
  public async updateNotificationStatus(notificationId: string, status: string): Promise<void> {
    try {
      const query = `
        UPDATE notifications
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await this.pool.query(query, [status, notificationId]);
    } catch (error) {
      this.logger.error("Error updating notification status", {
        notificationId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record notification event for analytics
   */
  public async recordNotificationEvent(event: NotificationEventRecord): Promise<void> {
    try {
      const query = `
        INSERT INTO notification_events (
          id, site_id, notification_id, event_type, metadata, time
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;

      await this.pool.query(query, [
        uuidv4(),
        event.siteId,
        event.notificationId,
        event.eventType,
        event.metadata || {},
      ]);
    } catch (error) {
      this.logger.error("Error recording notification event", {
        notificationId: event.notificationId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Non-fatal error, don't rethrow
    }
  }

  /**
   * Get sites for organization with pagination and search
   */
  public async getSites(organizationId: string, options: { page: number; limit: number; search?: string }): Promise<any> {
    try {
      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT id, name, domain, description, settings, is_active, created_at, updated_at
        FROM sites
        WHERE organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (options.search) {
        query += ` AND (name ILIKE $${params.length + 1} OR domain ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM sites WHERE organization_id = $1`;
      const countParams: any[] = [organizationId];
      
      if (options.search) {
        countQuery += ` AND (name ILIKE $2 OR domain ILIKE $2)`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        sites: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting sites", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get site by ID for organization
   */
  public async getSiteById(siteId: string, organizationId: string): Promise<any | null> {
    try {
      const query = `
        SELECT id, name, domain, description, settings, is_active, created_at, updated_at
        FROM sites
        WHERE id = $1 AND organization_id = $2
      `;

      const result = await this.pool.query(query, [siteId, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error getting site by ID", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create new site
   */
  public async createSite(siteData: any): Promise<any> {
    try {
      const siteId = uuidv4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO sites (
          id, organization_id, name, domain, description, settings, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING id, name, domain, description, settings, is_active, created_at, updated_at
      `;

      const values = [
        siteId,
        siteData.organizationId,
        siteData.name,
        siteData.domain,
        siteData.description || null,
        JSON.stringify(siteData.settings || {}),
        siteData.isActive !== undefined ? siteData.isActive : true,
        siteData.createdBy,
        now,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error("Error creating site", {
        siteData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update site
   */
  public async updateSite(siteId: string, organizationId: string, updateData: any): Promise<any | null> {
    try {
      const now = new Date().toISOString();
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }
      if (updateData.domain !== undefined) {
        setClauses.push(`domain = $${paramIndex++}`);
        values.push(updateData.domain);
      }
      if (updateData.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updateData.description);
      }
      if (updateData.settings !== undefined) {
        setClauses.push(`settings = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.settings));
      }
      if (updateData.isActive !== undefined) {
        setClauses.push(`is_active = $${paramIndex++}`);
        values.push(updateData.isActive);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      if (updateData.updatedBy) {
        setClauses.push(`updated_by = $${paramIndex++}`);
        values.push(updateData.updatedBy);
      }

      values.push(siteId, organizationId);

      const query = `
        UPDATE sites
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
        RETURNING id, name, domain, description, settings, is_active, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error updating site", {
        siteId,
        organizationId,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete site
   */
  public async deleteSite(siteId: string, organizationId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM sites
        WHERE id = $1 AND organization_id = $2
      `;

      const result = await this.pool.query(query, [siteId, organizationId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.logger.error("Error deleting site", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get site statistics
   */
  public async getSiteStats(siteId: string, organizationId: string): Promise<any> {
    try {
      // Verify site belongs to organization
      const siteQuery = `
        SELECT id FROM sites WHERE id = $1 AND organization_id = $2
      `;
      const siteResult = await this.pool.query(siteQuery, [siteId, organizationId]);
      
      if (siteResult.rows.length === 0) {
        return null;
      }

      // Get basic stats
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT n.id) as total_notifications,
          COUNT(DISTINCT t.id) as total_templates,
          COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) as delivered_notifications,
          COUNT(CASE WHEN n.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as notifications_24h
        FROM sites s
        LEFT JOIN templates t ON t.site_id = s.id
        LEFT JOIN notifications n ON n.site_id = s.id
        WHERE s.id = $1
        GROUP BY s.id
      `;

      const statsResult = await this.pool.query(statsQuery, [siteId]);
      const stats = statsResult.rows[0] || {
        total_notifications: 0,
        total_templates: 0,
        delivered_notifications: 0,
        notifications_24h: 0,
      };

      return {
        totalNotifications: parseInt(stats.total_notifications) || 0,
        totalTemplates: parseInt(stats.total_templates) || 0,
        deliveredNotifications: parseInt(stats.delivered_notifications) || 0,
        notifications24h: parseInt(stats.notifications_24h) || 0,
        deliveryRate: stats.total_notifications > 0 
          ? ((stats.delivered_notifications / stats.total_notifications) * 100).toFixed(2)
          : '0.00',
      };
    } catch (error) {
      this.logger.error("Error getting site stats", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get templates for organization with pagination and search
   */
  public async getTemplates(organizationId: string, options: { page: number; limit: number; search?: string; siteId?: string }): Promise<any> {
    try {
      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT t.id, t.name, t.description, t.site_id, t.channels, t.content, t.event_types, t.status, t.created_at, t.updated_at,
               s.name as site_name
        FROM templates t
        JOIN sites s ON t.site_id = s.id
        WHERE s.organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (options.siteId) {
        query += ` AND t.site_id = $${params.length + 1}`;
        params.push(options.siteId);
      }

      if (options.search) {
        query += ` AND (t.name ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM templates t
        JOIN sites s ON t.site_id = s.id
        WHERE s.organization_id = $1
      `;
      const countParams: any[] = [organizationId];
      
      if (options.siteId) {
        countQuery += ` AND t.site_id = $${countParams.length + 1}`;
        countParams.push(options.siteId);
      }

      if (options.search) {
        countQuery += ` AND (t.name ILIKE $${countParams.length + 1} OR t.description ILIKE $${countParams.length + 1})`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        templates: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting templates", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get templates for specific site
   */
  public async getTemplatesBySite(siteId: string, organizationId: string, options: { page: number; limit: number; search?: string }): Promise<any> {
    try {
      // Verify site belongs to organization
      const siteQuery = `SELECT id FROM sites WHERE id = $1 AND organization_id = $2`;
      const siteResult = await this.pool.query(siteQuery, [siteId, organizationId]);
      
      if (siteResult.rows.length === 0) {
        throw new Error('Site not found or access denied');
      }

      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT id, name, description, site_id, channels, content, event_types, status, created_at, updated_at
        FROM templates
        WHERE site_id = $1
      `;
      const params: any[] = [siteId];

      if (options.search) {
        query += ` AND (name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM templates WHERE site_id = $1`;
      const countParams: any[] = [siteId];
      
      if (options.search) {
        countQuery += ` AND (name ILIKE $2 OR description ILIKE $2)`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        templates: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting templates by site", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get template by ID for organization (public version)
   */
  public async getTemplateByIdForOrg(templateId: string, organizationId: string): Promise<any | null> {
    try {
      const query = `
        SELECT t.id, t.name, t.description, t.site_id, t.channels, t.content, t.event_types, t.status, t.created_at, t.updated_at,
               s.name as site_name
        FROM templates t
        JOIN sites s ON t.site_id = s.id
        WHERE t.id = $1 AND s.organization_id = $2
      `;

      const result = await this.pool.query(query, [templateId, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error getting template by ID for organization", {
        templateId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create new template
   */
  public async createTemplate(templateData: any): Promise<any> {
    try {
      const templateId = uuidv4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO templates (
          id, site_id, name, description, channels, content, event_types, status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        RETURNING id, name, description, site_id, channels, content, event_types, status, created_at, updated_at
      `;

      const values = [
        templateId,
        templateData.siteId,
        templateData.name,
        templateData.description || null,
        JSON.stringify(templateData.channels || []),
        JSON.stringify(templateData.content || {}),
        JSON.stringify(templateData.eventTypes || []),
        templateData.status || 'draft',
        templateData.createdBy,
        now,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error("Error creating template", {
        templateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update template
   */
  public async updateTemplate(templateId: string, organizationId: string, updateData: any): Promise<any | null> {
    try {
      // First verify template belongs to organization
      const verifyQuery = `
        SELECT t.id FROM templates t
        JOIN sites s ON t.site_id = s.id
        WHERE t.id = $1 AND s.organization_id = $2
      `;
      const verifyResult = await this.pool.query(verifyQuery, [templateId, organizationId]);
      
      if (verifyResult.rows.length === 0) {
        return null;
      }

      const now = new Date().toISOString();
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }
      if (updateData.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updateData.description);
      }
      if (updateData.channels !== undefined) {
        setClauses.push(`channels = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.channels));
      }
      if (updateData.content !== undefined) {
        setClauses.push(`content = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.content));
      }
      if (updateData.eventTypes !== undefined) {
        setClauses.push(`event_types = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.eventTypes));
      }
      if (updateData.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updateData.status);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      if (updateData.updatedBy) {
        setClauses.push(`updated_by = $${paramIndex++}`);
        values.push(updateData.updatedBy);
      }

      values.push(templateId);

      const query = `
        UPDATE templates
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++}
        RETURNING id, name, description, site_id, channels, content, event_types, status, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error updating template", {
        templateId,
        organizationId,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete template
   */
  public async deleteTemplate(templateId: string, organizationId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM templates
        WHERE id = $1 AND EXISTS (
          SELECT 1 FROM sites s WHERE s.id = templates.site_id AND s.organization_id = $2
        )
      `;

      const result = await this.pool.query(query, [templateId, organizationId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.logger.error("Error deleting template", {
        templateId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Duplicate template
   */
  public async duplicateTemplate(templateId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      // Get original template
      const originalTemplate = await this.getTemplateByIdForOrg(templateId, organizationId);
      if (!originalTemplate) {
        return null;
      }

      // Create duplicate with modified name
      const duplicateData = {
        siteId: originalTemplate.site_id,
        name: `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        channels: JSON.parse(originalTemplate.channels || '[]'),
        content: JSON.parse(originalTemplate.content || '{}'),
        eventTypes: JSON.parse(originalTemplate.event_types || '[]'),
        status: 'draft',
        createdBy: userId,
      };

      return await this.createTemplate(duplicateData);
    } catch (error) {
      this.logger.error("Error duplicating template", {
        templateId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create default template (legacy method)
   */
  public async createDefaultTemplate(siteId: string, options: { site_name?: string; site_domain?: string; organization_id?: string }): Promise<any> {
    try {
      // First, ensure the site exists in the notifications database
      const siteCheck = await this.pool.query("SELECT id FROM sites WHERE id = $1", [siteId]);

      if (siteCheck.rows.length === 0) {
        // Site doesn't exist, create it
        console.log(`Site ${siteId} doesn't exist in notifications DB, creating it...`);
        
        await this.pool.query(
          `INSERT INTO sites (id, organization_id, name, domain, verified_at, settings, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), NOW())`,
          [
            siteId,
            options.organization_id || "00000000-0000-0000-0000-000000000000",
            options.site_name || "Test Site",
            options.site_domain || `test-site-${siteId.slice(-8)}.example.com`,
            JSON.stringify({ is_test_site: true, created_by_notifications_service: true })
          ]
        );
        
        console.log(`✅ Site ${siteId} created in notifications database`);
      }

      // Create default template
      const templateId = uuidv4();
      const now = new Date().toISOString();

      const defaultTemplate = {
        id: templateId,
        site_id: siteId,
        name: "Default Purchase Notification",
        description: "Default template for purchase notifications",
        channels: JSON.stringify(["popup"]),
        content: JSON.stringify({
          popup: {
            title: "🎉 Someone just purchased!",
            message: "{{customer_name}} from {{location}} just bought {{product_name}}",
            style: {
              position: "bottom-left",
              theme: "light"
            }
          }
        }),
        event_types: JSON.stringify(["purchase"]),
        status: "active",
        created_by: options.organization_id || "00000000-0000-0000-0000-000000000000",
        created_at: now,
        updated_at: now,
      };

      const query = `
        INSERT INTO templates (
          id, site_id, name, description, channels, content, event_types, status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        defaultTemplate.id,
        defaultTemplate.site_id,
        defaultTemplate.name,
        defaultTemplate.description,
        defaultTemplate.channels,
        defaultTemplate.content,
        defaultTemplate.event_types,
        defaultTemplate.status,
        defaultTemplate.created_by,
        defaultTemplate.created_at,
        defaultTemplate.updated_at,
      ];

      const result = await this.pool.query(query, values);
      console.log(`✅ Default template created with ID: ${templateId}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error("Error creating default template", {
        siteId,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get campaigns for organization with pagination and search
   */
  public async getCampaigns(organizationId: string, options: { page: number; limit: number; search?: string; status?: string; siteId?: string }): Promise<any> {
    try {
      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT c.id, c.name, c.description, c.site_id, c.template_id, c.status, c.start_date, c.end_date, c.settings, c.targeting_rules, c.created_at, c.updated_at,
               s.name as site_name, t.name as template_name
        FROM campaigns c
        JOIN sites s ON c.site_id = s.id
        LEFT JOIN templates t ON c.template_id = t.id
        WHERE s.organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (options.siteId) {
        query += ` AND c.site_id = $${params.length + 1}`;
        params.push(options.siteId);
      }

      if (options.status) {
        query += ` AND c.status = $${params.length + 1}`;
        params.push(options.status);
      }

      if (options.search) {
        query += ` AND (c.name ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM campaigns c
        JOIN sites s ON c.site_id = s.id
        WHERE s.organization_id = $1
      `;
      const countParams: any[] = [organizationId];
      
      if (options.siteId) {
        countQuery += ` AND c.site_id = $${countParams.length + 1}`;
        countParams.push(options.siteId);
      }

      if (options.status) {
        countQuery += ` AND c.status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }

      if (options.search) {
        countQuery += ` AND (c.name ILIKE $${countParams.length + 1} OR c.description ILIKE $${countParams.length + 1})`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        campaigns: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting campaigns", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get campaigns for specific site
   */
  public async getCampaignsBySite(siteId: string, organizationId: string, options: { page: number; limit: number; search?: string; status?: string }): Promise<any> {
    try {
      // Verify site belongs to organization
      const siteQuery = `SELECT id FROM sites WHERE id = $1 AND organization_id = $2`;
      const siteResult = await this.pool.query(siteQuery, [siteId, organizationId]);
      
      if (siteResult.rows.length === 0) {
        throw new Error('Site not found or access denied');
      }

      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT c.id, c.name, c.description, c.site_id, c.template_id, c.status, c.start_date, c.end_date, c.settings, c.targeting_rules, c.created_at, c.updated_at,
               t.name as template_name
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        WHERE c.site_id = $1
      `;
      const params: any[] = [siteId];

      if (options.status) {
        query += ` AND c.status = $${params.length + 1}`;
        params.push(options.status);
      }

      if (options.search) {
        query += ` AND (c.name ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM campaigns WHERE site_id = $1`;
      const countParams: any[] = [siteId];
      
      if (options.status) {
        countQuery += ` AND status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }

      if (options.search) {
        countQuery += ` AND (name ILIKE $${countParams.length + 1} OR description ILIKE $${countParams.length + 1})`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        campaigns: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting campaigns by site", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get campaign by ID for organization
   */
  public async getCampaignById(campaignId: string, organizationId: string): Promise<any | null> {
    try {
      const query = `
        SELECT c.id, c.name, c.description, c.site_id, c.template_id, c.status, c.start_date, c.end_date, c.settings, c.targeting_rules, c.created_at, c.updated_at,
               s.name as site_name, t.name as template_name
        FROM campaigns c
        JOIN sites s ON c.site_id = s.id
        LEFT JOIN templates t ON c.template_id = t.id
        WHERE c.id = $1 AND s.organization_id = $2
      `;

      const result = await this.pool.query(query, [campaignId, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error getting campaign by ID", {
        campaignId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create new campaign
   */
  public async createCampaign(campaignData: any): Promise<any> {
    try {
      const campaignId = uuidv4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO campaigns (
          id, site_id, template_id, name, description, status, start_date, end_date, settings, targeting_rules, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id, name, description, site_id, template_id, status, start_date, end_date, settings, targeting_rules, created_at, updated_at
      `;

      const values = [
        campaignId,
        campaignData.siteId,
        campaignData.templateId,
        campaignData.name,
        campaignData.description || null,
        campaignData.status || 'draft',
        campaignData.startDate || null,
        campaignData.endDate || null,
        JSON.stringify(campaignData.settings || {}),
        JSON.stringify(campaignData.targetingRules || []),
        campaignData.createdBy,
        now,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error("Error creating campaign", {
        campaignData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update campaign
   */
  public async updateCampaign(campaignId: string, organizationId: string, updateData: any): Promise<any | null> {
    try {
      // First verify campaign belongs to organization
      const verifyQuery = `
        SELECT c.id FROM campaigns c
        JOIN sites s ON c.site_id = s.id
        WHERE c.id = $1 AND s.organization_id = $2
      `;
      const verifyResult = await this.pool.query(verifyQuery, [campaignId, organizationId]);
      
      if (verifyResult.rows.length === 0) {
        return null;
      }

      const now = new Date().toISOString();
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }
      if (updateData.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updateData.description);
      }
      if (updateData.templateId !== undefined) {
        setClauses.push(`template_id = $${paramIndex++}`);
        values.push(updateData.templateId);
      }
      if (updateData.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updateData.status);
      }
      if (updateData.startDate !== undefined) {
        setClauses.push(`start_date = $${paramIndex++}`);
        values.push(updateData.startDate);
      }
      if (updateData.endDate !== undefined) {
        setClauses.push(`end_date = $${paramIndex++}`);
        values.push(updateData.endDate);
      }
      if (updateData.settings !== undefined) {
        setClauses.push(`settings = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.settings));
      }
      if (updateData.targetingRules !== undefined) {
        setClauses.push(`targeting_rules = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.targetingRules));
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      if (updateData.updatedBy) {
        setClauses.push(`updated_by = $${paramIndex++}`);
        values.push(updateData.updatedBy);
      }

      values.push(campaignId);

      const query = `
        UPDATE campaigns
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++}
        RETURNING id, name, description, site_id, template_id, status, start_date, end_date, settings, targeting_rules, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error updating campaign", {
        campaignId,
        organizationId,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete campaign
   */
  public async deleteCampaign(campaignId: string, organizationId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM campaigns
        WHERE id = $1 AND EXISTS (
          SELECT 1 FROM sites s WHERE s.id = campaigns.site_id AND s.organization_id = $2
        )
      `;

      const result = await this.pool.query(query, [campaignId, organizationId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.logger.error("Error deleting campaign", {
        campaignId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start campaign
   */
  public async startCampaign(campaignId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      const updateData = {
        status: 'active',
        startDate: new Date().toISOString(),
        updatedBy: userId,
      };

      return await this.updateCampaign(campaignId, organizationId, updateData);
    } catch (error) {
      this.logger.error("Error starting campaign", {
        campaignId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  public async pauseCampaign(campaignId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      const updateData = {
        status: 'paused',
        updatedBy: userId,
      };

      return await this.updateCampaign(campaignId, organizationId, updateData);
    } catch (error) {
      this.logger.error("Error pausing campaign", {
        campaignId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get campaign statistics
   */
  public async getCampaignStats(campaignId: string, organizationId: string): Promise<any | null> {
    try {
      // Verify campaign belongs to organization
      const campaignQuery = `
        SELECT c.id FROM campaigns c
        JOIN sites s ON c.site_id = s.id
        WHERE c.id = $1 AND s.organization_id = $2
      `;
      const campaignResult = await this.pool.query(campaignQuery, [campaignId, organizationId]);
      
      if (campaignResult.rows.length === 0) {
        return null;
      }

      // Get basic stats
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT n.id) as total_notifications,
          COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) as delivered_notifications,
          COUNT(CASE WHEN n.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as notifications_24h,
          COUNT(CASE WHEN ne.event_type = 'click' THEN 1 END) as total_clicks,
          COUNT(CASE WHEN ne.event_type = 'view' THEN 1 END) as total_views
        FROM campaigns c
        LEFT JOIN notifications n ON n.site_id = c.site_id
        LEFT JOIN notification_events ne ON ne.notification_id = n.id
        WHERE c.id = $1
        GROUP BY c.id
      `;

      const statsResult = await this.pool.query(statsQuery, [campaignId]);
      const stats = statsResult.rows[0] || {
        total_notifications: 0,
        delivered_notifications: 0,
        notifications_24h: 0,
        total_clicks: 0,
        total_views: 0,
      };

      return {
        totalNotifications: parseInt(stats.total_notifications) || 0,
        deliveredNotifications: parseInt(stats.delivered_notifications) || 0,
        notifications24h: parseInt(stats.notifications_24h) || 0,
        totalClicks: parseInt(stats.total_clicks) || 0,
        totalViews: parseInt(stats.total_views) || 0,
        deliveryRate: stats.total_notifications > 0 
          ? ((stats.delivered_notifications / stats.total_notifications) * 100).toFixed(2)
          : '0.00',
        clickThroughRate: stats.total_views > 0
          ? ((stats.total_clicks / stats.total_views) * 100).toFixed(2)
          : '0.00',
      };
    } catch (error) {
      this.logger.error("Error getting campaign stats", {
        campaignId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get A/B tests for organization with pagination and search
   */
  public async getAbTests(organizationId: string, options: { page: number; limit: number; search?: string; status?: string; siteId?: string }): Promise<any> {
    try {
      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT ab.id, ab.name, ab.description, ab.site_id, ab.control_template_id, ab.variant_template_id, ab.traffic_split, ab.status, ab.start_date, ab.end_date, ab.hypothesis, ab.success_metric, ab.minimum_sample_size, ab.created_at, ab.updated_at,
               s.name as site_name, ct.name as control_template_name, vt.name as variant_template_name
        FROM ab_tests ab
        JOIN sites s ON ab.site_id = s.id
        LEFT JOIN templates ct ON ab.control_template_id = ct.id
        LEFT JOIN templates vt ON ab.variant_template_id = vt.id
        WHERE s.organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (options.siteId) {
        query += ` AND ab.site_id = $${params.length + 1}`;
        params.push(options.siteId);
      }

      if (options.status) {
        query += ` AND ab.status = $${params.length + 1}`;
        params.push(options.status);
      }

      if (options.search) {
        query += ` AND (ab.name ILIKE $${params.length + 1} OR ab.description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY ab.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM ab_tests ab
        JOIN sites s ON ab.site_id = s.id
        WHERE s.organization_id = $1
      `;
      const countParams: any[] = [organizationId];
      
      if (options.siteId) {
        countQuery += ` AND ab.site_id = $${countParams.length + 1}`;
        countParams.push(options.siteId);
      }

      if (options.status) {
        countQuery += ` AND ab.status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }

      if (options.search) {
        countQuery += ` AND (ab.name ILIKE $${countParams.length + 1} OR ab.description ILIKE $${countParams.length + 1})`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        abTests: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting A/B tests", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get A/B tests for specific site
   */
  public async getAbTestsBySite(siteId: string, organizationId: string, options: { page: number; limit: number; search?: string; status?: string }): Promise<any> {
    try {
      // Verify site belongs to organization
      const siteQuery = `SELECT id FROM sites WHERE id = $1 AND organization_id = $2`;
      const siteResult = await this.pool.query(siteQuery, [siteId, organizationId]);
      
      if (siteResult.rows.length === 0) {
        throw new Error('Site not found or access denied');
      }

      const offset = (options.page - 1) * options.limit;
      let query = `
        SELECT ab.id, ab.name, ab.description, ab.site_id, ab.control_template_id, ab.variant_template_id, ab.traffic_split, ab.status, ab.start_date, ab.end_date, ab.hypothesis, ab.success_metric, ab.minimum_sample_size, ab.created_at, ab.updated_at,
               ct.name as control_template_name, vt.name as variant_template_name
        FROM ab_tests ab
        LEFT JOIN templates ct ON ab.control_template_id = ct.id
        LEFT JOIN templates vt ON ab.variant_template_id = vt.id
        WHERE ab.site_id = $1
      `;
      const params: any[] = [siteId];

      if (options.status) {
        query += ` AND ab.status = $${params.length + 1}`;
        params.push(options.status);
      }

      if (options.search) {
        query += ` AND (ab.name ILIKE $${params.length + 1} OR ab.description ILIKE $${params.length + 1})`;
        params.push(`%${options.search}%`);
      }

      query += ` ORDER BY ab.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM ab_tests WHERE site_id = $1`;
      const countParams: any[] = [siteId];
      
      if (options.status) {
        countQuery += ` AND status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }

      if (options.search) {
        countQuery += ` AND (name ILIKE $${countParams.length + 1} OR description ILIKE $${countParams.length + 1})`;
        countParams.push(`%${options.search}%`);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        abTests: result.rows,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting A/B tests by site", {
        siteId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get A/B test by ID for organization
   */
  public async getAbTestById(abTestId: string, organizationId: string): Promise<any | null> {
    try {
      const query = `
        SELECT ab.id, ab.name, ab.description, ab.site_id, ab.control_template_id, ab.variant_template_id, ab.traffic_split, ab.status, ab.start_date, ab.end_date, ab.hypothesis, ab.success_metric, ab.minimum_sample_size, ab.created_at, ab.updated_at,
               s.name as site_name, ct.name as control_template_name, vt.name as variant_template_name
        FROM ab_tests ab
        JOIN sites s ON ab.site_id = s.id
        LEFT JOIN templates ct ON ab.control_template_id = ct.id
        LEFT JOIN templates vt ON ab.variant_template_id = vt.id
        WHERE ab.id = $1 AND s.organization_id = $2
      `;

      const result = await this.pool.query(query, [abTestId, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error getting A/B test by ID", {
        abTestId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create new A/B test
   */
  public async createAbTest(abTestData: any): Promise<any> {
    try {
      const abTestId = uuidv4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO ab_tests (
          id, site_id, control_template_id, variant_template_id, name, description, traffic_split, status, start_date, end_date, hypothesis, success_metric, minimum_sample_size, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
        RETURNING id, name, description, site_id, control_template_id, variant_template_id, traffic_split, status, start_date, end_date, hypothesis, success_metric, minimum_sample_size, created_at, updated_at
      `;

      const values = [
        abTestId,
        abTestData.siteId,
        abTestData.controlTemplateId,
        abTestData.variantTemplateId,
        abTestData.name,
        abTestData.description || null,
        abTestData.trafficSplit || 50,
        abTestData.status || 'draft',
        abTestData.startDate || null,
        abTestData.endDate || null,
        abTestData.hypothesis || null,
        abTestData.successMetric || 'click_rate',
        abTestData.minimumSampleSize || 100,
        abTestData.createdBy,
        now,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error("Error creating A/B test", {
        abTestData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update A/B test
   */
  public async updateAbTest(abTestId: string, organizationId: string, updateData: any): Promise<any | null> {
    try {
      // First verify A/B test belongs to organization
      const verifyQuery = `
        SELECT ab.id FROM ab_tests ab
        JOIN sites s ON ab.site_id = s.id
        WHERE ab.id = $1 AND s.organization_id = $2
      `;
      const verifyResult = await this.pool.query(verifyQuery, [abTestId, organizationId]);
      
      if (verifyResult.rows.length === 0) {
        return null;
      }

      const now = new Date().toISOString();
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }
      if (updateData.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updateData.description);
      }
      if (updateData.controlTemplateId !== undefined) {
        setClauses.push(`control_template_id = $${paramIndex++}`);
        values.push(updateData.controlTemplateId);
      }
      if (updateData.variantTemplateId !== undefined) {
        setClauses.push(`variant_template_id = $${paramIndex++}`);
        values.push(updateData.variantTemplateId);
      }
      if (updateData.trafficSplit !== undefined) {
        setClauses.push(`traffic_split = $${paramIndex++}`);
        values.push(updateData.trafficSplit);
      }
      if (updateData.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updateData.status);
      }
      if (updateData.startDate !== undefined) {
        setClauses.push(`start_date = $${paramIndex++}`);
        values.push(updateData.startDate);
      }
      if (updateData.endDate !== undefined) {
        setClauses.push(`end_date = $${paramIndex++}`);
        values.push(updateData.endDate);
      }
      if (updateData.hypothesis !== undefined) {
        setClauses.push(`hypothesis = $${paramIndex++}`);
        values.push(updateData.hypothesis);
      }
      if (updateData.successMetric !== undefined) {
        setClauses.push(`success_metric = $${paramIndex++}`);
        values.push(updateData.successMetric);
      }
      if (updateData.minimumSampleSize !== undefined) {
        setClauses.push(`minimum_sample_size = $${paramIndex++}`);
        values.push(updateData.minimumSampleSize);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      if (updateData.updatedBy) {
        setClauses.push(`updated_by = $${paramIndex++}`);
        values.push(updateData.updatedBy);
      }

      values.push(abTestId);

      const query = `
        UPDATE ab_tests
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++}
        RETURNING id, name, description, site_id, control_template_id, variant_template_id, traffic_split, status, start_date, end_date, hypothesis, success_metric, minimum_sample_size, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error("Error updating A/B test", {
        abTestId,
        organizationId,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete A/B test
   */
  public async deleteAbTest(abTestId: string, organizationId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM ab_tests
        WHERE id = $1 AND EXISTS (
          SELECT 1 FROM sites s WHERE s.id = ab_tests.site_id AND s.organization_id = $2
        )
      `;

      const result = await this.pool.query(query, [abTestId, organizationId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.logger.error("Error deleting A/B test", {
        abTestId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start A/B test
   */
  public async startAbTest(abTestId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      const updateData = {
        status: 'running',
        startDate: new Date().toISOString(),
        updatedBy: userId,
      };

      return await this.updateAbTest(abTestId, organizationId, updateData);
    } catch (error) {
      this.logger.error("Error starting A/B test", {
        abTestId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Pause A/B test
   */
  public async pauseAbTest(abTestId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      const updateData = {
        status: 'paused',
        updatedBy: userId,
      };

      return await this.updateAbTest(abTestId, organizationId, updateData);
    } catch (error) {
      this.logger.error("Error pausing A/B test", {
        abTestId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Complete A/B test
   */
  public async completeAbTest(abTestId: string, organizationId: string, userId: string): Promise<any | null> {
    try {
      const updateData = {
        status: 'completed',
        endDate: new Date().toISOString(),
        updatedBy: userId,
      };

      return await this.updateAbTest(abTestId, organizationId, updateData);
    } catch (error) {
      this.logger.error("Error completing A/B test", {
        abTestId,
        organizationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  public async getAbTestResults(abTestId: string, organizationId: string): Promise<any | null> {
    try {
      // Verify A/B test belongs to organization
      const abTestQuery = `
        SELECT ab.id, ab.control_template_id, ab.variant_template_id, ab.success_metric FROM ab_tests ab
        JOIN sites s ON ab.site_id = s.id
        WHERE ab.id = $1 AND s.organization_id = $2
      `;
      const abTestResult = await this.pool.query(abTestQuery, [abTestId, organizationId]);
      
      if (abTestResult.rows.length === 0) {
        return null;
      }

      const abTest = abTestResult.rows[0];

      // Get results for control and variant
      const resultsQuery = `
        SELECT 
          atr.variant_type,
          COUNT(DISTINCT atr.id) as total_participants,
          COUNT(CASE WHEN ne.event_type = 'view' THEN 1 END) as total_views,
          COUNT(CASE WHEN ne.event_type = 'click' THEN 1 END) as total_clicks,
          COUNT(CASE WHEN ne.event_type = 'conversion' THEN 1 END) as total_conversions
        FROM ab_test_results atr
        LEFT JOIN notification_events ne ON ne.notification_id = atr.notification_id
        WHERE atr.ab_test_id = $1
        GROUP BY atr.variant_type
      `;

      const resultsResult = await this.pool.query(resultsQuery, [abTestId]);
      
      const controlResults = resultsResult.rows.find(r => r.variant_type === 'control') || {
        variant_type: 'control',
        total_participants: 0,
        total_views: 0,
        total_clicks: 0,
        total_conversions: 0,
      };

      const variantResults = resultsResult.rows.find(r => r.variant_type === 'variant') || {
        variant_type: 'variant',
        total_participants: 0,
        total_views: 0,
        total_clicks: 0,
        total_conversions: 0,
      };

      // Calculate metrics
      const controlClickRate = controlResults.total_views > 0 
        ? (controlResults.total_clicks / controlResults.total_views * 100).toFixed(2)
        : '0.00';
      
      const variantClickRate = variantResults.total_views > 0 
        ? (variantResults.total_clicks / variantResults.total_views * 100).toFixed(2)
        : '0.00';

      const controlConversionRate = controlResults.total_participants > 0 
        ? (controlResults.total_conversions / controlResults.total_participants * 100).toFixed(2)
        : '0.00';
      
      const variantConversionRate = variantResults.total_participants > 0 
        ? (variantResults.total_conversions / variantResults.total_participants * 100).toFixed(2)
        : '0.00';

      // Calculate statistical significance (simplified)
      const improvement = abTest.success_metric === 'click_rate' 
        ? ((parseFloat(variantClickRate) - parseFloat(controlClickRate)) / parseFloat(controlClickRate) * 100).toFixed(2)
        : ((parseFloat(variantConversionRate) - parseFloat(controlConversionRate)) / parseFloat(controlConversionRate) * 100).toFixed(2);

      return {
        abTestId,
        successMetric: abTest.success_metric,
        control: {
          templateId: abTest.control_template_id,
          participants: parseInt(controlResults.total_participants),
          views: parseInt(controlResults.total_views),
          clicks: parseInt(controlResults.total_clicks),
          conversions: parseInt(controlResults.total_conversions),
          clickRate: controlClickRate,
          conversionRate: controlConversionRate,
        },
        variant: {
          templateId: abTest.variant_template_id,
          participants: parseInt(variantResults.total_participants),
          views: parseInt(variantResults.total_views),
          clicks: parseInt(variantResults.total_clicks),
          conversions: parseInt(variantResults.total_conversions),
          clickRate: variantClickRate,
          conversionRate: variantConversionRate,
        },
        improvement: improvement,
        winner: parseFloat(improvement) > 0 ? 'variant' : 'control',
        isSignificant: Math.abs(parseFloat(improvement)) > 5, // Simplified significance test
      };
    } catch (error) {
      this.logger.error("Error getting A/B test results", {
        abTestId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get targeting rules for organization
   */
  public async getTargetingRules(organizationId: string, options: { page: number; limit: number; search?: string; status?: string; siteId?: string }): Promise<any> {
    try {
      const { page, limit, search, status, siteId } = options;
      const offset = (page - 1) * limit;

      let whereConditions = ['s.organization_id = $1'];
      let queryParams: any[] = [organizationId];
      let paramIndex = 2;

      if (search) {
        whereConditions.push(`(tr.name ILIKE $${paramIndex} OR tr.description ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`tr.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (siteId) {
        whereConditions.push(`tr.site_id = $${paramIndex}`);
        queryParams.push(siteId);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT tr.id) as total
        FROM targeting_rules tr
        JOIN sites s ON tr.site_id = s.id
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get targeting rules
      const query = `
        SELECT 
          tr.id,
          tr.name,
          tr.description,
          tr.site_id,
          tr.conditions,
          tr.operator,
          tr.status,
          tr.priority,
          tr.created_at,
          tr.updated_at,
          tr.created_by,
          tr.updated_by,
          s.name as site_name,
          s.domain as site_domain
        FROM targeting_rules tr
        JOIN sites s ON tr.site_id = s.id
        ${whereClause}
        ORDER BY tr.priority ASC, tr.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await this.pool.query(query, queryParams);

      const targetingRules = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        siteId: row.site_id,
        siteName: row.site_name,
        siteDomain: row.site_domain,
        conditions: row.conditions,
        operator: row.operator,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      }));

      return {
        targetingRules,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting targeting rules", {
        organizationId,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get targeting rules for specific site
   */
  public async getTargetingRulesBySite(siteId: string, organizationId: string, options: { page: number; limit: number; search?: string; status?: string }): Promise<any> {
    try {
      const { page, limit, search, status } = options;
      const offset = (page - 1) * limit;

      let whereConditions = ['tr.site_id = $1', 's.organization_id = $2'];
      let queryParams: any[] = [siteId, organizationId];
      let paramIndex = 3;

      if (search) {
        whereConditions.push(`(tr.name ILIKE $${paramIndex} OR tr.description ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereConditions.push(`tr.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(tr.id) as total
        FROM targeting_rules tr
        JOIN sites s ON tr.site_id = s.id
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get targeting rules
      const query = `
        SELECT 
          tr.id,
          tr.name,
          tr.description,
          tr.site_id,
          tr.conditions,
          tr.operator,
          tr.status,
          tr.priority,
          tr.created_at,
          tr.updated_at,
          tr.created_by,
          tr.updated_by,
          s.name as site_name,
          s.domain as site_domain
        FROM targeting_rules tr
        JOIN sites s ON tr.site_id = s.id
        ${whereClause}
        ORDER BY tr.priority ASC, tr.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await this.pool.query(query, queryParams);

      const targetingRules = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        siteId: row.site_id,
        siteName: row.site_name,
        siteDomain: row.site_domain,
        conditions: row.conditions,
        operator: row.operator,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      }));

      return {
        targetingRules,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Error getting targeting rules by site", {
        siteId,
        organizationId,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get targeting rule by ID
   */
  public async getTargetingRuleById(targetingRuleId: string, organizationId: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          tr.id,
          tr.name,
          tr.description,
          tr.site_id,
          tr.conditions,
          tr.operator,
          tr.status,
          tr.priority,
          tr.created_at,
          tr.updated_at,
          tr.created_by,
          tr.updated_by,
          s.name as site_name,
          s.domain as site_domain
        FROM targeting_rules tr
        JOIN sites s ON tr.site_id = s.id
        WHERE tr.id = $1 AND s.organization_id = $2
      `;

      const result = await this.pool.query(query, [targetingRuleId, organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        siteId: row.site_id,
        siteName: row.site_name,
        siteDomain: row.site_domain,
        conditions: row.conditions,
        operator: row.operator,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      };
    } catch (error) {
      this.logger.error("Error getting targeting rule by ID", {
        targetingRuleId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create targeting rule
   */
  public async createTargetingRule(targetingRuleData: any): Promise<any> {
    try {
      const {
        name,
        description,
        siteId,
        conditions,
        operator,
        status = 'active',
        priority = 50,
        organizationId,
        createdBy,
      } = targetingRuleData;

      const id = require('uuid').v4();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO targeting_rules (
          id, name, description, site_id, conditions, operator, status, priority, 
          created_at, updated_at, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $10)
        RETURNING 
          id, name, description, site_id, conditions, operator, status, priority,
          created_at, updated_at, created_by, updated_by
      `;

      const values = [
        id,
        name,
        description,
        siteId,
        JSON.stringify(conditions),
        operator,
        status,
        priority,
        now,
        createdBy,
      ];

      const result = await this.pool.query(query, values);
      const targetingRule = result.rows[0];

      // Get site information
      const siteQuery = `SELECT name, domain FROM sites WHERE id = $1`;
      const siteResult = await this.pool.query(siteQuery, [siteId]);
      const site = siteResult.rows[0];

      return {
        id: targetingRule.id,
        name: targetingRule.name,
        description: targetingRule.description,
        siteId: targetingRule.site_id,
        siteName: site?.name,
        siteDomain: site?.domain,
        conditions: JSON.parse(targetingRule.conditions),
        operator: targetingRule.operator,
        status: targetingRule.status,
        priority: targetingRule.priority,
        createdAt: targetingRule.created_at,
        updatedAt: targetingRule.updated_at,
        createdBy: targetingRule.created_by,
        updatedBy: targetingRule.updated_by,
      };
    } catch (error) {
      this.logger.error("Error creating targeting rule", {
        targetingRuleData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update targeting rule
   */
  public async updateTargetingRule(targetingRuleId: string, organizationId: string, updateData: any): Promise<any | null> {
    try {
      // Verify targeting rule belongs to organization
      const existingRule = await this.getTargetingRuleById(targetingRuleId, organizationId);
      if (!existingRule) {
        return null;
      }

      const {
        name,
        description,
        conditions,
        operator,
        status,
        priority,
        updatedBy,
      } = updateData;

      const now = new Date().toISOString();
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(name);
        paramIndex++;
      }

      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }

      if (conditions !== undefined) {
        updates.push(`conditions = $${paramIndex}`);
        values.push(JSON.stringify(conditions));
        paramIndex++;
      }

      if (operator !== undefined) {
        updates.push(`operator = $${paramIndex}`);
        values.push(operator);
        paramIndex++;
      }

      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (priority !== undefined) {
        updates.push(`priority = $${paramIndex}`);
        values.push(priority);
        paramIndex++;
      }

      if (updates.length === 0) {
        return existingRule;
      }

      updates.push(`updated_at = $${paramIndex}`);
      values.push(now);
      paramIndex++;

      if (updatedBy) {
        updates.push(`updated_by = $${paramIndex}`);
        values.push(updatedBy);
        paramIndex++;
      }

      values.push(targetingRuleId);

      const query = `
        UPDATE targeting_rules 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING 
          id, name, description, site_id, conditions, operator, status, priority,
          created_at, updated_at, created_by, updated_by
      `;

      const result = await this.pool.query(query, values);
      const targetingRule = result.rows[0];

      // Get site information
      const siteQuery = `SELECT name, domain FROM sites WHERE id = $1`;
      const siteResult = await this.pool.query(siteQuery, [targetingRule.site_id]);
      const site = siteResult.rows[0];

      return {
        id: targetingRule.id,
        name: targetingRule.name,
        description: targetingRule.description,
        siteId: targetingRule.site_id,
        siteName: site?.name,
        siteDomain: site?.domain,
        conditions: JSON.parse(targetingRule.conditions),
        operator: targetingRule.operator,
        status: targetingRule.status,
        priority: targetingRule.priority,
        createdAt: targetingRule.created_at,
        updatedAt: targetingRule.updated_at,
        createdBy: targetingRule.created_by,
        updatedBy: targetingRule.updated_by,
      };
    } catch (error) {
      this.logger.error("Error updating targeting rule", {
        targetingRuleId,
        organizationId,
        updateData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete targeting rule
   */
  public async deleteTargetingRule(targetingRuleId: string, organizationId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM targeting_rules 
        WHERE id = $1 AND EXISTS (
          SELECT 1 FROM sites s WHERE s.id = targeting_rules.site_id AND s.organization_id = $2
        )
      `;

      const result = await this.pool.query(query, [targetingRuleId, organizationId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.logger.error("Error deleting targeting rule", {
        targetingRuleId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Test targeting rule against sample data
   */
  public async testTargetingRule(targetingRuleId: string, organizationId: string, testData: Record<string, any>): Promise<boolean | null> {
    try {
      const targetingRule = await this.getTargetingRuleById(targetingRuleId, organizationId);
      if (!targetingRule) {
        return null;
      }

      const { conditions, operator } = targetingRule;

      // Evaluate each condition
      const conditionResults = conditions.map((condition: any) => {
        const { attribute, operator: conditionOperator, value } = condition;
        const testValue = testData[attribute];

        switch (conditionOperator) {
          case 'equals':
            return testValue === value;
          case 'not_equals':
            return testValue !== value;
          case 'contains':
            return typeof testValue === 'string' && testValue.includes(value);
          case 'not_contains':
            return typeof testValue === 'string' && !testValue.includes(value);
          case 'greater_than':
            return Number(testValue) > Number(value);
          case 'less_than':
            return Number(testValue) < Number(value);
          case 'in':
            return Array.isArray(value) && value.includes(testValue);
          case 'not_in':
            return Array.isArray(value) && !value.includes(testValue);
          default:
            return false;
        }
      });

      // Apply operator (AND/OR)
      if (operator === 'AND') {
        return conditionResults.every((result: boolean) => result);
      } else {
        return conditionResults.some((result: boolean) => result);
      }
    } catch (error) {
      this.logger.error("Error testing targeting rule", {
        targetingRuleId,
        organizationId,
        testData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clean up database connections
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
