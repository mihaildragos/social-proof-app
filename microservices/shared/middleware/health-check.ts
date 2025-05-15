import { Request, Response, Router } from 'express';
import { Kafka, logLevel } from 'kafkajs';
import Redis from 'ioredis';
import { Pool } from 'pg';

// Interface for service dependencies
interface ServiceDependencies {
  kafka?: {
    clientId: string;
    brokers: string[];
  };
  redis?: {
    url: string;
  };
  postgres?: {
    connectionString: string;
  };
}

// Health check status types
type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

// Health check component result
interface ComponentHealth {
  status: HealthStatus;
  details?: any;
}

// Overall health check result
interface HealthCheckResult {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    [key: string]: ComponentHealth;
  };
}

/**
 * Health check middleware factory
 * @param serviceName - Name of the service
 * @param dependencies - Service dependencies to check
 * @returns Express router with health check endpoints
 */
function createHealthCheckMiddleware(serviceName: string, dependencies?: ServiceDependencies): Router {
  const router = Router();
  const startTime = Date.now();
  
  // Basic health check endpoint - quick response
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', service: serviceName });
  });
  
  // Detailed health check endpoint - checks all dependencies
  router.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const result: HealthCheckResult = {
        status: 'healthy',
        version: process.env.VERSION || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        components: {}
      };
      
      // Check components if dependencies are provided
      if (dependencies) {
        // Check Kafka connection
        if (dependencies.kafka) {
          try {
            const kafka = new Kafka({
              clientId: dependencies.kafka.clientId,
              brokers: dependencies.kafka.brokers,
              logLevel: logLevel.ERROR
            });
            
            const admin = kafka.admin();
            await admin.connect();
            const topics = await admin.listTopics();
            await admin.disconnect();
            
            result.components.kafka = {
              status: 'healthy',
              details: { topics: topics.length }
            };
          } catch (error: any) {
            result.components.kafka = {
              status: 'unhealthy',
              details: { error: error.message }
            };
            result.status = 'degraded';
          }
        }
        
        // Check Redis connection
        if (dependencies.redis) {
          try {
            const redis = new Redis(dependencies.redis.url);
            const pingResult = await redis.ping();
            await redis.quit();
            
            result.components.redis = {
              status: pingResult === 'PONG' ? 'healthy' : 'degraded',
              details: { ping: pingResult }
            };
          } catch (error: any) {
            result.components.redis = {
              status: 'unhealthy',
              details: { error: error.message }
            };
            result.status = 'degraded';
          }
        }
        
        // Check PostgreSQL connection
        if (dependencies.postgres) {
          try {
            const pool = new Pool({
              connectionString: dependencies.postgres.connectionString,
              connectionTimeoutMillis: 5000
            });
            
            const client = await pool.connect();
            const dbResult = await client.query('SELECT 1 as result');
            client.release();
            await pool.end();
            
            result.components.postgres = {
              status: 'healthy',
              details: { result: dbResult.rows[0].result }
            };
          } catch (error: any) {
            result.components.postgres = {
              status: 'unhealthy',
              details: { error: error.message }
            };
            result.status = 'degraded';
          }
        }
      }
      
      // Set response status based on health status
      const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 207 : 503;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  });
  
  return router;
}

export default createHealthCheckMiddleware; 