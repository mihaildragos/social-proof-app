import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventEmitter } from "events";

describe("NotificationWebSocketServer", () => {
  // Mock WebSocket
  class MockWebSocket extends EventEmitter {
    readyState = 1; // OPEN
    send = jest.fn();
    close = jest.fn();
    ping = jest.fn();
    terminate = jest.fn();
  }

  // Mock dependencies
  const mockAuthService = {
    verifyToken: jest.fn(),
    extractUser: jest.fn(),
  };

  const mockRateLimiter = {
    isAllowed: jest.fn(),
    increment: jest.fn(),
  };

  const mockMetrics = {
    increment: jest.fn(),
    decrement: jest.fn(),
    gauge: jest.fn(),
    histogram: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  // NotificationWebSocketServer implementation
  class NotificationWebSocketServer {
    private connections = new Map<string, any>();
    private subscriptions = new Map<string, Set<string>>();
    private heartbeatInterval: NodeJS.Timeout | null = null;

    constructor(
      private authService = mockAuthService,
      private rateLimiter = mockRateLimiter,
      private metrics = mockMetrics,
      private logger = mockLogger
    ) {}

    async handleConnection(ws: MockWebSocket, request: any) {
      const connectionId = this.generateConnectionId();
      
      try {
        // Extract auth token
        const token = this.extractToken(request);
        if (!token) {
          ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
          ws.close(1008, "Authentication required");
          return;
        }

        // Verify authentication
        const user = await this.authService.verifyToken(token);
        if (!user) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid authentication" }));
          ws.close(1008, "Invalid authentication");
          return;
        }

        // Check rate limit
        const isAllowed = await this.rateLimiter.isAllowed(`ws:${user.id}`, 100);
        if (!isAllowed) {
          ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
          ws.close(1008, "Rate limit exceeded");
          return;
        }

        // Store connection
        const connection = {
          id: connectionId,
          ws,
          userId: user.id,
          siteId: user.siteId,
          organizationId: user.organizationId,
          connectedAt: new Date(),
          lastActivity: new Date(),
          isAlive: true,
          subscriptions: new Set<string>(),
        };

        this.connections.set(connectionId, connection);

        // Update metrics
        this.metrics.increment("websocket.connections.active");
        this.metrics.gauge("websocket.connections.total", this.connections.size);

        // Send welcome message
        ws.send(JSON.stringify({
          type: "connection",
          connectionId,
          message: "Connected successfully",
        }));

        // Set up event handlers
        this.setupEventHandlers(ws, connection);

        // Log connection
        this.logger.info("WebSocket connection established", {
          connectionId,
          userId: user.id,
          siteId: user.siteId,
        });

      } catch (error) {
        this.logger.error("Error handling WebSocket connection", { error });
        ws.send(JSON.stringify({ type: "error", message: "Connection failed" }));
        ws.close(1011, "Connection failed");
      }
    }

    private setupEventHandlers(ws: MockWebSocket, connection: any) {
      // Handle messages
      ws.on("message", async (data: string) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(connection, message);
        } catch (error) {
          this.logger.error("Error handling message", { error, connectionId: connection.id });
          ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      });

      // Handle pong (heartbeat response)
      ws.on("pong", () => {
        connection.isAlive = true;
        connection.lastActivity = new Date();
      });

      // Handle close
      ws.on("close", () => {
        this.handleDisconnection(connection.id);
      });

      // Handle errors
      ws.on("error", (error) => {
        this.logger.error("WebSocket error", { error, connectionId: connection.id });
        this.handleDisconnection(connection.id);
      });
    }

    private async handleMessage(connection: any, message: any) {
      connection.lastActivity = new Date();

      switch (message.type) {
        case "subscribe":
          await this.handleSubscribe(connection, message);
          break;
        case "unsubscribe":
          await this.handleUnsubscribe(connection, message);
          break;
        case "ping":
          connection.ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        default:
          connection.ws.send(JSON.stringify({ 
            type: "error", 
            message: `Unknown message type: ${message.type}` 
          }));
      }
    }

    private async handleSubscribe(connection: any, message: any) {
      const { channel, filters } = message;

      if (!channel) {
        connection.ws.send(JSON.stringify({ 
          type: "error", 
          message: "Channel is required for subscription" 
        }));
        return;
      }

      // Validate channel access
      if (!this.canAccessChannel(connection, channel)) {
        connection.ws.send(JSON.stringify({ 
          type: "error", 
          message: "Access denied to channel" 
        }));
        return;
      }

      // Add subscription
      connection.subscriptions.add(channel);
      
      // Add to global subscriptions
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(connection.id);

      // Send confirmation
      connection.ws.send(JSON.stringify({
        type: "subscribed",
        channel,
        filters,
      }));

      this.logger.debug("Client subscribed to channel", {
        connectionId: connection.id,
        channel,
      });
    }

    private async handleUnsubscribe(connection: any, message: any) {
      const { channel } = message;

      if (!channel) {
        connection.ws.send(JSON.stringify({ 
          type: "error", 
          message: "Channel is required for unsubscription" 
        }));
        return;
      }

      // Remove subscription
      connection.subscriptions.delete(channel);
      
      // Remove from global subscriptions
      const channelSubs = this.subscriptions.get(channel);
      if (channelSubs) {
        channelSubs.delete(connection.id);
        if (channelSubs.size === 0) {
          this.subscriptions.delete(channel);
        }
      }

      // Send confirmation
      connection.ws.send(JSON.stringify({
        type: "unsubscribed",
        channel,
      }));

      this.logger.debug("Client unsubscribed from channel", {
        connectionId: connection.id,
        channel,
      });
    }

    async broadcast(channel: string, data: any) {
      const subscribers = this.subscriptions.get(channel);
      if (!subscribers || subscribers.size === 0) {
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const connectionId of subscribers) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.ws.readyState !== 1) {
          failed++;
          continue;
        }

        try {
          connection.ws.send(JSON.stringify({
            type: "notification",
            channel,
            data,
            timestamp: new Date().toISOString(),
          }));
          sent++;
        } catch (error) {
          failed++;
          this.logger.error("Failed to send to connection", { connectionId, error });
        }
      }

      this.metrics.increment("websocket.messages.sent", sent);
      this.metrics.increment("websocket.messages.failed", failed);

      return { sent, failed };
    }

    async sendToUser(userId: string, data: any) {
      let sent = 0;
      let failed = 0;

      for (const [connectionId, connection] of this.connections) {
        if (connection.userId !== userId) continue;

        try {
          connection.ws.send(JSON.stringify({
            type: "notification",
            data,
            timestamp: new Date().toISOString(),
          }));
          sent++;
        } catch (error) {
          failed++;
          this.logger.error("Failed to send to user", { userId, connectionId, error });
        }
      }

      return { sent, failed };
    }

    async sendToSite(siteId: string, data: any) {
      let sent = 0;
      let failed = 0;

      for (const [connectionId, connection] of this.connections) {
        if (connection.siteId !== siteId) continue;

        try {
          connection.ws.send(JSON.stringify({
            type: "notification",
            data,
            timestamp: new Date().toISOString(),
          }));
          sent++;
        } catch (error) {
          failed++;
          this.logger.error("Failed to send to site", { siteId, connectionId, error });
        }
      }

      return { sent, failed };
    }

    startHeartbeat(interval = 30000) {
      this.heartbeatInterval = setInterval(() => {
        for (const [connectionId, connection] of this.connections) {
          if (!connection.isAlive) {
            this.handleDisconnection(connectionId);
            continue;
          }

          connection.isAlive = false;
          connection.ws.ping();
        }
      }, interval);
    }

    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    }

    private handleDisconnection(connectionId: string) {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // Remove from all subscriptions
      for (const channel of connection.subscriptions) {
        const channelSubs = this.subscriptions.get(channel);
        if (channelSubs) {
          channelSubs.delete(connectionId);
          if (channelSubs.size === 0) {
            this.subscriptions.delete(channel);
          }
        }
      }

      // Close WebSocket
      if (connection.ws.readyState === 1) {
        connection.ws.close();
      }

      // Remove connection
      this.connections.delete(connectionId);

      // Update metrics
      this.metrics.decrement("websocket.connections.active");
      this.metrics.gauge("websocket.connections.total", this.connections.size);

      this.logger.info("WebSocket connection closed", {
        connectionId,
        userId: connection.userId,
        duration: Date.now() - connection.connectedAt.getTime(),
      });
    }

    getConnectionStats() {
      const stats = {
        total: this.connections.size,
        byUser: new Map<string, number>(),
        bySite: new Map<string, number>(),
        byChannel: new Map<string, number>(),
      };

      for (const connection of this.connections.values()) {
        // By user
        const userCount = stats.byUser.get(connection.userId) || 0;
        stats.byUser.set(connection.userId, userCount + 1);

        // By site
        const siteCount = stats.bySite.get(connection.siteId) || 0;
        stats.bySite.set(connection.siteId, siteCount + 1);
      }

      // By channel
      for (const [channel, subscribers] of this.subscriptions) {
        stats.byChannel.set(channel, subscribers.size);
      }

      return stats;
    }

    closeAllConnections() {
      for (const [connectionId, connection] of this.connections) {
        connection.ws.close(1001, "Server shutting down");
      }
      this.connections.clear();
      this.subscriptions.clear();
    }

    private extractToken(request: any): string | null {
      // Check Authorization header
      const authHeader = request.headers?.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
      }

      // Check query parameter
      if (request.query?.token) {
        return request.query.token;
      }

      return null;
    }

    private canAccessChannel(connection: any, channel: string): boolean {
      // Site-specific channels
      if (channel.startsWith(`site:${connection.siteId}:`)) {
        return true;
      }

      // User-specific channels
      if (channel.startsWith(`user:${connection.userId}:`)) {
        return true;
      }

      // Organization-specific channels
      if (channel.startsWith(`org:${connection.organizationId}:`)) {
        return true;
      }

      // Public channels
      if (channel.startsWith("public:")) {
        return true;
      }

      return false;
    }

    private generateConnectionId(): string {
      return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  let wsServer: NotificationWebSocketServer;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    wsServer = new NotificationWebSocketServer();
    mockWs = new MockWebSocket();
  });

  afterEach(() => {
    wsServer.stopHeartbeat();
    wsServer.closeAllConnections();
  });

  describe("handleConnection", () => {
    it("should accept valid connection with authentication", async () => {
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "connection",
          connectionId: expect.any(String),
          message: "Connected successfully",
        })
      );
      expect(mockMetrics.increment).toHaveBeenCalledWith("websocket.connections.active");
    });

    it("should reject connection without authentication", async () => {
      const mockRequest = { headers: {} };

      await wsServer.handleConnection(mockWs, mockRequest);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", message: "Authentication required" })
      );
      expect(mockWs.close).toHaveBeenCalledWith(1008, "Authentication required");
    });

    it("should reject connection with invalid token", async () => {
      const mockRequest = {
        headers: { authorization: "Bearer invalid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue(null);

      await wsServer.handleConnection(mockWs, mockRequest);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", message: "Invalid authentication" })
      );
      expect(mockWs.close).toHaveBeenCalledWith(1008, "Invalid authentication");
    });

    it("should reject connection when rate limit exceeded", async () => {
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(false);

      await wsServer.handleConnection(mockWs, mockRequest);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", message: "Rate limit exceeded" })
      );
      expect(mockWs.close).toHaveBeenCalledWith(1008, "Rate limit exceeded");
    });
  });

  describe("message handling", () => {
    beforeEach(async () => {
      // Set up authenticated connection
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);
      jest.clearAllMocks();
    });

    it("should handle subscribe message", async () => {
      const subscribeMessage = {
        type: "subscribe",
        channel: "site:site-123:notifications",
        filters: { type: "purchase" },
      };

      mockWs.emit("message", JSON.stringify(subscribeMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "subscribed",
          channel: "site:site-123:notifications",
          filters: { type: "purchase" },
        })
      );
    });

    it("should handle unsubscribe message", async () => {
      // First subscribe
      const subscribeMessage = {
        type: "subscribe",
        channel: "site:site-123:notifications",
      };
      mockWs.emit("message", JSON.stringify(subscribeMessage));
      await new Promise(resolve => setTimeout(resolve, 10));

      jest.clearAllMocks();

      // Then unsubscribe
      const unsubscribeMessage = {
        type: "unsubscribe",
        channel: "site:site-123:notifications",
      };
      mockWs.emit("message", JSON.stringify(unsubscribeMessage));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "unsubscribed",
          channel: "site:site-123:notifications",
        })
      );
    });

    it("should handle ping message", async () => {
      const pingMessage = { type: "ping" };

      mockWs.emit("message", JSON.stringify(pingMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "pong", timestamp: expect.any(Number) })
      );
    });

    it("should reject invalid message format", async () => {
      mockWs.emit("message", "invalid json");

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", message: "Invalid message format" })
      );
    });

    it("should reject subscription to unauthorized channel", async () => {
      const subscribeMessage = {
        type: "subscribe",
        channel: "site:other-site:notifications",
      };

      mockWs.emit("message", JSON.stringify(subscribeMessage));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", message: "Access denied to channel" })
      );
    });
  });

  describe("broadcast", () => {
    beforeEach(async () => {
      // Set up multiple authenticated connections
      const users = [
        { id: "user-1", siteId: "site-123", organizationId: "org-123" },
        { id: "user-2", siteId: "site-123", organizationId: "org-123" },
        { id: "user-3", siteId: "site-456", organizationId: "org-456" },
      ];

      for (const user of users) {
        const ws = new MockWebSocket();
        mockAuthService.verifyToken.mockResolvedValue(user);
        mockRateLimiter.isAllowed.mockResolvedValue(true);

        await wsServer.handleConnection(ws, {
          headers: { authorization: `Bearer token-${user.id}` },
        });

        // Subscribe to channel
        ws.emit("message", JSON.stringify({
          type: "subscribe",
          channel: `site:${user.siteId}:notifications`,
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      jest.clearAllMocks();
    });

    it("should broadcast to all subscribers of a channel", async () => {
      const notificationData = {
        type: "purchase",
        message: "New purchase",
        amount: 99.99,
      };

      const result = await wsServer.broadcast("site:site-123:notifications", notificationData);

      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(mockMetrics.increment).toHaveBeenCalledWith("websocket.messages.sent", 2);
    });

    it("should handle broadcast to channel with no subscribers", async () => {
      const result = await wsServer.broadcast("site:non-existent:notifications", {});

      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });

  describe("sendToUser", () => {
    beforeEach(async () => {
      // Set up connections for specific user
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);
      jest.clearAllMocks();
    });

    it("should send notification to specific user", async () => {
      const notificationData = {
        type: "account_update",
        message: "Your account has been updated",
      };

      const result = await wsServer.sendToUser("user-123", notificationData);

      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "notification",
          data: notificationData,
          timestamp: expect.any(String),
        })
      );
    });

    it("should handle send to non-existent user", async () => {
      const result = await wsServer.sendToUser("non-existent-user", {});

      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });

  describe("sendToSite", () => {
    beforeEach(async () => {
      // Set up connections for specific site
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);
      jest.clearAllMocks();
    });

    it("should send notification to all connections of a site", async () => {
      const notificationData = {
        type: "site_announcement",
        message: "Site maintenance scheduled",
      };

      const result = await wsServer.sendToSite("site-123", notificationData);

      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "notification",
          data: notificationData,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe("heartbeat", () => {
    it("should send ping to all connections", async () => {
      // Set up connection
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);

      // Start heartbeat with short interval for testing
      wsServer.startHeartbeat(100);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWs.ping).toHaveBeenCalled();

      wsServer.stopHeartbeat();
    });

    it("should disconnect inactive connections", async () => {
      // Set up connection
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);

      const stats = wsServer.getConnectionStats();
      expect(stats.total).toBe(1);

      // Simulate inactive connection (no pong response)
      wsServer.startHeartbeat(100);

      await new Promise(resolve => setTimeout(resolve, 250));

      const newStats = wsServer.getConnectionStats();
      expect(newStats.total).toBe(0);

      wsServer.stopHeartbeat();
    });
  });

  describe("getConnectionStats", () => {
    it("should return detailed connection statistics", async () => {
      // Set up multiple connections
      const users = [
        { id: "user-1", siteId: "site-123", organizationId: "org-123" },
        { id: "user-1", siteId: "site-123", organizationId: "org-123" }, // Same user, different connection
        { id: "user-2", siteId: "site-456", organizationId: "org-456" },
      ];

      for (const user of users) {
        const ws = new MockWebSocket();
        mockAuthService.verifyToken.mockResolvedValue(user);
        mockRateLimiter.isAllowed.mockResolvedValue(true);

        await wsServer.handleConnection(ws, {
          headers: { authorization: `Bearer token-${user.id}` },
        });
      }

      const stats = wsServer.getConnectionStats();

      expect(stats.total).toBe(3);
      expect(stats.byUser.get("user-1")).toBe(2);
      expect(stats.byUser.get("user-2")).toBe(1);
      expect(stats.bySite.get("site-123")).toBe(2);
      expect(stats.bySite.get("site-456")).toBe(1);
    });
  });

  describe("connection cleanup", () => {
    it("should clean up resources on disconnection", async () => {
      // Set up connection with subscription
      const mockRequest = {
        headers: { authorization: "Bearer valid-token" },
      };

      mockAuthService.verifyToken.mockResolvedValue({
        id: "user-123",
        siteId: "site-123",
        organizationId: "org-123",
      });
      mockRateLimiter.isAllowed.mockResolvedValue(true);

      await wsServer.handleConnection(mockWs, mockRequest);

      // Subscribe to channel
      mockWs.emit("message", JSON.stringify({
        type: "subscribe",
        channel: "site:site-123:notifications",
      }));

      await new Promise(resolve => setTimeout(resolve, 10));

      let stats = wsServer.getConnectionStats();
      expect(stats.total).toBe(1);
      expect(stats.byChannel.get("site:site-123:notifications")).toBe(1);

      // Simulate disconnection
      mockWs.emit("close");

      await new Promise(resolve => setTimeout(resolve, 10));

      stats = wsServer.getConnectionStats();
      expect(stats.total).toBe(0);
      expect(stats.byChannel.get("site:site-123:notifications")).toBeUndefined();
      expect(mockMetrics.decrement).toHaveBeenCalledWith("websocket.connections.active");
    });
  });
});