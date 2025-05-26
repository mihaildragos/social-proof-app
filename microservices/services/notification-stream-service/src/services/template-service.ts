import { EventEmitter } from "events";
import { getContextLogger } from "../utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "template-service" });

// Template types and interfaces
export enum TemplateType {
  POPUP = "popup",
  EMAIL = "email",
  PUSH = "push",
  SMS = "sms",
  WEBHOOK = "webhook",
}

export enum TemplateStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "url" | "email";
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface TemplateContent {
  subject?: string; // For email/push
  title?: string; // For popup/push
  body: string;
  html?: string; // For email
  style?: Record<string, any>; // For popup styling
  actions?: Array<{
    label: string;
    url: string;
    style?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: TemplateType;
  status: TemplateStatus;
  content: TemplateContent;
  variables: TemplateVariable[];
  version: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  usageCount: number;
  abTestConfig?: {
    enabled: boolean;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      content: TemplateContent;
    }>;
  };
}

export interface TemplateRenderContext {
  variables: Record<string, any>;
  user?: {
    id: string;
    email?: string;
    name?: string;
    properties?: Record<string, any>;
  };
  organization?: {
    id: string;
    name: string;
    domain?: string;
  };
  site?: {
    id: string;
    url: string;
    name?: string;
  };
  event?: {
    type: string;
    data: Record<string, any>;
    timestamp: Date;
  };
}

export interface RenderedTemplate {
  subject?: string;
  title?: string;
  body: string;
  html?: string;
  style?: Record<string, any>;
  actions?: Array<{
    label: string;
    url: string;
    style?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
  variant?: string;
}

export interface TemplateValidationError {
  field: string;
  message: string;
  code: string;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: string[];
}

export interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  templatesByType: Record<TemplateType, number>;
  templatesByStatus: Record<TemplateStatus, number>;
  mostUsedTemplates: Array<{
    id: string;
    name: string;
    usageCount: number;
  }>;
  recentlyCreated: Array<{
    id: string;
    name: string;
    createdAt: Date;
  }>;
}

// Template storage interface
export interface TemplateStore {
  save(template: NotificationTemplate): Promise<void>;
  findById(id: string): Promise<NotificationTemplate | null>;
  findByOrganization(
    organizationId: string,
    filters?: {
      type?: TemplateType;
      status?: TemplateStatus;
      tags?: string[];
      search?: string;
    }
  ): Promise<NotificationTemplate[]>;
  update(id: string, updates: Partial<NotificationTemplate>): Promise<void>;
  delete(id: string): Promise<void>;
  incrementUsage(id: string): Promise<void>;
}

// In-memory template store implementation
export class MemoryTemplateStore implements TemplateStore {
  private templates = new Map<string, NotificationTemplate>();

  async save(template: NotificationTemplate): Promise<void> {
    this.templates.set(template.id, { ...template });
  }

  async findById(id: string): Promise<NotificationTemplate | null> {
    const template = this.templates.get(id);
    return template ? { ...template } : null;
  }

  async findByOrganization(
    organizationId: string,
    filters?: {
      type?: TemplateType;
      status?: TemplateStatus;
      tags?: string[];
      search?: string;
    }
  ): Promise<NotificationTemplate[]> {
    const templates = Array.from(this.templates.values()).filter(
      (t) => t.organizationId === organizationId
    );

    if (!filters) return templates;

    return templates.filter((template) => {
      if (filters.type && template.type !== filters.type) return false;
      if (filters.status && template.status !== filters.status) return false;
      if (filters.tags && !filters.tags.some((tag) => template.tags.includes(tag))) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          template.name.toLowerCase().includes(search) ||
          template.description?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }

  async update(id: string, updates: Partial<NotificationTemplate>): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      this.templates.set(id, { ...template, ...updates, updatedAt: new Date() });
    }
  }

  async delete(id: string): Promise<void> {
    this.templates.delete(id);
  }

  async incrementUsage(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      this.templates.set(id, template);
    }
  }
}

// Template service implementation
export class NotificationTemplateService extends EventEmitter {
  private store: TemplateStore;

