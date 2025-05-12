import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Apply additional security headers beyond what Helmet provides
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; form-action 'self';"
  );

  // Permissions Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Clear-Site-Data on logout routes
  if (req.path === '/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  next();
};

/**
 * Rate limiting middleware
 * Simple in-memory implementation; for production use Redis or similar
 */
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_WINDOW = 100; // Max requests per time window
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute window

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const now = Date.now();
  
  // Skip rate limiting for certain paths
  if (req.path === '/health' || req.path === '/health/ready') {
    return next();
  }

  // Get or initialize rate limit data for this IP
  let rateLimitData = ipRequestCounts.get(ip);
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + WINDOW_SIZE_MS,
    };
  }

  // Increment request count
  rateLimitData.count += 1;
  ipRequestCounts.set(ip, rateLimitData);

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - rateLimitData.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000).toString());

  // If limit exceeded, return 429 Too Many Requests
  if (rateLimitData.count > MAX_REQUESTS_PER_WINDOW) {
    logger.warn('Rate limit exceeded', { ip, path: req.path });
    return res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later',
    });
  }

  next();
};

/**
 * Middleware to clean up user input data
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    // Function to recursively sanitize values in an object
    const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Skip sanitization for password and token fields
        if (key === 'password' || key.includes('token') || key.includes('Token')) {
          result[key] = value;
          continue;
        }
        
        // Recursively sanitize nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = sanitizeObject(value);
        }
        // Sanitize string values
        else if (typeof value === 'string') {
          // Basic sanitization - remove script tags and trim
          result[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .trim();
        }
        // Keep other values as is (numbers, booleans, arrays, etc.)
        else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    // Apply sanitization to request body
    req.body = sanitizeObject(req.body);
  }
  
  next();
}; 