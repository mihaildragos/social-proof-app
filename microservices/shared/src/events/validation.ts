import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateAndMigrateEvent } from "./versioning";
import { BaseEventSchema, EVENT_TYPES } from "./schemas";
import { logger } from "../utils/logger";

// Mock metrics for now - will be replaced with actual metrics implementation
const metrics = {
  increment: (name: string, tags?: Record<string, string>) => {
    console.log(`[METRICS] Counter ${name} incremented`, tags);
  },
  histogram: (name: string, value: number, tags?: Record<string, string>) => {
    console.log(`[METRICS] Histogram ${name}: ${value}`, tags);
  }
};

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxEvents: number;
  keyGenerator?: (req: Request) => string;
}

// Validation middleware configuration
interface ValidationConfig {
  enforceVersioning?: boolean;
  allowUnknownEvents?: boolean;
  rateLimiting?: RateLimitConfig;
  customValidators?: Record<string, (event: any) => Promise<boolean>>;
}

// Rate limiting store
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return true;
    }

    if (entry.count >= config.maxEvents) {
      return false;
    }

    entry.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Cleanup rate limit store every 5 minutes
setInterval(() => rateLimitStore.cleanup(), 5 * 60 * 1000);

// Event validation middleware
export function createEventValidationMiddleware(config: ValidationConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Extract event from request body
      const event = req.body;
      
      if (!event) {
        metrics.increment('event_validation.missing_body');
        return res.status(400).json({
          error: 'Missing event data in request body',
          code: 'MISSING_EVENT_DATA'
        });
      }

      // Rate limiting check
      if (config.rateLimiting) {
        const key = config.rateLimiting.keyGenerator 
          ? config.rateLimiting.keyGenerator(req)
          : req.ip || 'unknown';
        
        if (!rateLimitStore.isAllowed(key, config.rateLimiting)) {
          metrics.increment('event_validation.rate_limited');
          logger.warn('Rate limit exceeded', { key, ip: req.ip });
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
          });
        }
      }

      // Basic event structure validation
      const baseValidation = BaseEventSchema.safeParse(event);
      if (!baseValidation.success) {
        metrics.increment('event_validation.invalid_structure');
        logger.warn('Invalid event structure', {
          errors: baseValidation.error.errors,
          event: event
        });
        
        return res.status(400).json({
          error: 'Invalid event structure',
          code: 'INVALID_EVENT_STRUCTURE',
          details: baseValidation.error.errors
        });
      }

      const validatedEvent = baseValidation.data;

      // Event type validation
      if (!Object.values(EVENT_TYPES).includes(validatedEvent.type as any)) {
        if (!config.allowUnknownEvents) {
          metrics.increment('event_validation.unknown_type');
          logger.warn('Unknown event type', { type: validatedEvent.type });
          
          return res.status(400).json({
            error: 'Unknown event type',
            code: 'UNKNOWN_EVENT_TYPE',
            type: validatedEvent.type
          });
        }
      }

      // Version validation and migration
      if (config.enforceVersioning !== false) {
        try {
          const migrationResult = validateAndMigrateEvent(validatedEvent);
          if (!migrationResult.valid) {
            throw new Error(migrationResult.errors?.join(', ') || 'Validation failed');
          }
          req.body = migrationResult.event || validatedEvent;
        } catch (error) {
          metrics.increment('event_validation.version_error');
          logger.error('Event version validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            event: validatedEvent
          });
          
          return res.status(400).json({
            error: 'Event version validation failed',
            code: 'VERSION_VALIDATION_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Custom validation
      if (config.customValidators) {
        for (const [name, validator] of Object.entries(config.customValidators)) {
          try {
            const isValid = await validator(validatedEvent);
            if (!isValid) {
              metrics.increment('event_validation.custom_failed', { validator: name });
              logger.warn('Custom validation failed', { validator: name, event: validatedEvent });
              
              return res.status(400).json({
                error: 'Custom validation failed',
                code: 'CUSTOM_VALIDATION_FAILED',
                validator: name
              });
            }
          } catch (error) {
            metrics.increment('event_validation.custom_error', { validator: name });
            logger.error('Custom validator error', {
              validator: name,
              error: error instanceof Error ? error.message : 'Unknown error',
              event: validatedEvent
            });
            
            return res.status(500).json({
              error: 'Custom validator error',
              code: 'CUSTOM_VALIDATOR_ERROR',
              validator: name
            });
          }
        }
      }

      // Add validation metadata to request
      req.eventValidation = {
        validatedAt: new Date(),
        originalEvent: event,
        validatedEvent: req.body,
        processingTime: Date.now() - startTime
      };

      // Success metrics
      metrics.increment('event_validation.success');
      metrics.histogram('event_validation.duration', Date.now() - startTime);
      
      logger.debug('Event validation successful', {
        type: validatedEvent.type,
        id: validatedEvent.id,
        processingTime: Date.now() - startTime
      });

      next();
    } catch (error) {
      metrics.increment('event_validation.error');
      logger.error('Event validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      res.status(500).json({
        error: 'Internal validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

// Specific middleware configurations
export const strictEventValidation = createEventValidationMiddleware({
  enforceVersioning: true,
  allowUnknownEvents: false,
  rateLimiting: {
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 100,
    keyGenerator: (req) => `${req.ip}-${req.headers['x-organization-id'] || 'unknown'}`
  }
});

export const lenientEventValidation = createEventValidationMiddleware({
  enforceVersioning: false,
  allowUnknownEvents: true,
  rateLimiting: {
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 1000,
    keyGenerator: (req) => req.ip || 'unknown'
  }
});

export const highVolumeEventValidation = createEventValidationMiddleware({
  enforceVersioning: true,
  allowUnknownEvents: false,
  rateLimiting: {
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 10000,
    keyGenerator: (req) => req.headers['x-api-key'] as string || req.ip || 'unknown'
  }
});

// Batch event validation middleware
export function createBatchEventValidationMiddleware(config: ValidationConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const events = req.body;
      
      if (!Array.isArray(events)) {
        metrics.increment('batch_event_validation.not_array');
        return res.status(400).json({
          error: 'Request body must be an array of events',
          code: 'INVALID_BATCH_FORMAT'
        });
      }

      if (events.length === 0) {
        metrics.increment('batch_event_validation.empty_batch');
        return res.status(400).json({
          error: 'Batch cannot be empty',
          code: 'EMPTY_BATCH'
        });
      }

      if (events.length > 1000) {
        metrics.increment('batch_event_validation.batch_too_large');
        return res.status(400).json({
          error: 'Batch size exceeds maximum of 1000 events',
          code: 'BATCH_TOO_LARGE'
        });
      }

      // Rate limiting for batch
      if (config.rateLimiting) {
        const key = config.rateLimiting.keyGenerator 
          ? config.rateLimiting.keyGenerator(req)
          : req.ip || 'unknown';
        
        // Check if batch size would exceed rate limit
        const adjustedConfig = {
          ...config.rateLimiting,
          maxEvents: Math.floor(config.rateLimiting.maxEvents / events.length)
        };
        
        if (!rateLimitStore.isAllowed(key, adjustedConfig)) {
          metrics.increment('batch_event_validation.rate_limited');
          return res.status(429).json({
            error: 'Rate limit exceeded for batch',
            code: 'BATCH_RATE_LIMIT_EXCEEDED'
          });
        }
      }

      const validatedEvents = [];
      const errors = [];

      // Validate each event in the batch
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        try {
          // Basic validation
          const baseValidation = BaseEventSchema.safeParse(event);
          if (!baseValidation.success) {
            errors.push({
              index: i,
              error: 'Invalid event structure',
              details: baseValidation.error.errors
            });
            continue;
          }

          const validatedEvent = baseValidation.data;

          // Event type validation
          if (!Object.values(EVENT_TYPES).includes(validatedEvent.type as any)) {
            if (!config.allowUnknownEvents) {
              errors.push({
                index: i,
                error: 'Unknown event type',
                type: validatedEvent.type
              });
              continue;
            }
          }

          // Version validation
          if (config.enforceVersioning !== false) {
            const migrationResult = validateAndMigrateEvent(validatedEvent);
            if (!migrationResult.valid) {
              errors.push({
                index: i,
                error: 'Version validation failed',
                details: migrationResult.errors?.join(', ') || 'Unknown error'
              });
              continue;
            }
            validatedEvents.push(migrationResult.event || validatedEvent);
          } else {
            validatedEvents.push(validatedEvent);
          }
        } catch (error) {
          errors.push({
            index: i,
            error: 'Validation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Check if there were validation errors
      if (errors.length > 0) {
        metrics.increment('batch_event_validation.partial_failure');
        logger.warn('Batch validation had errors', {
          totalEvents: events.length,
          validEvents: validatedEvents.length,
          errorCount: errors.length,
          errors: errors.slice(0, 10) // Log first 10 errors
        });
        
        return res.status(400).json({
          error: 'Batch validation failed',
          code: 'BATCH_VALIDATION_FAILED',
          validEvents: validatedEvents.length,
          totalEvents: events.length,
          errors: errors
        });
      }

      // Replace request body with validated events
      req.body = validatedEvents;

      // Add batch validation metadata
      req.batchValidation = {
        validatedAt: new Date(),
        eventCount: validatedEvents.length,
        processingTime: Date.now() - startTime
      };

      metrics.increment('batch_event_validation.success');
      metrics.histogram('batch_event_validation.duration', Date.now() - startTime);
      metrics.histogram('batch_event_validation.size', validatedEvents.length);

      logger.debug('Batch validation successful', {
        eventCount: validatedEvents.length,
        processingTime: Date.now() - startTime
      });

      next();
    } catch (error) {
      metrics.increment('batch_event_validation.error');
      logger.error('Batch validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json({
        error: 'Internal batch validation error',
        code: 'BATCH_VALIDATION_ERROR'
      });
    }
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      eventValidation?: {
        validatedAt: Date;
        originalEvent: any;
        validatedEvent: any;
        processingTime: number;
      };
      batchValidation?: {
        validatedAt: Date;
        eventCount: number;
        processingTime: number;
      };
    }
  }
}

export { RateLimitStore, ValidationConfig, RateLimitConfig };