  constructor(store?: TemplateStore) {
    super();
    this.store = store || new MemoryTemplateStore();
  }

  // Create a new template
  async createTemplate(
    organizationId: string,
    templateData: Omit<
      NotificationTemplate,
      "id" | "createdAt" | "updatedAt" | "version" | "usageCount"
    >
  ): Promise<NotificationTemplate> {
    const template: NotificationTemplate = {
      id: this.generateTemplateId(),
      ...templateData,
      organizationId,
      version: 1,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate template
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    await this.store.save(template);

    this.emit("templateCreated", { template });
    logger.info("Template created", { templateId: template.id, organizationId });
    metrics.increment("template.created", { type: template.type });

    return template;
  }

  // Update an existing template
  async updateTemplate(
    id: string,
    updates: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    const existing = await this.store.findById(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Validate updated template
    const validation = await this.validateTemplate(updated);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    await this.store.update(id, updates);

    this.emit("templateUpdated", { template: updated, previous: existing });
    logger.info("Template updated", { templateId: id });
    metrics.increment("template.updated", { type: updated.type });

    return updated;
  }

  // Get template by ID
  async getTemplate(id: string): Promise<NotificationTemplate | null> {
    return await this.store.findById(id);
  }

  // Get templates for organization
  async getTemplates(
    organizationId: string,
    filters?: {
      type?: TemplateType;
      status?: TemplateStatus;
      tags?: string[];
      search?: string;
    }
  ): Promise<NotificationTemplate[]> {
    return await this.store.findByOrganization(organizationId, filters);
  }

  // Delete template
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.store.findById(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    await this.store.delete(id);

    this.emit("templateDeleted", { template });
    logger.info("Template deleted", { templateId: id });
    metrics.increment("template.deleted", { type: template.type });
  }

  // Render template with context
  async renderTemplate(
    templateId: string,
    context: TemplateRenderContext
  ): Promise<RenderedTemplate> {
    const template = await this.store.findById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.status !== TemplateStatus.ACTIVE) {
      throw new Error(`Template is not active: ${templateId}`);
    }

    // Increment usage count
    await this.store.incrementUsage(templateId);

    // Select variant for A/B testing
    const content = this.selectTemplateVariant(template, context);

    // Render template content
    const rendered = await this.renderContent(content, context, template.variables);

    this.emit("templateRendered", { templateId, context });
    metrics.increment("template.rendered", { type: template.type });

    return rendered;
  }

  // Validate template
  async validateTemplate(template: NotificationTemplate): Promise<TemplateValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template.name?.trim()) {
      errors.push({
        field: "name",
        message: "Template name is required",
        code: "REQUIRED",
      });
    }

    if (!template.content?.body?.trim()) {
      errors.push({
        field: "content.body",
        message: "Template body is required",
        code: "REQUIRED",
      });
    }

    // Type-specific validation
    if (template.type === TemplateType.EMAIL) {
      if (!template.content.subject?.trim()) {
        errors.push({
          field: "content.subject",
          message: "Email subject is required",
          code: "REQUIRED",
        });
      }
    }

    if (template.type === TemplateType.PUSH) {
      if (!template.content.title?.trim()) {
        errors.push({
          field: "content.title",
          message: "Push notification title is required",
          code: "REQUIRED",
        });
      }
    }

    // Variable validation
    for (const variable of template.variables) {
      if (!variable.name?.trim()) {
        errors.push({
          field: "variables",
          message: "Variable name is required",
          code: "REQUIRED",
        });
      }

      if (variable.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        errors.push({
          field: "variables",
          message: `Invalid variable name: ${variable.name}`,
          code: "INVALID_FORMAT",
        });
      }
    }

