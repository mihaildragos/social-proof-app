import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";
import { KafkaProducer } from "../../shared/kafka/producer";
import { requestLogger } from "../../shared/utils/logger";
import createHealthCheckMiddleware from "../../shared/middleware/health-check";

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

  app.use(requestLogger);

  // Health check
  app.use(
    createHealthCheckMiddleware("integrations-service", {
      kafka: {
        clientId: process.env.KAFKA_CLIENT_ID || "integrations-service",
        brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
      },
    })
  );

  // Shopify order webhook handler
  app.post(
    "/webhooks/shopify/orders/create",
    async (req: Request & { rawBody?: Buffer }, res: Response) => {
      try {
        // Verify the webhook
        const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;
        const shopDomain = req.headers["x-shopify-shop-domain"] as string;

        if (!hmacHeader || !shopDomain) {
          return res.status(401).json({ error: "Missing required headers" });
        }

        const verified = verifyShopifyWebhook(
          req.rawBody || Buffer.from(JSON.stringify(req.body)),
          hmacHeader,
          process.env.SHOPIFY_WEBHOOK_SECRET || "test_webhook_secret"
        );

        if (!verified) {
          return res.status(401).json({ error: "Invalid webhook signature" });
        }

        // Process the order data
        const orderData = req.body;

        // Format the order event for Kafka
        const orderEvent = {
          event_type: "order.created",
          source: "shopify",
          shop_domain: shopDomain,
          timestamp: new Date().toISOString(),
          data: {
            order_id: orderData.id.toString(),
            customer: {
              email: orderData.email,
              first_name: orderData.customer?.first_name || "",
              last_name: orderData.customer?.last_name || "",
            },
            total: orderData.total_price,
            currency: orderData.currency,
            products: orderData.line_items.map((item: any) => ({
              id: item.product_id.toString(),
              title: item.title,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        };

        // Send to Kafka
        const kafkaProducer = new KafkaProducer(
          process.env.KAFKA_CLIENT_ID,
          (process.env.KAFKA_BROKERS || "localhost:9092").split(",")
        );

        await kafkaProducer.connect();
        await kafkaProducer.produce("order-events", orderEvent, shopDomain);
        await kafkaProducer.disconnect();

        // Return success
        res.status(200).json({ success: true });
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

/**
 * Verify the HMAC signature of a Shopify webhook
 * @param data - Raw webhook payload
 * @param hmac - HMAC signature from headers
 * @param secret - Webhook secret
 * @returns Whether the signature is valid
 */
function verifyShopifyWebhook(data: Buffer, hmac: string, secret: string): boolean {
  const calculatedHmac = crypto.createHmac("sha256", secret).update(data).digest("base64");

  return crypto.timingSafeEqual(Buffer.from(calculatedHmac), Buffer.from(hmac));
}

export default createServer;
