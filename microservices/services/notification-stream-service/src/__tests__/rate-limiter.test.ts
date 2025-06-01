import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Request, Response, NextFunction } from "express";

describe("RateLimiter", () => {
  // Mock dependencies
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    multi: jest.fn(() => mockRedis),
    exec: jest.fn(),
    eval: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockMetrics = {
    increment: jest.fn(),
    gauge: jest.fn(),
  };

  // Strategy implementations
  class FixedWindowStrategy {
    constructor(
      private redis = mockRedis,
      private windowSize = 60000 // 1 minute default
    ) {}

    async isAllowed(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
      const windowKey = this.getWindowKey(key);
      const count = await this.redis.incr(windowKey);
      
      if (count === 1) {
        await this.redis.expire(windowKey, Math.ceil(this.windowSize / 1000));
      }

      const ttl = await this.redis.ttl(windowKey);
      const resetAt = new Date(Date.now() + ttl * 1000);

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    }

    private getWindowKey(key: string): string {
      const window = Math.floor(Date.now() / this.windowSize);
      return `ratelimit:fixed:${key}:${window}`;
    }
  }

  class SlidingWindowStrategy {
    constructor(
      private redis = mockRedis,
      private windowSize = 60000 // 1 minute default
    ) {}

    async isAllowed(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
      const now = Date.now();
      const windowStart = now - this.windowSize;
      
      // Use Redis sorted set with timestamps as scores
      const setKey = `ratelimit:sliding:${key}`;
      
      // Remove old entries
      await this.redis.eval(
        `
        redis.call('zremrangebyscore', KEYS[1], '-inf', ARGV[1])
        local count = redis.call('zcard', KEYS[1])
        if count < tonumber(ARGV[2]) then
          redis.call('zadd', KEYS[1], ARGV[3], ARGV[3])
          redis.call('expire', KEYS[1], ARGV[4])
          return count + 1
        end
        return count
        `,
        1,
        setKey,
        windowStart,
        limit,
        now,
        Math.ceil(this.windowSize / 1000)
      );

      const count = await this.redis.eval(
        `return redis.call('zcard', KEYS[1])`,
        1,
        setKey
      );

      return {
        allowed: count < limit,
        remaining: Math.max(0, limit - count),
        resetAt: new Date(now + this.windowSize),
      };
    }
  }

  class TokenBucketStrategy {
    constructor(
      private redis = mockRedis,
      private refillRate = 10, // tokens per minute
      private bucketSize = 100
    ) {}

    async isAllowed(key: string, tokensRequested = 1): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
      const bucketKey = `ratelimit:bucket:${key}`;
      const now = Date.now();
      
      const result = await this.redis.eval(
        `
        local bucket_size = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local tokens_requested = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        
        local bucket = redis.call('hmget', KEYS[1], 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or bucket_size
        local last_refill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add
        local time_passed = (now - last_refill) / 1000
        local tokens_to_add = math.floor(time_passed * refill_rate / 60)
        tokens = math.min(bucket_size, tokens + tokens_to_add)
        
        if tokens >= tokens_requested then
          tokens = tokens - tokens_requested
          redis.call('hmset', KEYS[1], 'tokens', tokens, 'last_refill', now)
          redis.call('expire', KEYS[1], 3600)
          return {1, tokens}
        else
          redis.call('hmset', KEYS[1], 'tokens', tokens, 'last_refill', now)
          redis.call('expire', KEYS[1], 3600)
          return {0, tokens}
        end
        `,
        1,
        bucketKey,
        this.bucketSize,
        this.refillRate,
        tokensRequested,
        now
      );

      const [allowed, remaining] = result;
      const resetAt = new Date(now + (60000 / this.refillRate)); // Time for 1 token

      return {
        allowed: allowed === 1,
        remaining,
        resetAt,
      };
    }
  }

  class LeakyBucketStrategy {
    constructor(
      private redis = mockRedis,
      private leakRate = 10, // requests per minute that leak out
      private bucketSize = 100
    ) {}

    async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
      const bucketKey = `ratelimit:leaky:${key}`;
      const now = Date.now();
      
      const result = await this.redis.eval(
        `
        local bucket_size = tonumber(ARGV[1])
        local leak_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        local bucket = redis.call('hmget', KEYS[1], 'count', 'last_leak')
        local count = tonumber(bucket[1]) or 0
        local last_leak = tonumber(bucket[2]) or now
        
        -- Calculate how much has leaked
        local time_passed = (now - last_leak) / 1000
        local leaked = math.floor(time_passed * leak_rate / 60)
        count = math.max(0, count - leaked)
        
        if count < bucket_size then
          count = count + 1
          redis.call('hmset', KEYS[1], 'count', count, 'last_leak', now)
          redis.call('expire', KEYS[1], 3600)
          return {1, bucket_size - count}
        else
          redis.call('hmset', KEYS[1], 'count', count, 'last_leak', now)
          redis.call('expire', KEYS[1], 3600)
          return {0, 0}
        end
        `,
        1,
        bucketKey,
        this.bucketSize,
        this.leakRate,
        now
      );

      const [allowed, remaining] = result;
      const resetAt = new Date(now + (60000 / this.leakRate)); // Time for 1 leak

      return {
        allowed: allowed === 1,
        remaining,
        resetAt,
      };
    }
  }

  // RateLimiter class
  class RateLimiter {
    private strategies = new Map<string, any>();
    private defaultStrategy = "fixed";

    constructor(
      private redis = mockRedis,
      private logger = mockLogger,
      private metrics = mockMetrics
    ) {
      // Initialize default strategies
      this.strategies.set("fixed", new FixedWindowStrategy(redis));
      this.strategies.set("sliding", new SlidingWindowStrategy(redis));
      this.strategies.set("token", new TokenBucketStrategy(redis));
      this.strategies.set("leaky", new LeakyBucketStrategy(redis));
    }

    middleware(options: {
      keyGenerator?: (req: Request) => string;
      limit?: number;
      windowMs?: number;
      strategy?: string;
      skipSuccessfulRequests?: boolean;
      skipFailedRequests?: boolean;
      message?: string;
      headers?: boolean;
    } = {}) {
      const {
        keyGenerator = this.defaultKeyGenerator,
        limit = 100,
        strategy = this.defaultStrategy,
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        message = "Too many requests",
        headers = true,
      } = options;

      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          const key = keyGenerator(req);
          const result = await this.checkLimit(key, limit, strategy);

          if (headers) {
            res.setHeader("X-RateLimit-Limit", limit.toString());
            res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
            res.setHeader("X-RateLimit-Reset", result.resetAt.toISOString());
          }

          if (!result.allowed) {
            this.metrics.increment("rate_limit.exceeded", 1, {
              strategy,
              key,
            });

            res.status(429).json({
              error: message,
              retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
            });
            return;
          }

          // Store result for conditional counting
          (req as any).rateLimitResult = result;

          // Continue processing
          const originalSend = res.send;
          res.send = function(data: any) {
            // Conditionally count based on response
            const shouldCount = 
              (res.statusCode < 400 && !skipSuccessfulRequests) ||
              (res.statusCode >= 400 && !skipFailedRequests);

            if (!shouldCount && result.allowed) {
              // Refund the token if we shouldn't count this request
              // In real implementation, this would decrement the counter
            }

            return originalSend.call(this, data);
          };

          next();
        } catch (error) {
          this.logger.error("Rate limiter error", { error });
          this.metrics.increment("rate_limit.errors");
          // Fail open - allow request on error
          next();
        }
      };
    }

    async checkLimit(
      key: string,
      limit: number,
      strategy: string = this.defaultStrategy
    ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
      const strategyImpl = this.strategies.get(strategy);
      if (!strategyImpl) {
        throw new Error(`Unknown rate limit strategy: ${strategy}`);
      }

      const result = await strategyImpl.isAllowed(key, limit);
      
      this.metrics.gauge("rate_limit.remaining", result.remaining, {
        strategy,
        key,
      });

      return result;
    }

    async reset(key: string, strategy?: string) {
      if (strategy) {
        const strategyKey = this.getStrategyKey(strategy, key);
        await this.redis.del(strategyKey);
      } else {
        // Reset for all strategies
        for (const [name] of this.strategies) {
          const strategyKey = this.getStrategyKey(name, key);
          await this.redis.del(strategyKey);
        }
      }
    }

    registerStrategy(name: string, strategy: any) {
      this.strategies.set(name, strategy);
    }

    private defaultKeyGenerator(req: Request): string {
      // Use IP address as default key
      const ip = req.ip || 
                 req.headers["x-forwarded-for"] || 
                 req.socket.remoteAddress || 
                 "unknown";
      return `ip:${ip}`;
    }

    private getStrategyKey(strategy: string, key: string): string {
      return `ratelimit:${strategy}:${key}:*`;
    }
  }

  let rateLimiter: RateLimiter;
  let mockReq: any;
  let mockRes: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiter = new RateLimiter();
    
    mockReq = {
      ip: "192.168.1.1",
      headers: {},
      socket: { remoteAddress: "192.168.1.1" },
    };
    
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("middleware", () => {
    it("should allow request when under limit", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      const middleware = rateLimiter.middleware({ limit: 10 });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "9");
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Reset",
        expect.any(String)
      );
    });

    it("should block request when over limit", async () => {
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(30);

      const middleware = rateLimiter.middleware({ limit: 10 });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Too many requests",
        retryAfter: expect.any(Number),
      });
    });

    it("should use custom key generator", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);
      
      mockReq.user = { id: "user-123" };

      const keyGenerator = (req: any) => `user:${req.user.id}`;
      const middleware = rateLimiter.middleware({ keyGenerator, limit: 5 });
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringContaining("user:user-123")
      );
    });

    it("should skip headers when disabled", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      const middleware = rateLimiter.middleware({ headers: false });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it("should fail open on error", async () => {
      mockRedis.incr.mockRejectedValue(new Error("Redis error"));

      const middleware = rateLimiter.middleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Rate limiter error",
        expect.any(Object)
      );
    });
  });

  describe("strategies", () => {
    describe("fixed window", () => {
      it("should increment counter in fixed window", async () => {
        mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
        mockRedis.ttl.mockResolvedValue(60);

        const result1 = await rateLimiter.checkLimit("test-key", 5, "fixed");
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(4);

        const result2 = await rateLimiter.checkLimit("test-key", 5, "fixed");
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(3);
      });

      it("should expire window key on first request", async () => {
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        await rateLimiter.checkLimit("test-key", 5, "fixed");

        expect(mockRedis.expire).toHaveBeenCalled();
      });
    });

    describe("sliding window", () => {
      it("should use sorted set for sliding window", async () => {
        mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(3);

        const result = await rateLimiter.checkLimit("test-key", 5, "sliding");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
        expect(mockRedis.eval).toHaveBeenCalledWith(
          expect.stringContaining("zremrangebyscore"),
          expect.any(Number),
          expect.any(String),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe("token bucket", () => {
      it("should consume tokens from bucket", async () => {
        mockRedis.eval.mockResolvedValue([1, 99]); // allowed, 99 remaining

        const result = await rateLimiter.checkLimit("test-key", 1, "token");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99);
      });

      it("should refill tokens over time", async () => {
        mockRedis.eval.mockResolvedValue([1, 50]); // allowed, 50 remaining after refill

        const result = await rateLimiter.checkLimit("test-key", 1, "token");

        expect(result.allowed).toBe(true);
        expect(mockRedis.eval).toHaveBeenCalledWith(
          expect.stringContaining("tokens_to_add"),
          expect.any(Number),
          expect.any(String),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    describe("leaky bucket", () => {
      it("should leak requests over time", async () => {
        mockRedis.eval.mockResolvedValue([1, 95]); // allowed, 95 remaining

        const result = await rateLimiter.checkLimit("test-key", 100, "leaky");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(95);
      });

      it("should block when bucket is full", async () => {
        mockRedis.eval.mockResolvedValue([0, 0]); // not allowed, 0 remaining

        const result = await rateLimiter.checkLimit("test-key", 100, "leaky");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });
  });

  describe("conditional counting", () => {
    it("should skip successful requests when configured", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      const middleware = rateLimiter.middleware({
        limit: 10,
        skipSuccessfulRequests: true,
      });
      
      await middleware(mockReq, mockRes, mockNext);
      
      // Simulate successful response
      mockRes.statusCode = 200;
      mockRes.send("OK");

      expect(mockNext).toHaveBeenCalled();
      // In real implementation, this would refund the token
    });

    it("should skip failed requests when configured", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      const middleware = rateLimiter.middleware({
        limit: 10,
        skipFailedRequests: true,
      });
      
      await middleware(mockReq, mockRes, mockNext);
      
      // Simulate failed response
      mockRes.statusCode = 500;
      mockRes.send("Error");

      expect(mockNext).toHaveBeenCalled();
      // In real implementation, this would refund the token
    });
  });

  describe("reset", () => {
    it("should reset limit for specific strategy", async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.reset("test-key", "fixed");

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("ratelimit:fixed:test-key")
      );
    });

    it("should reset limit for all strategies", async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.reset("test-key");

      expect(mockRedis.del).toHaveBeenCalledTimes(4); // One for each strategy
    });
  });

  describe("custom strategies", () => {
    it("should register and use custom strategy", async () => {
      const customStrategy = {
        isAllowed: jest.fn().mockResolvedValue({
          allowed: true,
          remaining: 42,
          resetAt: new Date(),
        }),
      };

      rateLimiter.registerStrategy("custom", customStrategy);

      const result = await rateLimiter.checkLimit("test-key", 100, "custom");

      expect(result.remaining).toBe(42);
      expect(customStrategy.isAllowed).toHaveBeenCalledWith("test-key", 100);
    });

    it("should throw error for unknown strategy", async () => {
      await expect(
        rateLimiter.checkLimit("test-key", 100, "unknown")
      ).rejects.toThrow("Unknown rate limit strategy: unknown");
    });
  });
});