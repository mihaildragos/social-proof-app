import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RedisSubscriber } from '../../shared/redis/subscriber';
import { requestLogger } from '../../shared/utils/logger';
import createHealthCheckMiddleware from '../../shared/middleware/health-check';
import { IncomingMessage, ServerResponse } from 'http';

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
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }));
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  
  // Health check endpoints
  app.use(createHealthCheckMiddleware('notification-stream-service', {
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
  }));
  
  // SSE endpoint for real-time notifications
  app.get('/api/notifications/sse', (req: Request, res: Response) => {
    const shopDomain = req.query.shopDomain as string;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // Create Redis subscriber
    const subscriber = new RedisSubscriber(process.env.REDIS_URL);
    const channel = `notifications:${shopDomain}`;
    
    // Function to send notification to client
    const sendNotification = (message: string) => {
      res.write(`data: ${message}\n\n`);
    };
    
    // Subscribe to Redis channel
    subscriber.subscribe(channel, sendNotification)
      .catch(error => {
        console.error(`Error subscribing to channel ${channel}:`, error);
        res.end();
      });
    
    // Handle client disconnect
    req.on('close', () => {
      subscriber.unsubscribe(channel)
        .catch(error => {
          console.error(`Error unsubscribing from channel ${channel}:`, error);
        });
    });
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connection_established' })}\n\n`);
  });
  
  // Error handling middleware
  app.use((err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  });
  
  return app;
}

export default createServer; 