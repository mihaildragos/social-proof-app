import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import webhookSimulationRoutes from "./src/routes/webhook-simulation";
import notificationRoutes from "./src/routes/notifications";
import { sseRouter } from "./src/routes/sse";

// Simple request logger middleware
const requestLogger = (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
};

// Simple health check middleware
const createHealthCheckMiddleware = (serviceName: string, _config?: any) => {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    if (req.path === "/health") {
      return res.json({
        status: "healthy",
        service: serviceName,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
};

// Simple Redis subscriber placeholder
class RedisSubscriber {
  constructor(private url?: string) {}

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    console.log(`Subscribing to channel: ${channel}`);
    // TODO: Implement actual Redis subscription
  }

  async unsubscribe(channel: string): Promise<void> {
    console.log(`Unsubscribing from channel: ${channel}`);
    // TODO: Implement actual Redis unsubscription
  }
}

// Extend the Express types for SSE
interface Request extends ExpressRequest {
  on(event: string, callback: (...args: any[]) => void): this;
}

interface Response extends ExpressResponse {
  flushHeaders(): void;
  write(chunk: string | Buffer): boolean;
}

export function createServer() {
  const app = express();

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
          frameSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
        },
      },
    })
  );
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Health check endpoints
  app.use(
    createHealthCheckMiddleware("notification-stream-service", {
      redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
      },
    })
  );

  // Register webhook simulation routes
  app.use("/api/webhooks", webhookSimulationRoutes);

  // Register notification routes
  app.use("/api/notifications", notificationRoutes);

  // Register SSE routes
  app.use("/api/notifications/sse", sseRouter);

  // Legacy SSE endpoint for backward compatibility
  app.get("/api/notifications/sse/:siteId", async (req: Request, res: Response) => {
    const { siteId } = req.params;
    const organizationId = req.query.organizationId as string || 'test-org';

    if (!siteId) {
      return res.status(400).json({ error: "Site ID is required" });
    }

    // Handle HEAD requests separately - just return headers without establishing SSE connection
    if (req.method === 'HEAD') {
      console.log(`HEAD request for SSE endpoint - site ${siteId}, organization ${organizationId}`);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
      return res.status(200).end();
    }

    console.log(`SSE connection request for site ${siteId}, organization ${organizationId}`);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
    res.flushHeaders();

    try {
      // Import SSE server to register this connection
      const { sseServer } = await import('./src/routes/sse');

      // Update the request query parameters to include the required params
      req.query.organizationId = organizationId;
      req.query.siteId = siteId;

      console.log(`Passing to SSE server with params:`, { organizationId, siteId });

      // Register this connection with the SSE server using the original request object
      sseServer.handleConnection(req, res);

      console.log(`SSE connection established for site ${siteId}, organization ${organizationId}`);
    } catch (error) {
      console.error(`Error setting up SSE connection for site ${siteId}:`, error);
      // Close the connection on error
      res.end();
    }
  });

  // Error handling middleware
  app.use((err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

export default createServer;
