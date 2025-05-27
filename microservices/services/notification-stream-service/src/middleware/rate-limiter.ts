import { Request, Response, NextFunction } from "express";
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "rate-limiter" });

// Rate limiting strategies
export enum RateLimitStrategy {
  FIXED_WINDOW = "fixed_window",
  SLIDING_WINDOW = "sliding_window",
  TOKEN_BUCKET = "token_bucket",
  LEAKY_BUCKET = "leaky_bucket",
}

// Rate limit configuration
export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (req: Request) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableHeaders?: boolean; // Add rate limit headers to response
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code for rate limited requests
  onLimitReached?: (req: Request, res: Response) => void;
  store?: RateLimitStore; // Custom store implementation
}

// Rate limit store interface
export interface RateLimitStore {
  get(key: string): Promise<RateLimitData | null>;
  set(key: string, data: RateLimitData, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<RateLimitData>;
  reset(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

// Rate limit data
export interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequest?: number;
  tokens?: number; // For token bucket
  lastRefill?: number; // For token bucket
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitData> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async get(key: string): Promise<RateLimitData | null> {
    const data = this.store.get(key);

    // Check if expired
    if (data && Date.now() > data.resetTime) {
      this.store.delete(key);
      return null;
    }

    return data || null;
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    this.store.set(key, {
      ...data,
      resetTime: Date.now() + ttl,
    });
  }

  async increment(key: string, ttl: number): Promise<RateLimitData> {
    const existing = await this.get(key);
    const now = Date.now();

    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing;
    } else {
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + ttl,
        firstRequest: now,
      };
      this.store.set(key, newData);
      return newData;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.store.entries()) {
      if (now > data.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Cleaned up expired rate limit entries", { count: cleaned });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/**
 * Redis rate limit store (placeholder implementation)
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redisClient: any; // Redis client instance

  constructor(redisClient: any) {
    this.redisClient = redisClient;
  }

  async get(key: string): Promise<RateLimitData | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Redis get error:", error);
      return null;
    }
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(key, Math.ceil(ttl / 1000), JSON.stringify(data));
    } catch (error) {
      logger.error("Redis set error:", error);
    }
  }