    // Template syntax validation
    try {
      await this.validateTemplateSyntax(template.content, template.variables);
    } catch (error) {
      errors.push({
        field: "content",
        message: `Template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: "SYNTAX_ERROR",
      });
    }

    // A/B test validation
    if (template.abTestConfig?.enabled) {
      const totalWeight = template.abTestConfig.variants.reduce((sum, v) => sum + v.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        errors.push({
          field: "abTestConfig",
          message: "A/B test variant weights must sum to 100",
          code: "INVALID_WEIGHTS",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Get template statistics
  async getTemplateStats(organizationId: string): Promise<TemplateStats> {
    const templates = await this.store.findByOrganization(organizationId);

    const stats: TemplateStats = {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((t) => t.status === TemplateStatus.ACTIVE).length,
      templatesByType: {} as Record<TemplateType, number>,
      templatesByStatus: {} as Record<TemplateStatus, number>,
      mostUsedTemplates: templates
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          name: t.name,
          usageCount: t.usageCount,
        })),
      recentlyCreated: templates
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
        })),
    };

    // Count by type
    for (const type of Object.values(TemplateType)) {
      stats.templatesByType[type] = templates.filter((t) => t.type === type).length;
    }

    // Count by status
    for (const status of Object.values(TemplateStatus)) {
      stats.templatesByStatus[status] = templates.filter((t) => t.status === status).length;
    }

    return stats;
  }

  // Private helper methods
  private generateTemplateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private selectTemplateVariant(
    template: NotificationTemplate,
    context: TemplateRenderContext
  ): TemplateContent {
    if (!template.abTestConfig?.enabled || !template.abTestConfig.variants.length) {
      return template.content;
    }

    // Simple random selection based on weights
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of template.abTestConfig.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.content;
      }
    }

    // Fallback to default content
    return template.content;
  }

  private async renderContent(
    content: TemplateContent,
    context: TemplateRenderContext,
    variables: TemplateVariable[]
  ): Promise<RenderedTemplate> {
    // Validate required variables
    for (const variable of variables) {
      if (variable.required && !(variable.name in context.variables)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }
    }

    // Prepare render context with defaults
    const renderContext = { ...context.variables };
    for (const variable of variables) {
      if (!(variable.name in renderContext) && variable.defaultValue !== undefined) {
        renderContext[variable.name] = variable.defaultValue;
      }
    }

    // Add system variables
    if (context.user) {
      renderContext.user = context.user;
    }
    if (context.organization) {
      renderContext.organization = context.organization;
    }
    if (context.site) {
      renderContext.site = context.site;
    }
    if (context.event) {
      renderContext.event = context.event;
    }

    // Render template strings
    const rendered: RenderedTemplate = {
      body: this.renderString(content.body, renderContext),
    };

    if (content.subject) {
      rendered.subject = this.renderString(content.subject, renderContext);
    }

    if (content.title) {
      rendered.title = this.renderString(content.title, renderContext);
    }

    if (content.html) {
      rendered.html = this.renderString(content.html, renderContext);
    }

    if (content.style) {
      rendered.style = this.renderObject(content.style, renderContext);
    }

    if (content.actions) {
      rendered.actions = content.actions.map((action) => ({
        label: this.renderString(action.label, renderContext),
        url: this.renderString(action.url, renderContext),
        style: action.style ? this.renderObject(action.style, renderContext) : undefined,
      }));
    }

    if (content.metadata) {
      rendered.metadata = this.renderObject(content.metadata, renderContext);
    }

    return rendered;
  }

  private renderString(template: string, context: Record<string, any>): string {
    // Simple template rendering with {{variable}} syntax
    return template.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = this.getNestedValue(context, variable.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private renderObject(
    obj: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.renderString(value, context);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.renderObject(value, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private async validateTemplateSyntax(
    content: TemplateContent,
    variables: TemplateVariable[]
  ): Promise<void> {
    const variableNames = new Set(variables.map((v) => v.name));
    const templateStrings = [content.body, content.subject, content.title, content.html].filter(
      Boolean
    );

    for (const templateString of templateStrings) {
      if (!templateString) continue;
      const matches = templateString.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        for (const match of matches) {
          const variable = match.slice(2, -2).trim().split(".")[0];
          if (
            !variableNames.has(variable) &&
            !["user", "organization", "site", "event"].includes(variable)
          ) {
            throw new Error(`Undefined variable: ${variable}`);
          }
        }
      }
    }
  }
}

// Export default instance
export const templateService = new NotificationTemplateService();
