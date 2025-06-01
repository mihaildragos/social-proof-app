import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventEmitter } from "events";
import { Request, Response } from "express";

describe("SSE Routes", () => {
  // Mock Response that simulates SSE
  class MockSSEResponse extends EventEmitter {
    statusCode = 200;
    headers: Record<string, string> = {};
    data: string[] = [];
    ended = false;

    status(code: number) {
      this.statusCode = code;
      return this;
    }

    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }

    write(data: string) {
      this.data.push(data);
      return true;
    }

    end() {
      this.ended = true;
      this.emit("close");
    }

    json(data: any) {
      this.data.push(JSON.stringify(data));
      return this;
    }
  }

  // Mock dependencies
  const mockAuthMiddleware = jest.fn((req: any, res: any, next: any) => {
    req.user = {
      id: "user-123",
      organizationId: "org-123",
      siteId: "site-123",
      role: "admin",
    };
    next();
  });

  const mockRateLimiter = jest.fn((req: any, res: any, next: any) => next());

  const mockMetrics = {
    increment: jest.fn(),
    decrement: jest.fn(),
    gauge: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockNotificationService = {
    getRecentNotifications: jest.fn(),
    subscribeToNotifications: jest.fn(),
  };

  // SSE Manager implementation
  class SSEManager {
    private connections = new Map<string, Set<Response>>();
    private connectionMetadata = new Map<Response, any>();

    constructor(
      private metrics = mockMetrics,
      private logger = mockLogger
    ) {}

    addConnection(channel: string, res: Response, metadata: any = {}) {
      if (!this.connections.has(channel)) {
        this.connections.set(channel, new Set());
      }

      this.connections.get(channel)!.add(res);
      this.connectionMetadata.set(res, { channel, ...metadata });

      this.metrics.increment("sse.connections.active");
      this.metrics.gauge("sse.connections.total", this.getTotalConnections());

      // Handle client disconnect
      res.on("close", () => {
        this.removeConnection(channel, res);
      });
    }

    removeConnection(channel: string, res: Response) {
      const connections = this.connections.get(channel);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          this.connections.delete(channel);
        }
      }

      this.connectionMetadata.delete(res);
      this.metrics.decrement("sse.connections.active");
      this.metrics.gauge("sse.connections.total", this.getTotalConnections());
    }

    sendToChannel(channel: string, data: any) {
      const connections = this.connections.get(channel);
      if (!connections || connections.size === 0) {
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      const message = this.formatSSEMessage(data);

      for (const res of connections) {
        try {
          res.write(message);
          sent++;
        } catch (error) {
          failed++;
          this.logger.error("Failed to send SSE message", { channel, error });
          this.removeConnection(channel, res);
        }
      }

      return { sent, failed };
    }

    broadcast(data: any) {
      let totalSent = 0;
      let totalFailed = 0;

      for (const [channel, connections] of this.connections) {
        const { sent, failed } = this.sendToChannel(channel, data);
        totalSent += sent;
        totalFailed += failed;
      }

      return { sent: totalSent, failed: totalFailed };
    }

    getConnectionStats() {
      const stats = {
        totalConnections: this.getTotalConnections(),
        byChannel: new Map<string, number>(),
      };

      for (const [channel, connections] of this.connections) {
        stats.byChannel.set(channel, connections.size);
      }

      return stats;
    }

    private formatSSEMessage(data: any): string {
      const lines = [
        `id: ${Date.now()}`,
        `event: notification`,
        `data: ${JSON.stringify(data)}`,
        "", // Empty line to signal end of message
      ];
      return lines.join("\n") + "\n";
    }

    private getTotalConnections(): number {
      let total = 0;
      for (const connections of this.connections.values()) {
        total += connections.size;
      }
      return total;
    }
  }

  // SSE Route Handler
  class SSERouteHandler {
    constructor(
      private sseManager: SSEManager,
      private notificationService = mockNotificationService,
      private logger = mockLogger
    ) {}

    async handleSSEConnection(req: Request, res: Response) {
      try {
        // Validate user and site access
        const { user } = req as any;
        const { siteId } = req.params;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (siteId && !this.hasAccessToSite(user, siteId)) {
          return res.status(403).json({ error: "Access denied to site" });
        }

        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

        // Send initial connection event
        res.write(":ok\n\n");

        // Determine channel
        const channel = siteId ? `site:${siteId}` : `user:${user.id}`;

        // Add connection to manager
        this.sseManager.addConnection(channel, res, {
          userId: user.id,
          siteId: siteId || user.siteId,
          connectedAt: new Date(),
        });

        // Send recent notifications
        const recentNotifications = await this.notificationService.getRecentNotifications({
          siteId: siteId || user.siteId,
          limit: 10,
        });

        for (const notification of recentNotifications) {
          const message = this.formatSSEMessage({
            type: "history",
            data: notification,
          });
          res.write(message);
        }

        // Set up keep-alive ping
        const pingInterval = setInterval(() => {
          try {
            res.write(":ping\n\n");
          } catch (error) {
            clearInterval(pingInterval);
          }
        }, 30000);

        // Clean up on disconnect
        res.on("close", () => {
          clearInterval(pingInterval);
          this.logger.info("SSE connection closed", {
            userId: user.id,
            channel,
          });
        });

        // Subscribe to real-time notifications
        const unsubscribe = this.notificationService.subscribeToNotifications(
          channel,
          (notification: any) => {
            try {
              const message = this.formatSSEMessage({
                type: "realtime",
                data: notification,
              });
              res.write(message);
            } catch (error) {
              this.logger.error("Error sending realtime notification", { error });
            }
          }
        );

        res.on("close", () => {
          unsubscribe();
        });

      } catch (error) {
        this.logger.error("Error handling SSE connection", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    }

    async sendNotification(req: Request, res: Response) {
      try {
        const { user } = req as any;
        const { channel } = req.params;
        const { data } = req.body;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!this.canSendToChannel(user, channel)) {
          return res.status(403).json({ error: "Access denied to channel" });
        }

        const result = this.sseManager.sendToChannel(channel, data);

        res.json({
          success: true,
          ...result,
        });

      } catch (error) {
        this.logger.error("Error sending notification", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    }

    async broadcastNotification(req: Request, res: Response) {
      try {
        const { user } = req as any;
        const { data } = req.body;

        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Admin access required" });
        }

        const result = this.sseManager.broadcast(data);

        res.json({
          success: true,
          ...result,
        });

      } catch (error) {
        this.logger.error("Error broadcasting notification", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    }

    async getStats(req: Request, res: Response) {
      try {
        const { user } = req as any;

        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const stats = this.sseManager.getConnectionStats();

        res.json({
          success: true,
          stats: {
            totalConnections: stats.totalConnections,
            channels: Object.fromEntries(stats.byChannel),
          },
        });

      } catch (error) {
        this.logger.error("Error getting stats", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    }

    private hasAccessToSite(user: any, siteId: string): boolean {
      return user.siteId === siteId || user.role === "admin";
    }

    private canSendToChannel(user: any, channel: string): boolean {
      if (user.role === "admin") return true;
      if (channel.startsWith(`site:${user.siteId}`)) return true;
      if (channel.startsWith(`user:${user.id}`)) return true;
      return false;
    }

    private formatSSEMessage(data: any): string {
      const lines = [
        `id: ${Date.now()}`,
        `event: ${data.type || "message"}`,
        `data: ${JSON.stringify(data.data || data)}`,
        "",
      ];
      return lines.join("\n") + "\n";
    }
  }

  let sseManager: SSEManager;
  let routeHandler: SSERouteHandler;
  let mockReq: any;
  let mockRes: MockSSEResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    sseManager = new SSEManager();
    routeHandler = new SSERouteHandler(sseManager);
    
    mockReq = {
      params: {},
      body: {},
      user: {
        id: "user-123",
        organizationId: "org-123",
        siteId: "site-123",
        role: "admin",
      },
    };
    
    mockRes = new MockSSEResponse();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("handleSSEConnection", () => {
    it("should establish SSE connection successfully", async () => {
      mockNotificationService.getRecentNotifications.mockResolvedValue([
        { id: "notif-1", message: "Test notification 1" },
        { id: "notif-2", message: "Test notification 2" },
      ]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      expect(mockRes.headers["Content-Type"]).toBe("text/event-stream");
      expect(mockRes.headers["Cache-Control"]).toBe("no-cache");
      expect(mockRes.headers["Connection"]).toBe("keep-alive");
      expect(mockRes.data[0]).toBe(":ok\n\n");
      
      // Check recent notifications were sent
      expect(mockNotificationService.getRecentNotifications).toHaveBeenCalledWith({
        siteId: "site-123",
        limit: 10,
      });
      expect(mockRes.data.length).toBeGreaterThan(1);
    });

    it("should establish SSE connection for specific site", async () => {
      mockReq.params.siteId = "site-456";
      mockReq.user.siteId = "site-456"; // User has access
      
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      expect(mockNotificationService.getRecentNotifications).toHaveBeenCalledWith({
        siteId: "site-456",
        limit: 10,
      });
      
      const stats = sseManager.getConnectionStats();
      expect(stats.byChannel.has("site:site-456")).toBe(true);
    });

    it("should reject connection without authentication", async () => {
      mockReq.user = null;

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Authentication required" }));
    });

    it("should reject connection to unauthorized site", async () => {
      mockReq.params.siteId = "site-999";
      mockReq.user.role = "user"; // Not admin

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Access denied to site" }));
    });

    it("should handle real-time notifications", async () => {
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      
      let notificationCallback: any;
      mockNotificationService.subscribeToNotifications.mockImplementation((channel, callback) => {
        notificationCallback = callback;
        return () => {};
      });

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      // Simulate incoming notification
      const notification = { id: "notif-3", message: "Real-time notification" };
      notificationCallback(notification);

      const lastMessage = mockRes.data[mockRes.data.length - 1];
      expect(lastMessage).toContain("event: realtime");
      expect(lastMessage).toContain(JSON.stringify(notification));
    });

    it("should send ping messages", async () => {
      jest.useFakeTimers();
      
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      // Fast forward 31 seconds
      jest.advanceTimersByTime(31000);

      const hasPing = mockRes.data.some(d => d.includes(":ping"));
      expect(hasPing).toBe(true);

      jest.useRealTimers();
    });
  });

  describe("sendNotification", () => {
    it("should send notification to channel", async () => {
      // First establish a connection
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});
      
      const connectionRes = new MockSSEResponse();
      await routeHandler.handleSSEConnection(mockReq, connectionRes as any);

      // Send notification
      mockReq.params.channel = "site:site-123";
      mockReq.body.data = { message: "Test notification" };

      const sendRes = new MockSSEResponse();
      await routeHandler.sendNotification(mockReq, sendRes as any);

      expect(sendRes.data).toContain(JSON.stringify({
        success: true,
        sent: 1,
        failed: 0,
      }));
    });

    it("should reject sending to unauthorized channel", async () => {
      mockReq.user.role = "user";
      mockReq.params.channel = "site:other-site";
      mockReq.body.data = { message: "Test notification" };

      await routeHandler.sendNotification(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Access denied to channel" }));
    });

    it("should allow admin to send to any channel", async () => {
      mockReq.user.role = "admin";
      mockReq.params.channel = "site:any-site";
      mockReq.body.data = { message: "Admin notification" };

      await routeHandler.sendNotification(mockReq, mockRes as any);

      expect(mockRes.data).toContain(JSON.stringify({
        success: true,
        sent: 0, // No connections to this channel
        failed: 0,
      }));
    });
  });

  describe("broadcastNotification", () => {
    it("should broadcast to all connections (admin only)", async () => {
      // Establish multiple connections
      const connections = [
        { params: { siteId: "site-123" }, user: { ...mockReq.user, id: "user-1" } },
        { params: { siteId: "site-456" }, user: { ...mockReq.user, id: "user-2", siteId: "site-456" } },
      ];

      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      for (const conn of connections) {
        const res = new MockSSEResponse();
        await routeHandler.handleSSEConnection(conn as any, res as any);
      }

      // Broadcast
      mockReq.body.data = { message: "Broadcast message" };
      const broadcastRes = new MockSSEResponse();
      
      await routeHandler.broadcastNotification(mockReq, broadcastRes as any);

      expect(broadcastRes.data).toContain(JSON.stringify({
        success: true,
        sent: 2,
        failed: 0,
      }));
    });

    it("should reject broadcast from non-admin", async () => {
      mockReq.user.role = "user";
      mockReq.body.data = { message: "Broadcast message" };

      await routeHandler.broadcastNotification(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Admin access required" }));
    });
  });

  describe("getStats", () => {
    it("should return connection statistics", async () => {
      // Establish some connections
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      const res1 = new MockSSEResponse();
      await routeHandler.handleSSEConnection(mockReq, res1 as any);

      const res2 = new MockSSEResponse();
      mockReq.params.siteId = "site-456";
      mockReq.user.siteId = "site-456";
      await routeHandler.handleSSEConnection(mockReq, res2 as any);

      // Get stats
      const statsRes = new MockSSEResponse();
      await routeHandler.getStats(mockReq, statsRes as any);

      const statsData = JSON.parse(statsRes.data[0]);
      expect(statsData.success).toBe(true);
      expect(statsData.stats.totalConnections).toBe(2);
      expect(statsData.stats.channels).toHaveProperty("site:site-123");
      expect(statsData.stats.channels).toHaveProperty("site:site-456");
    });

    it("should require authentication for stats", async () => {
      mockReq.user = null;

      await routeHandler.getStats(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Authentication required" }));
    });
  });

  describe("connection management", () => {
    it("should clean up connection on client disconnect", async () => {
      mockNotificationService.getRecentNotifications.mockResolvedValue([]);
      mockNotificationService.subscribeToNotifications.mockReturnValue(() => {});

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      let stats = sseManager.getConnectionStats();
      expect(stats.totalConnections).toBe(1);

      // Simulate client disconnect
      mockRes.emit("close");

      stats = sseManager.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(mockMetrics.decrement).toHaveBeenCalledWith("sse.connections.active");
    });

    it("should handle connection errors gracefully", async () => {
      mockNotificationService.getRecentNotifications.mockRejectedValue(new Error("DB error"));

      await routeHandler.handleSSEConnection(mockReq, mockRes as any);

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.data).toContain(JSON.stringify({ error: "Internal server error" }));
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error handling SSE connection",
        expect.any(Object)
      );
    });
  });
});