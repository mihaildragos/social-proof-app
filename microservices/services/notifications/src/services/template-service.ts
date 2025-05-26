import { Logger } from "../utils/logger";
import { NotificationTemplate } from "../types/events";
import Handlebars from "handlebars";
import DOMPurify from "isomorphic-dompurify";
import { createHash } from "crypto";

export interface TemplateRenderingConfig {
  logger: Logger;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  enableSanitization?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

export interface RenderContext {
  eventData: Record<string, any>;
  siteData?: Record<string, any>;
  userContext?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RenderedTemplate {
  html: string;
  css: string;
  text?: string;
  subject?: string;
  metadata?: Record<string, any>;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Template rendering service with caching, security, and multi-engine support
 */
export class TemplateRenderingService {
  private logger: Logger;
  private enableCaching: boolean;
  private cacheSize: number;
  private cacheTTL: number;
  private enableSanitization: boolean;
  private allowedTags: string[];
  private allowedAttributes: Record<string, string[]>;
  
  // Template cache
  private templateCache: Map<string, { template: any; compiledAt: number; accessCount: number }>;
  private renderCache: Map<string, { result: RenderedTemplate; cachedAt: number }>;

  constructor(config: TemplateRenderingConfig) {
    this.logger = config.logger;
    this.enableCaching = config.enableCaching ?? true;
    this.cacheSize = config.cacheSize ?? 1000;
    this.cacheTTL = config.cacheTTL ?? 3600000; // 1 hour
    this.enableSanitization = config.enableSanitization ?? true;
    this.allowedTags = config.allowedTags ?? [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', 'br', 'img', 'a', 'ul', 'ol', 'li'
    ];
    this.allowedAttributes = config.allowedAttributes ?? {
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'width', 'height'],
      'div': ['class', 'id', 'style'],
      'span': ['class', 'id', 'style'],
      'p': ['class', 'id', 'style'],
    };

    this.templateCache = new Map();
    this.renderCache = new Map();

    // Register Handlebars helpers
    this.registerHandlebarsHelpers();

    this.logger.info("Template rendering service initialized", {
      caching: this.enableCaching,
      sanitization: this.enableSanitization,
      cacheSize: this.cacheSize,
    });
  }

  /**
   * Render a notification template with the provided context
   */
  public async renderTemplate(
    template: NotificationTemplate,
    context: RenderContext
  ): Promise<RenderedTemplate> {
    const startTime = Date.now();
    
    try {
      this.logger.debug("Rendering template", {
        templateId: template.id,
        templateName: template.name,
      });

      // Generate cache key for rendered result
      const renderCacheKey = this.generateRenderCacheKey(template, context);
      
      // Check render cache first
      if (this.enableCaching) {
        const cachedResult = this.getRenderFromCache(renderCacheKey);
        if (cachedResult) {
          this.logger.debug("Template render cache hit", {
            templateId: template.id,
            cacheKey: renderCacheKey,
          });
          return cachedResult;
        }
      }

      // Compile template if not cached
      const compiledTemplate = await this.compileTemplate(template);

      // Prepare rendering context
      const renderingContext = this.prepareRenderingContext(context);

      // Render HTML content
      const htmlContent = await this.renderHtml(compiledTemplate.html, renderingContext);
      
      // Render CSS
      const cssContent = await this.renderCss(template.css, renderingContext);
      
      // Render text version (if available)
      const textContent = await this.renderText(template, renderingContext);
      
      // Render subject (for email notifications)
      const subjectContent = await this.renderSubject(template, renderingContext);

      // Create rendered result
      let renderedResult: RenderedTemplate = {
        html: htmlContent,
        css: cssContent,
        text: textContent,
        subject: subjectContent,
        metadata: {
          templateId: template.id,
          renderedAt: new Date().toISOString(),
          renderTime: Date.now() - startTime,
        },
      };

      // Sanitize content if enabled
      if (this.enableSanitization) {
        renderedResult = this.sanitizeRenderedContent(renderedResult);
      }

      // Cache the result
      if (this.enableCaching) {
        this.cacheRenderResult(renderCacheKey, renderedResult);
      }

      this.logger.info("Template rendered successfully", {
        templateId: template.id,
        renderTime: Date.now() - startTime,
        htmlLength: renderedResult.html.length,
        cssLength: renderedResult.css.length,
      });

      return renderedResult;
    } catch (error) {
      this.logger.error("Error rendering template", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate template syntax and structure
   */
  public async validateTemplate(template: NotificationTemplate): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Validate HTML template
      if (template.html) {
        try {
          Handlebars.compile(template.html);
        } catch (error) {
          result.isValid = false;
          result.errors.push(`HTML template compilation error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Validate CSS template
      if (template.css) {
        try {
          Handlebars.compile(template.css);
        } catch (error) {
          result.isValid = false;
          result.errors.push(`CSS template compilation error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Check for required placeholders
      const requiredPlaceholders = ['{{customer.name}}', '{{product.name}}'];
      const htmlContent = template.html || '';
      
      for (const placeholder of requiredPlaceholders) {
        if (!htmlContent.includes(placeholder.replace(/[{}]/g, ''))) {
          result.warnings.push(`Missing recommended placeholder: ${placeholder}`);
        }
      }

      // Check for security issues
      const securityIssues = this.checkSecurityIssues(template);
      result.warnings.push(...securityIssues);

      this.logger.debug("Template validation completed", {
        templateId: template.id,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Compile template and cache if enabled
   */
  private async compileTemplate(template: NotificationTemplate): Promise<{ html: any; css: any }> {
    const cacheKey = `template:${template.id}`;
    
    // Check template cache
    if (this.enableCaching) {
      const cached = this.templateCache.get(cacheKey);
      if (cached && (Date.now() - cached.compiledAt) < this.cacheTTL) {
        cached.accessCount++;
        this.logger.debug("Template compilation cache hit", {
          templateId: template.id,
          accessCount: cached.accessCount,
        });
        return cached.template;
      }
    }

    // Compile templates
    const compiledHtml = Handlebars.compile(template.html || '');
    const compiledCss = Handlebars.compile(template.css || '');

    const compiledTemplate = {
      html: compiledHtml,
      css: compiledCss,
    };

    // Cache compiled template
    if (this.enableCaching) {
      this.templateCache.set(cacheKey, {
        template: compiledTemplate,
        compiledAt: Date.now(),
        accessCount: 1,
      });

      // Clean cache if it exceeds size limit
      this.cleanTemplateCache();
    }

    return compiledTemplate;
  }

  /**
   * Prepare rendering context with helper functions and data
   */
  private prepareRenderingContext(context: RenderContext): Record<string, any> {
    return {
      ...context.eventData,
      site: context.siteData || {},
      user: context.userContext || {},
      meta: context.metadata || {},
      helpers: {
        formatCurrency: (amount: number, currency: string = 'USD') => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
          }).format(amount);
        },
        formatDate: (date: string | Date, format: string = 'short') => {
          const dateObj = typeof date === 'string' ? new Date(date) : date;
          return dateObj.toLocaleDateString('en-US', {
            dateStyle: format as any,
          });
        },
        truncate: (text: string, length: number = 100) => {
          return text.length > length ? text.substring(0, length) + '...' : text;
        },
        capitalize: (text: string) => {
          return text.charAt(0).toUpperCase() + text.slice(1);
        },
      },
    };
  }

  /**
   * Render HTML content
   */
  private async renderHtml(compiledTemplate: any, context: Record<string, any>): Promise<string> {
    try {
      return compiledTemplate(context);
    } catch (error) {
      this.logger.error("Error rendering HTML", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`HTML rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Render CSS content
   */
  private async renderCss(cssTemplate: string, context: Record<string, any>): Promise<string> {
    try {
      if (!cssTemplate) return '';
      const compiledCss = Handlebars.compile(cssTemplate);
      return compiledCss(context);
    } catch (error) {
      this.logger.error("Error rendering CSS", {
        error: error instanceof Error ? error.message : String(error),
      });
      return cssTemplate; // Return original CSS if compilation fails
    }
  }

  /**
   * Render text version of the template
   */
  private async renderText(template: NotificationTemplate, context: Record<string, any>): Promise<string | undefined> {
    try {
      // Extract text from HTML if no text template is provided
      if (!template.content?.text && template.html) {
        // Simple HTML to text conversion
        const textContent = template.html
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        const compiledText = Handlebars.compile(textContent);
        return compiledText(context);
      }

      if (template.content?.text) {
        const compiledText = Handlebars.compile(template.content.text);
        return compiledText(context);
      }

      return undefined;
    } catch (error) {
      this.logger.error("Error rendering text content", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Render subject line for email notifications
   */
  private async renderSubject(template: NotificationTemplate, context: Record<string, any>): Promise<string | undefined> {
    try {
      if (template.content?.subject) {
        const compiledSubject = Handlebars.compile(template.content.subject);
        return compiledSubject(context);
      }

      // Generate default subject based on event type
      if (context.eventType) {
        const defaultSubject = this.generateDefaultSubject(context.eventType, context);
        return defaultSubject;
      }

      return undefined;
    } catch (error) {
      this.logger.error("Error rendering subject", {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Sanitize rendered content for security
   */
  private sanitizeRenderedContent(content: RenderedTemplate): RenderedTemplate {
    try {
      const sanitizedHtml = DOMPurify.sanitize(content.html, {
        ALLOWED_TAGS: this.allowedTags,
        ALLOWED_ATTR: Object.values(this.allowedAttributes).flat(),
      });

      return {
        ...content,
        html: sanitizedHtml,
      };
    } catch (error) {
      this.logger.error("Error sanitizing content", {
        error: error instanceof Error ? error.message : String(error),
      });
      return content; // Return original content if sanitization fails
    }
  }

  /**
   * Check for security issues in template
   */
  private checkSecurityIssues(template: NotificationTemplate): string[] {
    const issues: string[] = [];
    const htmlContent = template.html || '';
    const cssContent = template.css || '';

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
      /<script/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(htmlContent) || pattern.test(cssContent)) {
        issues.push(`Potentially dangerous pattern detected: ${pattern.source}`);
      }
    }

    return issues;
  }

  /**
   * Generate cache key for rendered result
   */
  private generateRenderCacheKey(template: NotificationTemplate, context: RenderContext): string {
    const contextHash = createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');
    
    return `render:${template.id}:${contextHash}`;
  }

  /**
   * Get rendered result from cache
   */
  private getRenderFromCache(cacheKey: string): RenderedTemplate | null {
    const cached = this.renderCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < this.cacheTTL) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache rendered result
   */
  private cacheRenderResult(cacheKey: string, result: RenderedTemplate): void {
    this.renderCache.set(cacheKey, {
      result,
      cachedAt: Date.now(),
    });

    // Clean render cache if it exceeds size limit
    this.cleanRenderCache();
  }

  /**
   * Clean template cache when it exceeds size limit
   */
  private cleanTemplateCache(): void {
    if (this.templateCache.size > this.cacheSize) {
      // Remove least recently used entries
      const entries = Array.from(this.templateCache.entries())
        .sort((a, b) => a[1].accessCount - b[1].accessCount)
        .slice(0, Math.floor(this.cacheSize * 0.2)); // Remove 20% of entries

      for (const [key] of entries) {
        this.templateCache.delete(key);
      }

      this.logger.debug("Template cache cleaned", {
        removedEntries: entries.length,
        currentSize: this.templateCache.size,
      });
    }
  }

  /**
   * Clean render cache when it exceeds size limit
   */
  private cleanRenderCache(): void {
    if (this.renderCache.size > this.cacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.renderCache.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
        .slice(0, Math.floor(this.cacheSize * 0.2)); // Remove 20% of entries

      for (const [key] of entries) {
        this.renderCache.delete(key);
      }

      this.logger.debug("Render cache cleaned", {
        removedEntries: entries.length,
        currentSize: this.renderCache.size,
      });
    }
  }

  /**
   * Generate default subject based on event type
   */
  private generateDefaultSubject(eventType: string, context: Record<string, any>): string {
    const subjectTemplates: Record<string, string> = {
      'order.created': 'New order from {{customer.name || "a customer"}}',
      'order.paid': 'Payment received for order {{order.number}}',
      'order.fulfilled': 'Order {{order.number}} has been shipped',
      'product.purchased': '{{customer.name || "Someone"}} just bought {{product.name}}',
      'user.signup': 'New user registration: {{user.name || user.email}}',
      'cart.abandoned': '{{customer.name || "A customer"}} left items in their cart',
    };

    const template = subjectTemplates[eventType] || 'New notification';
    const compiledSubject = Handlebars.compile(template);
    return compiledSubject(context);
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    // Currency formatting helper
    Handlebars.registerHelper('currency', function(amount: number, currency: string = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    });

    // Date formatting helper
    Handlebars.registerHelper('date', function(date: string | Date, format: string = 'short') {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        dateStyle: format as any,
      });
    });

    // Text truncation helper
    Handlebars.registerHelper('truncate', function(text: string, length: number = 100) {
      return text && text.length > length ? text.substring(0, length) + '...' : text;
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', function(text: string) {
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Math helpers
    Handlebars.registerHelper('add', function(a: number, b: number) {
      return a + b;
    });

    Handlebars.registerHelper('multiply', function(a: number, b: number) {
      return a * b;
    });

    this.logger.debug("Handlebars helpers registered");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): Record<string, any> {
    return {
      templateCache: {
        size: this.templateCache.size,
        maxSize: this.cacheSize,
        hitRate: this.calculateCacheHitRate(),
      },
      renderCache: {
        size: this.renderCache.size,
        maxSize: this.cacheSize,
      },
      config: {
        cachingEnabled: this.enableCaching,
        sanitizationEnabled: this.enableSanitization,
        cacheTTL: this.cacheTTL,
      },
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalAccess = Array.from(this.templateCache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    return totalAccess > 0 ? (totalAccess - this.templateCache.size) / totalAccess : 0;
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.templateCache.clear();
    this.renderCache.clear();
    this.logger.info("All template caches cleared");
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.clearCaches();
    this.logger.info("Template rendering service cleanup completed");
  }
} 