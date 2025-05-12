import Handlebars from 'handlebars';
import { NotificationTemplate } from '../types/events';
import { Logger } from './logger';

// Define a type for the HandlebarsTemplateDelegate if @types/handlebars is not available
type HandlebarsTemplateDelegate = (context: any, options?: any) => string;

export class TemplateRenderer {
  private compiledTemplateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private readonly logger: Logger) {
    // Register custom helpers
    this.registerHelpers();
  }

  /**
   * Render a notification template with event data
   */
  public async render(
    template: NotificationTemplate,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      // Prepare the template HTML
      const compiledTemplate = this.getCompiledTemplate(template.id, template.html);
      
      // Render HTML content with data
      const renderedHtml = compiledTemplate(data);
      
      // Extract dynamic values from the template
      const dynamicValues = this.extractDynamicValues(template, data);
      
      // Combine all rendered content
      return {
        html: renderedHtml,
        css: template.css,
        dynamicValues,
        originalTemplateId: template.id,
        templateName: template.name
      };
    } catch (error) {
      this.logger.error('Error rendering template', { 
        templateId: template.id, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return a fallback content
      return {
        html: `<div class="notification-fallback">New notification</div>`,
        css: template.css,
        dynamicValues: {},
        originalTemplateId: template.id,
        templateName: template.name,
        renderError: true
      };
    }
  }

  /**
   * Get or create a compiled template
   */
  private getCompiledTemplate(templateId: string, html: string): HandlebarsTemplateDelegate {
    if (!this.compiledTemplateCache.has(templateId)) {
      try {
        const compiled = Handlebars.compile(html);
        this.compiledTemplateCache.set(templateId, compiled);
      } catch (error) {
        this.logger.error('Error compiling template', { 
          templateId, 
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
    
    return this.compiledTemplateCache.get(templateId)!;
  }

  /**
   * Extract dynamic values from data using template variables
   */
  private extractDynamicValues(
    template: NotificationTemplate,
    data: Record<string, any>
  ): Record<string, any> {
    const dynamicValues: Record<string, any> = {};
    
    // If template has defined content variables, extract them
    if (template.content && template.content.variables) {
      const variables = template.content.variables as Record<string, { path: string; default?: any }>;
      
      for (const [key, config] of Object.entries(variables)) {
        try {
          // Get the value using the path
          let value = data;
          const path = config.path.split('.');
          
          for (const segment of path) {
            if (value === undefined || value === null) {
              value = config.default;
              break;
            }
            value = value[segment];
          }
          
          // Use default if value is undefined
          if (value === undefined) {
            value = config.default;
          }
          
          dynamicValues[key] = value;
        } catch (error) {
          this.logger.warn('Error extracting dynamic value', { 
            variable: key, 
            path: config.path, 
            error: error instanceof Error ? error.message : String(error)
          });
          dynamicValues[key] = config.default;
        }
      }
    }
    
    return dynamicValues;
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Format currency
    Handlebars.registerHelper('formatCurrency', function(value: string | number, currency: string) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        return '';
      }
      
      try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency || 'USD'
        }).format(numValue);
      } catch (error) {
        return value;
      }
    });
    
    // Format date
    Handlebars.registerHelper('formatDate', function(value: string, format: string) {
      if (!value) {
        return '';
      }
      
      try {
        const date = new Date(value);
        
        if (format === 'relative') {
          // Simple relative time formatting
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffSecs = Math.floor(diffMs / 1000);
          const diffMins = Math.floor(diffSecs / 60);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          
          if (diffDays > 0) {
            return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
          }
          if (diffHours > 0) {
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
          }
          if (diffMins > 0) {
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
          }
          return 'just now';
        }
        
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (error) {
        return value;
      }
    });
    
    // Truncate text
    Handlebars.registerHelper('truncate', function(text: string, length: string | number) {
      if (!text) {
        return '';
      }
      
      const maxLength = parseInt(String(length), 10) || 50;
      
      if (text.length <= maxLength) {
        return text;
      }
      
      return text.substring(0, maxLength) + '...';
    });
    
    // Conditional
    type HelperOptions = {
      fn: (context: any) => string;
      inverse: (context: any) => string;
    };
    
    Handlebars.registerHelper('ifCond', function(
      this: any,
      v1: any, 
      operator: string, 
      v2: any, 
      options: HelperOptions
    ) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }
} 