  async increment(key: string, ttl: number): Promise<RateLimitData> {
    try {
      const multi = this.redisClient.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(ttl / 1000));
      const results = await multi.exec();

      const count = results[0][1];
      const now = Date.now();

      return {
        count,
        resetTime: now + ttl,
        firstRequest: now,
      };
    } catch (error) {
      logger.error("Redis increment error:", error);
      throw error;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      logger.error("Redis reset error:", error);
    }
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically, no cleanup needed
  }
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig) {
    const defaults = {
      strategy: RateLimitStrategy.FIXED_WINDOW,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req: Request) => req.ip || "unknown",
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableHeaders: true,
      message: "Too many requests",
      statusCode: 429,
    };

    this.config = { ...defaults, ...config };

    this.store = config.store || new MemoryRateLimitStore();
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(req: Request): Promise<RateLimitResult> {
    const key = this.generateKey(req);

    switch (this.config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(key);
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(key);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(key);
      case RateLimitStrategy.LEAKY_BUCKET:
        return this.checkLeakyBucket(key);
      default:
        throw new Error(`Unsupported rate limit strategy: ${this.config.strategy}`);
    }
  }

  /**
   * Fixed window rate limiting
   */
  private async checkFixedWindow(key: string): Promise<RateLimitResult> {
    const data = await this.store.increment(key, this.config.windowMs);

    const allowed = data.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - data.count);

    return {
      allowed,
      remaining,
      resetTime: data.resetTime,
      totalRequests: data.count,
    };
  }

  /**
   * Sliding window rate limiting
   */
  private async checkSlidingWindow(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // For simplicity, using fixed window with shorter intervals
    // In production, you'd want a more sophisticated sliding window implementation
    const data = await this.store.get(key);

    if (!data || data.firstRequest! < windowStart) {
      // Reset window
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
      };
      await this.store.set(key, newData, this.config.windowMs);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: newData.resetTime,
        totalRequests: 1,
      };
    }

    // Increment count
    data.count++;
    await this.store.set(key, data, this.config.windowMs);

    const allowed = data.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - data.count);

    return {
      allowed,
      remaining,
      resetTime: data.resetTime,
      totalRequests: data.count,
    };
  }

  /**
   * Token bucket rate limiting
   */
  private async checkTokenBucket(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const data = await this.store.get(key);

    let tokens: number;
    let lastRefill: number;

    if (!data) {
      // Initialize bucket
      tokens = this.config.maxRequests - 1; // Consume one token
      lastRefill = now;
    } else {
      // Refill tokens based on time elapsed
      const timePassed = now - (data.lastRefill || now);
      const tokensToAdd = Math.floor((timePassed / this.config.windowMs) * this.config.maxRequests);

      tokens = Math.min(this.config.maxRequests, (data.tokens || 0) + tokensToAdd);
      lastRefill = data.lastRefill || now;

      // Consume one token if available
      if (tokens > 0) {
        tokens--;
      }
    }

    const newData: RateLimitData = {
      count: data?.count || 0,
      resetTime: now + this.config.windowMs,
      tokens,
      lastRefill,
    };

    await this.store.set(key, newData, this.config.windowMs);

    const allowed = tokens >= 0;

    return {
      allowed,
      remaining: Math.max(0, tokens),
      resetTime: newData.resetTime,
      totalRequests: newData.count,
    };
  }

  /**
   * Leaky bucket rate limiting
   */
  private async checkLeakyBucket(key: string): Promise<RateLimitResult> {
    // Simplified leaky bucket implementation
    // In production, you'd want a more sophisticated implementation
    return this.checkTokenBucket(key);
  }

  /**
   * Generate rate limit key
   */
  private generateKey(req: Request): string {
    const baseKey = this.config.keyGenerator(req);
    return `rate_limit:${this.config.strategy}:${baseKey}`;
  }

  /**
   * Reset rate limit for key
   */
  async reset(req: Request): Promise<void> {
    const key = this.generateKey(req);
    await this.store.reset(key);
  }
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const rateLimiter = new RateLimiter(config as RateLimitConfig);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rateLimiter.checkLimit(req);

      // Add rate limit headers
      if (config.enableHeaders !== false) {
        res.set({
          "X-RateLimit-Limit": config.maxRequests?.toString() || "100",
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
        });
      }

      if (!result.allowed) {
        // Rate limit exceeded
        logger.warn("Rate limit exceeded", {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          path: req.path,
          method: req.method,
          totalRequests: result.totalRequests,
        });

        metrics.increment("rate_limit.exceeded", {
          strategy: config.strategy || "fixed_window",
          path: req.path,
        });

        if (config.onLimitReached) {
          config.onLimitReached(req, res);
        }

        return res.status(config.statusCode || 429).json({
          error: config.message || "Too many requests",
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      // Request allowed
      metrics.increment("rate_limit.allowed", {
        strategy: config.strategy || "fixed_window",
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error("Rate limiting error:", error);

      // On error, allow the request to proceed
      next();
    }
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  // Very strict rate limiting
  strict: {
    strategy: RateLimitStrategy.FIXED_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    message: "Too many requests. Please try again later.",
  },

  // Standard rate limiting
  standard: {
    strategy: RateLimitStrategy.FIXED_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: "Rate limit exceeded. Please try again later.",
  },

  // Lenient rate limiting
  lenient: {
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 1000,
    message: "Rate limit exceeded. Please try again later.",
  },

  // API rate limiting
  api: {
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    windowMs: 60000, // 1 minute
    maxRequests: 500,
    keyGenerator: (req: Request) => {
      // Use API key or user ID if available
      const apiKey = req.get("X-API-Key") || req.get("Authorization");
      return apiKey ? `api:${apiKey}` : `ip:${req.ip}`;
    },
    message: "API rate limit exceeded. Please check your usage.",
  },

  // WebSocket connection rate limiting
  websocket: {
    strategy: RateLimitStrategy.FIXED_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 50,
    keyGenerator: (req: Request) => `ws:${req.ip}`,
    message: "WebSocket connection rate limit exceeded.",
  },

  // SSE connection rate limiting
  sse: {
    strategy: RateLimitStrategy.FIXED_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 20,
    keyGenerator: (req: Request) => `sse:${req.ip}`,
    message: "SSE connection rate limit exceeded.",
  },

  // Organization-based rate limiting
  organization: {
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    windowMs: 60000, // 1 minute
    maxRequests: 10000,
    keyGenerator: (req: Request) => {
      const orgId = (req.query.organizationId as string) || req.body?.organizationId;
      return orgId ? `org:${orgId}` : `ip:${req.ip}`;
    },
    message: "Organization rate limit exceeded.",
  },
};

/**
 * Create rate limiter with preset configuration
 */
export function createPresetRateLimiter(
  preset: keyof typeof RateLimitPresets,
  overrides: Partial<RateLimitConfig> = {}
) {
  const config = {
    ...RateLimitPresets[preset],
    ...overrides,
  };

  return createRateLimitMiddleware(config);
}

/**
 * Rate limit by organization ID
 */
export const rateLimitByOrganization = createPresetRateLimiter("organization");

/**
 * Rate limit API requests
 */
export const rateLimitAPI = createPresetRateLimiter("api");

/**
 * Rate limit WebSocket connections
 */
export const rateLimitWebSocket = createPresetRateLimiter("websocket");

/**
 * Rate limit SSE connections
 */
export const rateLimitSSE = createPresetRateLimiter("sse");

/**
 * Standard rate limiting
 */
export const rateLimitStandard = createPresetRateLimiter("standard");

export default {
  createRateLimitMiddleware,
  createPresetRateLimiter,
  RateLimiter,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  RateLimitStrategy,
  RateLimitPresets,
};
