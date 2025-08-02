import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("ChannelRouter", () => {
  // Mock channel processors
  const mockWebProcessor = {
    process: jest.fn(),
    validate: jest.fn(),
    getCapabilities: jest.fn(() => ({
      supportsRichContent: true,
      supportsInteractivity: true,
      maxMessageLength: 1000,
    })),
  };

  const mockEmailProcessor = {
    process: jest.fn(),
    validate: jest.fn(),
    getCapabilities: jest.fn(() => ({
      supportsRichContent: true,
      supportsAttachments: true,
      supportsScheduling: true,
    })),
  };

  const mockPushProcessor = {
    process: jest.fn(),
    validate: jest.fn(),
    getCapabilities: jest.fn(() => ({
      supportsRichContent: false,
      maxMessageLength: 256,
      requiresDeviceToken: true,
    })),
  };

  const mockSMSProcessor = {
    process: jest.fn(),
    validate: jest.fn(),
    getCapabilities: jest.fn(() => ({
      supportsRichContent: false,
      maxMessageLength: 160,
      requiresPhoneNumber: true,
    })),
  };

  const mockWebhookProcessor = {
    process: jest.fn(),
    validate: jest.fn(),
    getCapabilities: jest.fn(() => ({
      supportsCustomPayload: true,
      supportsRetry: true,
    })),
  };

  // Mock dependencies
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockMetrics = {
    increment: jest.fn(),
    histogram: jest.fn(),
  };

  const mockUserPreferences = {
    getPreferences: jest.fn(),
    updateLastContact: jest.fn(),
  };

  const mockRateLimiter = {
    isAllowed: jest.fn(),
    increment: jest.fn(),
  };

  // ChannelRouter implementation
  class ChannelRouter {
    private processors = new Map<string, any>();
    private fallbackChannels = new Map<string, string[]>();

    constructor(
      private logger = mockLogger,
      private metrics = mockMetrics,
      private userPreferences = mockUserPreferences,
      private rateLimiter = mockRateLimiter
    ) {
      // Register default processors
      this.registerProcessor("web", mockWebProcessor);
      this.registerProcessor("email", mockEmailProcessor);
      this.registerProcessor("push", mockPushProcessor);
      this.registerProcessor("sms", mockSMSProcessor);
      this.registerProcessor("webhook", mockWebhookProcessor);

      // Set default fallback chains
      this.fallbackChannels.set("push", ["web", "email"]);
      this.fallbackChannels.set("web", ["push", "email"]);
      this.fallbackChannels.set("sms", ["push", "email"]);
    }

    registerProcessor(channel: string, processor: any) {
      if (!channel) throw new Error("Channel is required");
      if (!processor) throw new Error("Processor is required");
      
      this.processors.set(channel, processor);
      this.logger.info("Channel processor registered", { channel });
    }

    async route(notification: {
      id: string;
      userId?: string;
      channels: string[];
      content: any;
      priority: string;
      metadata?: any;
    }) {
      const startTime = Date.now();
      const results = {
        successful: [] as any[],
        failed: [] as any[],
        skipped: [] as any[],
      };

      try {
        const { id, userId, channels, content, priority, metadata } = notification;

        if (!id) throw new Error("Notification ID is required");
        if (!channels || channels.length === 0) {
          throw new Error("At least one channel is required");
        }

        // Get user preferences if userId provided
        let preferences = null;
        if (userId) {
          preferences = await this.userPreferences.getPreferences(userId);
        }

        // Determine effective channels based on preferences
        const effectiveChannels = this.determineEffectiveChannels(
          channels,
          preferences
        );

        this.logger.debug("Routing notification", {
          notificationId: id,
          requestedChannels: channels,
          effectiveChannels,
        });

        // Process each channel
        for (const channel of effectiveChannels) {
          const channelResult = await this.processChannel(
            channel,
            notification,
            preferences
          );

          if (channelResult.status === "success") {
            results.successful.push(channelResult);
            
            // Update last contact time
            if (userId) {
              await this.userPreferences.updateLastContact(userId, channel);
            }
          } else if (channelResult.status === "failed") {
            results.failed.push(channelResult);
            
            // Try fallback channels
            const fallbackResults = await this.processFallbacks(
              channel,
              notification,
              preferences
            );
            
            results.successful.push(...fallbackResults.successful);
            results.failed.push(...fallbackResults.failed);
          } else if (channelResult.status === "skipped") {
            results.skipped.push(channelResult);
          }
        }

        // Update metrics
        const duration = Date.now() - startTime;
        this.metrics.histogram("channel_router.duration", duration);
        this.metrics.increment("channel_router.routed", 1, {
          channels: effectiveChannels.join(","),
          successCount: results.successful.length,
          failureCount: results.failed.length,
        });

        return {
          notificationId: id,
          results,
          summary: {
            requested: channels.length,
            attempted: effectiveChannels.length,
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length,
          },
        };
      } catch (error) {
        this.logger.error("Failed to route notification", { error, notification });
        this.metrics.increment("channel_router.errors");
        throw error;
      }
    }

    private async processChannel(
      channel: string,
      notification: any,
      preferences: any
    ) {
      const processor = this.processors.get(channel);
      if (!processor) {
        return {
          channel,
          status: "failed",
          error: `No processor registered for channel: ${channel}`,
          timestamp: new Date(),
        };
      }

      try {
        // Check rate limits
        const rateLimitKey = `${channel}:${notification.userId || notification.id}`;
        const isAllowed = await this.rateLimiter.isAllowed(
          rateLimitKey,
          this.getRateLimit(channel, notification.priority)
        );

        if (!isAllowed) {
          return {
            channel,
            status: "skipped",
            reason: "rate_limit_exceeded",
            timestamp: new Date(),
          };
        }

        // Check user preferences
        if (preferences && !this.isChannelEnabled(channel, preferences)) {
          return {
            channel,
            status: "skipped",
            reason: "disabled_by_user",
            timestamp: new Date(),
          };
        }

        // Check quiet hours
        if (preferences && this.isInQuietHours(channel, preferences)) {
          return {
            channel,
            status: "skipped",
            reason: "quiet_hours",
            timestamp: new Date(),
          };
        }

        // Validate content for channel
        const validation = await processor.validate(notification.content);
        if (!validation.valid) {
          return {
            channel,
            status: "failed",
            error: validation.error,
            timestamp: new Date(),
          };
        }

        // Process notification
        const result = await processor.process({
          ...notification,
          channel,
          preferences: preferences?.channels?.[channel],
        });

        // Update rate limiter
        await this.rateLimiter.increment(rateLimitKey);

        return {
          channel,
          status: "success",
          result,
          timestamp: new Date(),
        };
      } catch (error) {
        this.logger.error("Channel processing failed", { error, channel });
        return {
          channel,
          status: "failed",
          error: (error as Error).message,
          timestamp: new Date(),
        };
      }
    }

    private async processFallbacks(
      failedChannel: string,
      notification: any,
      preferences: any
    ) {
      const results = {
        successful: [] as any[],
        failed: [] as any[],
      };

      const fallbacks = this.fallbackChannels.get(failedChannel) || [];
      
      for (const fallbackChannel of fallbacks) {
        // Skip if already tried
        if (notification.channels.includes(fallbackChannel)) {
          continue;
        }

        const result = await this.processChannel(
          fallbackChannel,
          notification,
          preferences
        );

        if (result.status === "success") {
          results.successful.push(result);
          break; // Stop on first successful fallback
        } else {
          results.failed.push(result);
        }
      }

      return results;
    }

    private determineEffectiveChannels(
      requestedChannels: string[],
      preferences: any
    ): string[] {
      if (!preferences) {
        return requestedChannels;
      }

      // Filter based on user preferences
      const enabledChannels = requestedChannels.filter(channel =>
        this.isChannelEnabled(channel, preferences)
      );

      // Add preferred channels if not already included
      if (preferences.preferredChannels) {
        for (const preferred of preferences.preferredChannels) {
          if (!enabledChannels.includes(preferred) && this.processors.has(preferred)) {
            enabledChannels.push(preferred);
          }
        }
      }

      // Sort by priority if specified
      if (preferences.channelPriority) {
        enabledChannels.sort((a, b) => {
          const aPriority = preferences.channelPriority.indexOf(a);
          const bPriority = preferences.channelPriority.indexOf(b);
          return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
        });
      }

      return enabledChannels;
    }

    private isChannelEnabled(channel: string, preferences: any): boolean {
      if (!preferences.channels) return true;
      const channelPrefs = preferences.channels[channel];
      return channelPrefs ? channelPrefs.enabled !== false : true;
    }

    private isInQuietHours(channel: string, preferences: any): boolean {
      // Skip quiet hours for urgent notifications
      if (preferences.skipQuietHoursForUrgent) {
        return false;
      }

      const quietHours = preferences.quietHours?.[channel] || preferences.quietHours?.global;
      if (!quietHours || !quietHours.enabled) {
        return false;
      }

      const now = new Date();
      const currentHour = now.getHours();
      const { startHour, endHour } = quietHours;

      if (startHour <= endHour) {
        return currentHour >= startHour && currentHour < endHour;
      } else {
        // Quiet hours span midnight
        return currentHour >= startHour || currentHour < endHour;
      }
    }

    private getRateLimit(channel: string, priority: string): number {
      const baseLimits: Record<string, number> = {
        web: 100,
        email: 10,
        push: 50,
        sms: 5,
        webhook: 20,
      };

      const priorityMultipliers: Record<string, number> = {
        urgent: 5,
        high: 2,
        normal: 1,
        low: 0.5,
      };

      const baseLimit = baseLimits[channel] || 10;
      const multiplier = priorityMultipliers[priority] || 1;
      
      return Math.floor(baseLimit * multiplier);
    }

    getRegisteredChannels(): string[] {
      return Array.from(this.processors.keys());
    }

    getChannelCapabilities(channel: string) {
      const processor = this.processors.get(channel);
      return processor ? processor.getCapabilities() : null;
    }

    setFallbackChannels(channel: string, fallbacks: string[]) {
      this.fallbackChannels.set(channel, fallbacks);
    }
  }

  let channelRouter: ChannelRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    channelRouter = new ChannelRouter();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("route", () => {
    const validNotification = {
      id: "notif-123",
      userId: "user-123",
      channels: ["web", "email"],
      content: {
        title: "Test Notification",
        body: "This is a test",
      },
      priority: "normal",
    };

    it("should route notification to multiple channels successfully", async () => {
      mockUserPreferences.getPreferences.mockResolvedValue({
        channels: {
          web: { enabled: true },
          email: { enabled: true },
        },
      });
      
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });
      
      mockEmailProcessor.validate.mockResolvedValue({ valid: true });
      mockEmailProcessor.process.mockResolvedValue({ delivered: true });

      const result = await channelRouter.route(validNotification);

      expect(result.summary).toEqual({
        requested: 2,
        attempted: 2,
        successful: 2,
        failed: 0,
        skipped: 0,
      });

      expect(mockWebProcessor.process).toHaveBeenCalled();
      expect(mockEmailProcessor.process).toHaveBeenCalled();
      expect(mockUserPreferences.updateLastContact).toHaveBeenCalledTimes(2);
    });

    it("should skip disabled channels", async () => {
      mockUserPreferences.getPreferences.mockResolvedValue({
        channels: {
          web: { enabled: true },
          email: { enabled: false },
        },
      });
      
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      const result = await channelRouter.route(validNotification);

      expect(result.summary.successful).toBe(1);
      expect(result.summary.skipped).toBe(1);
      expect(result.results.skipped[0].reason).toBe("disabled_by_user");
      expect(mockEmailProcessor.process).not.toHaveBeenCalled();
    });

    it("should respect rate limits", async () => {
      mockUserPreferences.getPreferences.mockResolvedValue({});
      mockRateLimiter.isAllowed
        .mockResolvedValueOnce(true)  // web allowed
        .mockResolvedValueOnce(false); // email rate limited

      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      const result = await channelRouter.route(validNotification);

      expect(result.summary.successful).toBe(1);
      expect(result.summary.skipped).toBe(1);
      expect(result.results.skipped[0].reason).toBe("rate_limit_exceeded");
    });

    it("should handle quiet hours", async () => {
      const now = new Date();
      const currentHour = now.getHours();
      
      mockUserPreferences.getPreferences.mockResolvedValue({
        quietHours: {
          email: {
            enabled: true,
            startHour: currentHour,
            endHour: (currentHour + 1) % 24,
          },
        },
      });
      
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      const result = await channelRouter.route(validNotification);

      expect(result.summary.successful).toBe(1);
      expect(result.summary.skipped).toBe(1);
      expect(result.results.skipped[0].reason).toBe("quiet_hours");
    });

    it("should process fallback channels on failure", async () => {
      mockUserPreferences.getPreferences.mockResolvedValue({});
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      // Push fails, should fallback to web
      mockPushProcessor.validate.mockResolvedValue({ valid: true });
      mockPushProcessor.process.mockRejectedValue(new Error("Device not found"));
      
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      const notification = {
        ...validNotification,
        channels: ["push"],
      };

      const result = await channelRouter.route(notification);

      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.results.successful[0].channel).toBe("web"); // Fallback channel
    });

    it("should throw error for missing notification ID", async () => {
      const invalidNotification = { ...validNotification, id: "" };

      await expect(channelRouter.route(invalidNotification)).rejects.toThrow(
        "Notification ID is required"
      );
    });

    it("should throw error for empty channels", async () => {
      const invalidNotification = { ...validNotification, channels: [] };

      await expect(channelRouter.route(invalidNotification)).rejects.toThrow(
        "At least one channel is required"
      );
    });
  });

  describe("channel preferences", () => {
    it("should add preferred channels", async () => {
      const notification = {
        id: "notif-123",
        userId: "user-123",
        channels: ["email"],
        content: { message: "Test" },
        priority: "normal",
      };

      mockUserPreferences.getPreferences.mockResolvedValue({
        preferredChannels: ["push", "web"],
        channels: {
          email: { enabled: true },
          push: { enabled: true },
          web: { enabled: true },
        },
      });
      
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      mockEmailProcessor.validate.mockResolvedValue({ valid: true });
      mockEmailProcessor.process.mockResolvedValue({ delivered: true });
      
      mockPushProcessor.validate.mockResolvedValue({ valid: true });
      mockPushProcessor.process.mockResolvedValue({ delivered: true });
      
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      const result = await channelRouter.route(notification);

      expect(result.summary.attempted).toBe(3); // email + push + web
      expect(mockPushProcessor.process).toHaveBeenCalled();
      expect(mockWebProcessor.process).toHaveBeenCalled();
    });

    it("should respect channel priority order", async () => {
      const notification = {
        id: "notif-123",
        userId: "user-123",
        channels: ["email", "push", "web"],
        content: { message: "Test" },
        priority: "normal",
      };

      mockUserPreferences.getPreferences.mockResolvedValue({
        channelPriority: ["push", "web", "email"],
      });
      
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      const processOrder: string[] = [];
      
      mockPushProcessor.validate.mockResolvedValue({ valid: true });
      mockPushProcessor.process.mockImplementation(() => {
        processOrder.push("push");
        return Promise.resolve({ delivered: true });
      });
      
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockImplementation(() => {
        processOrder.push("web");
        return Promise.resolve({ delivered: true });
      });
      
      mockEmailProcessor.validate.mockResolvedValue({ valid: true });
      mockEmailProcessor.process.mockImplementation(() => {
        processOrder.push("email");
        return Promise.resolve({ delivered: true });
      });

      await channelRouter.route(notification);

      expect(processOrder).toEqual(["push", "web", "email"]);
    });
  });

  describe("channel capabilities", () => {
    it("should return channel capabilities", () => {
      const webCapabilities = channelRouter.getChannelCapabilities("web");
      expect(webCapabilities).toEqual({
        supportsRichContent: true,
        supportsInteractivity: true,
        maxMessageLength: 1000,
      });

      const smsCapabilities = channelRouter.getChannelCapabilities("sms");
      expect(smsCapabilities).toEqual({
        supportsRichContent: false,
        maxMessageLength: 160,
        requiresPhoneNumber: true,
      });
    });

    it("should return null for unknown channel", () => {
      const capabilities = channelRouter.getChannelCapabilities("unknown");
      expect(capabilities).toBeNull();
    });
  });

  describe("processor registration", () => {
    it("should register new processor", () => {
      const customProcessor = {
        process: jest.fn(),
        validate: jest.fn(),
        getCapabilities: jest.fn(() => ({ custom: true })),
      };

      channelRouter.registerProcessor("custom", customProcessor);

      const channels = channelRouter.getRegisteredChannels();
      expect(channels).toContain("custom");
      
      const capabilities = channelRouter.getChannelCapabilities("custom");
      expect(capabilities).toEqual({ custom: true });
    });

    it("should throw error for missing channel", () => {
      expect(() => {
        channelRouter.registerProcessor("", mockWebProcessor);
      }).toThrow("Channel is required");
    });

    it("should throw error for missing processor", () => {
      expect(() => {
        channelRouter.registerProcessor("custom", null);
      }).toThrow("Processor is required");
    });
  });

  describe("fallback configuration", () => {
    it("should update fallback channels", async () => {
      channelRouter.setFallbackChannels("custom", ["email", "sms"]);
      
      // Register custom processor that always fails
      const customProcessor = {
        process: jest.fn().mockRejectedValue(new Error("Custom error")),
        validate: jest.fn().mockResolvedValue({ valid: true }),
        getCapabilities: jest.fn(() => ({})),
      };
      
      channelRouter.registerProcessor("custom", customProcessor);
      
      mockUserPreferences.getPreferences.mockResolvedValue({});
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      mockEmailProcessor.validate.mockResolvedValue({ valid: true });
      mockEmailProcessor.process.mockResolvedValue({ delivered: true });

      const notification = {
        id: "notif-123",
        channels: ["custom"],
        content: { message: "Test" },
        priority: "normal",
      };

      const result = await channelRouter.route(notification);

      expect(result.summary.successful).toBe(1);
      expect(result.results.successful[0].channel).toBe("email");
    });
  });

  describe("rate limiting", () => {
    it("should apply different rate limits based on priority", async () => {
      const urgentNotification = {
        ...validNotification,
        priority: "urgent",
      };

      mockUserPreferences.getPreferences.mockResolvedValue({});
      mockRateLimiter.isAllowed.mockResolvedValue(true);
      
      mockWebProcessor.validate.mockResolvedValue({ valid: true });
      mockWebProcessor.process.mockResolvedValue({ delivered: true });

      await channelRouter.route(urgentNotification);

      // Check that higher rate limit was used for urgent priority
      expect(mockRateLimiter.isAllowed).toHaveBeenCalledWith(
        expect.any(String),
        500 // 100 (base) * 5 (urgent multiplier)
      );
    });
  });
});