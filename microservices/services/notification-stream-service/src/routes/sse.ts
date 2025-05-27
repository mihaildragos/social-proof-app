import { Router, Request, Response } from "express";
import { EventEmitter } from "events";
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "sse-routes" });

// SSE connection interface
export interface SSEConnection {
  id: string;
  response: Response;
  organizationId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
  metadata: Record<string, any>;
}

// SSE message interface
export interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

// SSE server class
export class SSEServer extends EventEmitter {
  private connections: Map<string, SSEConnection> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private config: {
    pingInterval: number;
    connectionTimeout: number;
    maxConnections: number;
  };

  constructor(config?: Partial<typeof SSEServer.prototype.config>) {
    super();
    this.config = {
      pingInterval: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      maxConnections: 5000,
      ...config,
    };

    this.startPingInterval();
    logger.info("SSE server initialized", this.config);
  }

  /**
   * Handle new SSE connection
   */
  public handleConnection(req: Request, res: Response): void {
    try {
      // Check connection limit
      if (this.connections.size >= this.config.maxConnections) {
        logger.warn("SSE connection limit reached");
        if (!res.headersSent) {
          res.status(503).json({ error: "Server overloaded" });
        }
        metrics.increment("sse.connections.rejected.limit");
        return;
      }

      // Parse connection parameters
      const connectionParams = this.parseConnectionParams(req);

      // Authenticate connection
      if (!this.authenticateConnection(connectionParams, req)) {
        logger.warn("SSE authentication failed", { 
          ip: req.ip,
          organizationId: connectionParams.organizationId,
          siteId: connectionParams.siteId 
        });
        if (!res.headersSent) {
          res.status(401).json({ error: "Authentication failed" });
        }
        metrics.increment("sse.connections.rejected.auth");
        return;
      }

      // Set SSE headers only if not already set
      if (!res.headersSent) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
          "Access-Control-Allow-Credentials": "true",
        });
      }

      // Create connection object
      const connectionId = this.generateConnectionId();
      const connection: SSEConnection = {
        id: connectionId,
        response: res,
        organizationId: connectionParams.organizationId,
        siteId: connectionParams.siteId,
        userId: connectionParams.userId,
        sessionId: connectionParams.sessionId,
        subscriptions: new Set(),
        lastPing: new Date(),
        metadata: connectionParams.metadata || {},
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Send initial connection message
      this.sendMessage(connection, {
        event: "connected",
        data: {
          connectionId,
          serverTime: new Date().toISOString(),
        },
      });

      // Handle client disconnect
      if (typeof req.on === 'function') {
        req.on("close", () => {
          this.handleDisconnection(connection);
        });

        req.on("error", (error) => {
          this.handleConnectionError(connection, error);
        });
      } else {
        logger.warn("Request object does not support event listeners", {
          connectionId,
          reqType: typeof req,
          hasOn: typeof req.on,
        });
        
        // Set up a timeout to clean up the connection if no proper event handling
        setTimeout(() => {
          if (this.connections.has(connectionId)) {
            logger.info("Cleaning up SSE connection without event listeners", { connectionId });
            this.handleDisconnection(connection);
          }
        }, this.config.connectionTimeout);
      }

      logger.info("SSE connection established", {
        connectionId,
        organizationId: connection.organizationId,
        siteId: connection.siteId,
        userId: connection.userId,
        totalConnections: this.connections.size,
      });

      metrics.increment("sse.connections.established");
      metrics.gauge("sse.connections.active", this.connections.size);

      // Emit connection event
      this.emit("connection", connection);
    } catch (error) {
      logger.error("Error handling SSE connection:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
      metrics.increment("sse.connections.rejected.error");
    }
  }

  /**
   * Send message to specific connection
   */
  public sendMessage(connection: SSEConnection, message: SSEMessage): boolean {
    try {
      if (connection.response.destroyed || connection.response.writableEnded) {
        logger.warn("Attempted to send message to closed SSE connection", {
          connectionId: connection.id,
        });
        return false;
      }

      let output = "";

      if (message.id) {
        output += `id: ${message.id}\n`;
      }

      if (message.event) {
        output += `event: ${message.event}\n`;
      }

      if (message.retry) {
        output += `retry: ${message.retry}\n`;
      }

      const data = typeof message.data === "string" ? message.data : JSON.stringify(message.data);
      output += `data: ${data}\n\n`;

      connection.response.write(output);
      connection.lastPing = new Date();

      metrics.increment("sse.messages.sent", { event: message.event || "data" });
      return true;
    } catch (error) {
      logger.error("Error sending SSE message:", error, {
        connectionId: connection.id,
      });
      metrics.increment("sse.messages.send_errors");
      return false;
    }
  }

  /**
   * Broadcast message to multiple connections
   */
  public broadcast(message: SSEMessage, filter?: (connection: SSEConnection) => boolean): number {
    let sentCount = 0;

    for (const connection of this.connections.values()) {
      if (!filter || filter(connection)) {
        if (this.sendMessage(connection, message)) {
          sentCount++;
        }
      }
    }

    logger.debug("SSE broadcast message sent", {
      event: message.event,
      totalConnections: this.connections.size,
      sentCount,
    });

    metrics.histogram("sse.broadcast.recipients", sentCount);
    return sentCount;
  }

  /**
   * Send notification to specific organization
   */
  public sendToOrganization(organizationId: string, message: SSEMessage): number {
    return this.broadcast(message, (connection) => connection.organizationId === organizationId);
  }

  /**
   * Send notification to specific site
   */
  public sendToSite(siteId: string, message: SSEMessage): number {
    return this.broadcast(message, (connection) => connection.siteId === siteId);
  }

  /**
   * Send notification to specific user
   */
  public sendToUser(userId: string, message: SSEMessage): number {
    return this.broadcast(message, (connection) => connection.userId === userId);
  }

  /**
   * Send notification to subscribers of a channel
   */
  public sendToChannel(channel: string, message: SSEMessage): number {
    return this.broadcast(message, (connection) => connection.subscriptions.has(channel));
  }

  /**
   * Subscribe connection to a channel
   */
  public subscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Validate subscription permissions
    if (!this.validateSubscription(connection, channel)) {
      logger.warn("SSE subscription not allowed", {
        connectionId,
        channel,
      });
      return false;
    }

    connection.subscriptions.add(channel);

    logger.info("SSE subscription added", {
      connectionId,
      channel,
      totalSubscriptions: connection.subscriptions.size,
    });

    metrics.increment("sse.subscriptions.added");

    this.sendMessage(connection, {
      event: "subscribed",
      data: { channel, status: "subscribed" },
    });

    this.emit("subscribe", connection, channel);
    return true;
  }

  /**
   * Unsubscribe connection from a channel
   */
  public unsubscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.subscriptions.delete(channel);

    logger.info("SSE subscription removed", {
      connectionId,
      channel,
      totalSubscriptions: connection.subscriptions.size,
    });

    metrics.increment("sse.subscriptions.removed");

    this.sendMessage(connection, {
      event: "unsubscribed",
      data: { channel, status: "unsubscribed" },
    });

    this.emit("unsubscribe", connection, channel);
    return true;
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connection: SSEConnection): void {
    this.connections.delete(connection.id);

    logger.info("SSE connection closed", {
      connectionId: connection.id,
      totalConnections: this.connections.size,
    });

    metrics.increment("sse.connections.closed");
    metrics.gauge("sse.connections.active", this.connections.size);

    this.emit("disconnect", connection);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connection: SSEConnection, error: Error): void {
    logger.error("SSE connection error:", error, {
      connectionId: connection.id,
    });

    metrics.increment("sse.connection.errors");
    this.emit("error", connection, error);
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = this.config.connectionTimeout;

      for (const connection of this.connections.values()) {
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();

        if (timeSinceLastPing > timeout) {
          logger.warn("SSE connection timeout", {
            connectionId: connection.id,
            timeSinceLastPing,
          });
          connection.response.end();
          this.connections.delete(connection.id);
          metrics.increment("sse.connections.timeout");
        } else {
          // Send ping
          this.sendMessage(connection, {
            event: "ping",
            data: { serverTime: new Date().toISOString() },
          });
          metrics.increment("sse.pings.sent");
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Parse connection parameters from request
   */
  private parseConnectionParams(req: Request): any {
    return {
      organizationId: (req.query.organizationId as string) || "test-org",
      siteId: req.query.siteId as string,
      userId: req.query.userId as string,
      sessionId: req.query.sessionId as string,
      token: req.query.token as string,
      metadata: {},
    };
  }

  /**
   * Authenticate SSE connection
   */
  private authenticateConnection(params: any, req: Request): boolean {
    // TODO: Implement proper authentication logic
    // For now, allow connections with organizationId or in development mode
    return !!params.organizationId || process.env.NODE_ENV === 'development';
  }

  /**
   * Validate subscription permissions
   */
  private validateSubscription(connection: SSEConnection, channel: string): boolean {
    // TODO: Implement proper subscription validation
    // For now, allow all subscriptions for the same organization
    return (
      channel.startsWith(`org:${connection.organizationId}`) ||
      channel.startsWith(`site:${connection.siteId}`) ||
      channel.startsWith(`user:${connection.userId}`)
    );
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    connectionsByOrganization: Record<string, number>;
    connectionsBySite: Record<string, number>;
    totalSubscriptions: number;
  } {
    const connectionsByOrganization: Record<string, number> = {};
    const connectionsBySite: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const connection of this.connections.values()) {
      // Count by organization
      connectionsByOrganization[connection.organizationId] =
        (connectionsByOrganization[connection.organizationId] || 0) + 1;

      // Count by site
      if (connection.siteId) {
        connectionsBySite[connection.siteId] = (connectionsBySite[connection.siteId] || 0) + 1;
      }

      totalSubscriptions += connection.subscriptions.size;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByOrganization,
      connectionsBySite,
      totalSubscriptions,
    };
  }

  /**
   * Get connection by ID
   */
  public getConnection(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Close all connections and shutdown server
   */
  public async close(): Promise<void> {
    logger.info("Shutting down SSE server");

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.response.end();
    }

    this.connections.clear();
    logger.info("SSE server closed");
  }
}

// Create SSE server instance
const sseServer = new SSEServer();

// Create router
const router = Router();

/**
 * SSE connection endpoint
 * GET /sse/connect?organizationId=xxx&siteId=xxx&userId=xxx
 */
router.get("/connect", (req: Request, res: Response) => {
  sseServer.handleConnection(req, res);
});

/**
 * Subscribe to channel endpoint
 * POST /sse/subscribe
 */
router.post("/subscribe", (req: Request, res: Response) => {
  const { connectionId, channel } = req.body;

  if (!connectionId || !channel) {
    return res.status(400).json({
      error: "connectionId and channel are required",
    });
  }

  const success = sseServer.subscribe(connectionId, channel);

  if (success) {
    res.json({ success: true, message: "Subscribed successfully" });
  } else {
    res.status(400).json({ error: "Subscription failed" });
  }
});

/**
 * Unsubscribe from channel endpoint
 * POST /sse/unsubscribe
 */
router.post("/unsubscribe", (req: Request, res: Response) => {
  const { connectionId, channel } = req.body;

  if (!connectionId || !channel) {
    return res.status(400).json({
      error: "connectionId and channel are required",
    });
  }

  const success = sseServer.unsubscribe(connectionId, channel);

  if (success) {
    res.json({ success: true, message: "Unsubscribed successfully" });
  } else {
    res.status(400).json({ error: "Unsubscription failed" });
  }
});

/**
 * Send message to organization endpoint
 * POST /sse/send/organization
 */
router.post("/send/organization", (req: Request, res: Response) => {
  const { organizationId, message } = req.body;

  if (!organizationId || !message) {
    return res.status(400).json({
      error: "organizationId and message are required",
    });
  }

  const sentCount = sseServer.sendToOrganization(organizationId, message);

  res.json({
    success: true,
    sentCount,
    message: `Message sent to ${sentCount} connections`,
  });
});

/**
 * Send message to site endpoint
 * POST /sse/send/site
 */
router.post("/send/site", (req: Request, res: Response) => {
  const { siteId, message } = req.body;

  if (!siteId || !message) {
    return res.status(400).json({
      error: "siteId and message are required",
    });
  }

  const sentCount = sseServer.sendToSite(siteId, message);

  res.json({
    success: true,
    sentCount,
    message: `Message sent to ${sentCount} connections`,
  });
});

/**
 * Send message to user endpoint
 * POST /sse/send/user
 */
router.post("/send/user", (req: Request, res: Response) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({
      error: "userId and message are required",
    });
  }

  const sentCount = sseServer.sendToUser(userId, message);

  res.json({
    success: true,
    sentCount,
    message: `Message sent to ${sentCount} connections`,
  });
});

/**
 * Send message to channel endpoint
 * POST /sse/send/channel
 */
router.post("/send/channel", (req: Request, res: Response) => {
  const { channel, message } = req.body;

  if (!channel || !message) {
    return res.status(400).json({
      error: "channel and message are required",
    });
  }

  const sentCount = sseServer.sendToChannel(channel, message);

  res.json({
    success: true,
    sentCount,
    message: `Message sent to ${sentCount} connections`,
  });
});

/**
 * Broadcast message endpoint
 * POST /sse/broadcast
 */
router.post("/broadcast", (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "message is required",
    });
  }

  const sentCount = sseServer.broadcast(message);

  res.json({
    success: true,
    sentCount,
    message: `Message broadcast to ${sentCount} connections`,
  });
});

/**
 * Get SSE server statistics
 * GET /sse/stats
 */
router.get("/stats", (req: Request, res: Response) => {
  const stats = sseServer.getStats();
  res.json(stats);
});

/**
 * Health check endpoint
 * GET /sse/health
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connections: sseServer.getStats().totalConnections,
  });
});

export { router as sseRouter, sseServer };
export default router;
