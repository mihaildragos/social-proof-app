import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Middleware to log incoming requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID if not already present
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Get request start time
  const start = Date.now();
  
  // Log request details
  logger.info(`Incoming request`, {
    method: req.method,
    url: req.originalUrl,
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Add response finished listener to log response details
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level](`Request completed`, {
      method: req.method,
      url: req.originalUrl,
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  
  next();
}; 