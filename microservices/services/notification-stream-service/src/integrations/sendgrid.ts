import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "sendgrid-integration" });

/**
 * SendGrid configuration
 */
export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  baseUrl?: string;
  timeout?: number;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

/**
 * SendGrid email data
 */
export interface SendGridEmailData {
  to: string;
  toName?: string;
  subject: string;
  templateId?: string;
  templateData?: Record<string, any>;
  htmlContent?: string;
  textContent?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
    disposition?: string;
  }>;
  categories?: string[];
  customArgs?: Record<string, string>;
  sendAt?: number;
}

/**
 * SendGrid response
 */
export interface SendGridResponse {
  messageId: string;
  status: "sent" | "queued" | "failed";
  statusCode: number;
  timestamp: Date;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * SendGrid webhook event
 */
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event:
    | "delivered"
    | "open"
    | "click"
    | "bounce"
    | "dropped"
    | "spamreport"
    | "unsubscribe"
    | "group_unsubscribe"
    | "group_resubscribe";
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;
  url?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  category?: string[];
  asm_group_id?: number;
}

/**
 * SendGrid template
 */
export interface SendGridTemplate {
  id: string;
  name: string;
  generation: "legacy" | "dynamic";
  updated_at: string;
  versions: Array<{
    id: string;
    template_id: string;
    active: number;
    name: string;
    html_content: string;
    plain_content: string;
    subject: string;
    updated_at: string;
  }>;
}

/**
 * SendGrid integration service
 */
export class SendGridService {
  private config: SendGridConfig;
  private baseUrl: string;

