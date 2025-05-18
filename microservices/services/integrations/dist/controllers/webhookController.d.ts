import { Request, Response } from "express";
/**
 * Controller for handling webhooks from various integrations
 */
export declare class WebhookController {
  /**
   * Handle Shopify webhook requests
   * Method should be used with Express route for Shopify webhooks
   */
  static handleShopifyWebhook(req: Request, res: Response): Promise<void>;
  /**
   * Middleware to save raw body for HMAC verification
   * Use this middleware on routes that need HMAC validation
   */
  static rawBodySaver(req: Request, res: Response, buf: Buffer, encoding: string): void;
}
