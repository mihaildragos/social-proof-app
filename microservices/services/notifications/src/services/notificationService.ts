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
   * Clean up database connections
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
