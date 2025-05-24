import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";

export function createServer() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());

  // Need raw body for HMAC verification
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
        req.rawBody = buf;
      },
    })
  );

  // Simple request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "healthy", service: "integrations-service" });
  });

  // Shopify order webhook handler
  app.post(
    "/webhooks/shopify/orders/create",
    async (req: Request & { rawBody?: Buffer }, res: Response) => {
      try {
        console.log("Received webhook request");
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);

        // For now, just return success without processing
        // This will allow us to test the webhook endpoint
        res.status(200).json({
          success: true,
          message: "Webhook received successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Error handling
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

export default createServer;