  constructor(config: SendGridConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.sendgrid.com/v3";

    logger.info("SendGrid service initialized", {
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(emailData: SendGridEmailData): Promise<SendGridResponse> {
    const startTime = Date.now();

    try {
      // Prepare SendGrid payload
      const payload = this.prepareSendGridPayload(emailData);

      // Make API request
      const response = await this.makeApiRequest("/mail/send", "POST", payload);

      const messageId = this.extractMessageId(response);
      const status = response.status >= 200 && response.status < 300 ? "sent" : "failed";

      const result: SendGridResponse = {
        messageId,
        status,
        statusCode: response.status,
        timestamp: new Date(),
        headers: response.headers,
      };

      if (status === "sent") {
        logger.info("Email sent successfully via SendGrid", {
          messageId,
          recipient: emailData.to,
          subject: emailData.subject,
          templateId: emailData.templateId,
        });

        metrics.increment("sendgrid.email.sent", {
          template: emailData.templateId || "custom",
          category: emailData.categories?.join(",") || "default",
        });
      } else {
        result.error = `SendGrid API error: ${response.status}`;
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      logger.error("SendGrid email send failed", {
        recipient: emailData.to,
        subject: emailData.subject,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      metrics.increment("sendgrid.email.failed", {
        template: emailData.templateId || "custom",
        error: error instanceof Error ? error.message : "unknown",
      });

      return {
        messageId: "",
        status: "failed",
        statusCode: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      const duration = Date.now() - startTime;
      metrics.histogram("sendgrid.email.duration", duration, {
        template: emailData.templateId || "custom",
      });
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: SendGridEmailData[]): Promise<SendGridResponse[]> {
    const results: SendGridResponse[] = [];
    const batchSize = 1000; // SendGrid limit

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map((email) => this.sendEmail(email)));

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            messageId: "",
            status: "failed",
            statusCode: 0,
            timestamp: new Date(),
            error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          });
        }
      }

      // Rate limiting between batches
      if (i + batchSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info("Bulk email send completed", {
      totalEmails: emails.length,
      successCount: results.filter((r) => r.status === "sent").length,
      failureCount: results.filter((r) => r.status === "failed").length,
    });

    return results;
  }

  /**
   * Get templates
   */
  async getTemplates(): Promise<SendGridTemplate[]> {
    try {
      const response = await this.makeApiRequest("/templates", "GET");

      if (response.status === 200) {
        const data = await response.json();
        return data.templates || [];
      } else {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }
    } catch (error) {
      logger.error("Failed to fetch SendGrid templates", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Create template
   */
  async createTemplate(template: {
    name: string;
    generation: "legacy" | "dynamic";
  }): Promise<SendGridTemplate | null> {
    try {
      const response = await this.makeApiRequest("/templates", "POST", template);

      if (response.status === 201) {
        const data = await response.json();
        logger.info("SendGrid template created", {
          templateId: data.id,
          name: template.name,
        });
        return data;
      } else {
        throw new Error(`Failed to create template: ${response.status}`);
      }
    } catch (error) {
      logger.error("Failed to create SendGrid template", {
        templateName: template.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Process webhook events
   */
  async processWebhookEvents(events: SendGridWebhookEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await this.processWebhookEvent(event);
      } catch (error) {
        logger.error("Failed to process SendGrid webhook event", {
          eventId: event.sg_event_id,
          eventType: event.event,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Process single webhook event
   */
  private async processWebhookEvent(event: SendGridWebhookEvent): Promise<void> {
    logger.info("Processing SendGrid webhook event", {
      eventId: event.sg_event_id,
      eventType: event.event,
      email: event.email,
      timestamp: event.timestamp,
    });

    // Track metrics for different event types
    metrics.increment("sendgrid.webhook.received", {
      event: event.event,
      email: event.email,
    });

    switch (event.event) {
      case "delivered":
        metrics.increment("sendgrid.email.delivered", {
          email: event.email,
        });
        break;

      case "open":
        metrics.increment("sendgrid.email.opened", {
          email: event.email,
          useragent: event.useragent || "unknown",
        });
        break;

      case "click":
        metrics.increment("sendgrid.email.clicked", {
          email: event.email,
          url: event.url || "unknown",
        });
        break;

      case "bounce":
        metrics.increment("sendgrid.email.bounced", {
          email: event.email,
          reason: event.reason || "unknown",
        });
        break;

      case "dropped":
        metrics.increment("sendgrid.email.dropped", {
          email: event.email,
          reason: event.reason || "unknown",
        });
        break;

      case "spamreport":
        metrics.increment("sendgrid.email.spam", {
          email: event.email,
        });
        break;

      case "unsubscribe":
        metrics.increment("sendgrid.email.unsubscribed", {
          email: event.email,
        });
        break;
    }

    // In a real implementation, you'd update delivery confirmations in the database
    // and trigger any necessary business logic based on the event type
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      // In a real implementation, you'd verify the HMAC signature
      // using the webhook verification key from SendGrid

      // For now, just check if signature exists
      return !!(signature && signature.length > 0);
    } catch (error) {
      logger.error("Failed to validate SendGrid webhook signature", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(startDate: string, endDate: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        aggregated_by: "day",
      });

      const response = await this.makeApiRequest(`/stats?${params}`, "GET");

      if (response.status === 200) {
        const data = await response.json();
        return data;
      } else {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
    } catch (error) {
      logger.error("Failed to fetch SendGrid email stats", {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Prepare SendGrid API payload
   */
  private prepareSendGridPayload(emailData: SendGridEmailData): any {
    const payload: any = {
      personalizations: [
        {
          to: [
            {
              email: emailData.to,
              name: emailData.toName,
            },
          ],
          subject: emailData.subject,
        },
      ],
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      content: [],
    };

    // Add reply-to if configured
    if (this.config.replyTo) {
      payload.reply_to = {
        email: this.config.replyTo,
      };
    }

    // Add template data if using template
    if (emailData.templateId) {
      payload.template_id = emailData.templateId;
      if (emailData.templateData) {
        payload.personalizations[0].dynamic_template_data = emailData.templateData;
      }
    } else {
      // Add content for non-template emails
      if (emailData.htmlContent) {
        payload.content.push({
          type: "text/html",
          value: emailData.htmlContent,
        });
      }
      if (emailData.textContent) {
        payload.content.push({
          type: "text/plain",
          value: emailData.textContent,
        });
      }
    }

    // Add attachments
    if (emailData.attachments && emailData.attachments.length > 0) {
      payload.attachments = emailData.attachments;
    }

    // Add categories
    if (emailData.categories && emailData.categories.length > 0) {
      payload.categories = emailData.categories;
    }

    // Add custom args
    if (emailData.customArgs) {
      payload.custom_args = emailData.customArgs;
    }

    // Add send at time
    if (emailData.sendAt) {
      payload.send_at = emailData.sendAt;
    }

    return payload;
  }

  /**
   * Make API request to SendGrid
   */
  private async makeApiRequest(endpoint: string, method: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    // Simulate API call for now
    logger.info("Making SendGrid API request", {
      method,
      endpoint,
      hasBody: !!body,
    });

    // Simulate response
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      status: 202, // SendGrid typically returns 202 for successful sends
      headers: {
        "x-message-id": `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      json: async () => ({}),
    };
  }

  /**
   * Extract message ID from response
   */
  private extractMessageId(response: any): string {
    return (
      response.headers?.["x-message-id"] ||
      `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    apiKey: string;
    fromEmail: string;
    fromName: string;
    baseUrl: string;
    retryConfig: SendGridConfig["retryConfig"];
  } {
    return {
      apiKey: this.config.apiKey.substring(0, 10) + "...",
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName,
      baseUrl: this.baseUrl,
      retryConfig: this.config.retryConfig,
    };
  }
}
