import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { EventEmitter } from "events";
import { getContextLogger } from "@social-proof/shared/utils/logger";
import { metrics } from "../utils/metrics";

const logger = getContextLogger({ service: "websocket-server" });

// WebSocket connection interface
export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  organizationId: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
  metadata: Record<string, any>;
}

// WebSocket message types
export interface WebSocketMessage {
  type: "notification" | "ping" | "pong" | "subscribe" | "unsubscribe" | "error";
  id?: string;
  data?: any;
  timestamp: string;
}

// WebSocket server configuration
export interface WebSocketServerConfig {
  port: number;
  path?: string;
  pingInterval?: number;
  connectionTimeout?: number;
  maxConnections?: number;
  enableCompression?: boolean;
  enableAuth?: boolean;
}

// WebSocket server class
export class NotificationWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocketConnection> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig) {
    super();
    this.config = {
      pingInterval: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      maxConnections: 10000,
      enableCompression: true,
      enableAuth: true,
      ...config,
    };

    this.wss = new WebSocketServer({
      port: this.config.port,
      path: this.config.path || "/ws",
      perMessageDeflate: this.config.enableCompression,
      maxPayload: 1024 * 1024, // 1MB
    });

    this.setupEventHandlers();
    this.startPingInterval();

    logger.info("WebSocket server initialized", {
      port: this.config.port,
      path: this.config.path,
      maxConnections: this.config.maxConnections,
    });
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on("connection", this.handleConnection.bind(this));
    this.wss.on("error", this.handleServerError.bind(this));
    this.wss.on("listening", () => {
      logger.info("WebSocket server listening", {
        port: this.config.port,
        path: this.config.path,
      });
      metrics.gauge("websocket.server.status", 1);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      // Check connection limit
      if (this.connections.size >= this.config.maxConnections!) {
        logger.warn("Connection limit reached, rejecting new connection");
        socket.close(1013, "Server overloaded");
        metrics.increment("websocket.connections.rejected.limit");
        return;
      }

      // Parse connection parameters
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const connectionParams = this.parseConnectionParams(url);

      // Authenticate connection if enabled
      if (
        this.config.enableAuth &&
        !(await this.authenticateConnection(connectionParams, request))
      ) {
        logger.warn("WebSocket authentication failed", { ip: request.socket.remoteAddress });
        socket.close(1008, "Authentication failed");
        metrics.increment("websocket.connections.rejected.auth");
        return;
      }

      // Create connection object
      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        id: connectionId,
        socket,
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

      // Setup socket event handlers
      this.setupSocketHandlers(connection);

      // Send welcome message
      this.sendMessage(connection, {
        type: "ping",
        data: { connectionId, serverTime: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });

      logger.info("WebSocket connection established", {
        connectionId,
        organizationId: connection.organizationId,
        siteId: connection.siteId,
        userId: connection.userId,
        totalConnections: this.connections.size,
      });

      metrics.increment("websocket.connections.established");
      metrics.gauge("websocket.connections.active", this.connections.size);

      // Emit connection event
      this.emit("connection", connection);
    } catch (error) {
      logger.error("Error handling WebSocket connection:", error);
      socket.close(1011, "Internal server error");
      metrics.increment("websocket.connections.rejected.error");
    }
  }

  /**
   * Setup individual socket event handlers
   */
  private setupSocketHandlers(connection: WebSocketConnection): void {
    const { socket } = connection;

    socket.on("message", (data) => this.handleMessage(connection, data));
    socket.on("close", (code, reason) => this.handleDisconnection(connection, code, reason));
    socket.on("error", (error) => this.handleSocketError(connection, error));
    socket.on("pong", () => this.handlePong(connection));
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connection: WebSocketConnection, data: any): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      logger.debug("WebSocket message received", {
        connectionId: connection.id,
        messageType: message.type,
        messageId: message.id,
      });

      metrics.increment("websocket.messages.received", { type: message.type });

      switch (message.type) {
        case "ping":
          await this.handlePingMessage(connection, message);
          break;
        case "subscribe":
          await this.handleSubscribeMessage(connection, message);
          break;
        case "unsubscribe":
          await this.handleUnsubscribeMessage(connection, message);
          break;
        default:
          logger.warn("Unknown message type received", {
            connectionId: connection.id,
            messageType: message.type,
          });
          this.sendError(connection, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error("Error handling WebSocket message:", error, {
        connectionId: connection.id,
      });
      this.sendError(connection, "Invalid message format");
      metrics.increment("websocket.messages.errors");
    }
  }

  /**
   * Handle ping message
   */
  private async handlePingMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    connection.lastPing = new Date();
    this.sendMessage(connection, {
      type: "pong",
      id: message.id,
      data: { serverTime: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle subscribe message
   */
  private async handleSubscribeMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { channel } = message.data || {};

    if (!channel) {
      this.sendError(connection, "Channel is required for subscription");
      return;
    }

    // Validate subscription permissions
    if (!(await this.validateSubscription(connection, channel))) {
      this.sendError(connection, "Subscription not allowed for this channel");
      return;
    }

    connection.subscriptions.add(channel);

    logger.info("WebSocket subscription added", {
      connectionId: connection.id,
      channel,
      totalSubscriptions: connection.subscriptions.size,
    });

    metrics.increment("websocket.subscriptions.added");

    this.sendMessage(connection, {
      type: "subscribe",
      id: message.id,
      data: { channel, status: "subscribed" },
      timestamp: new Date().toISOString(),
    });

    this.emit("subscribe", connection, channel);
  }

  /**
   * Handle unsubscribe message
   */
  private async handleUnsubscribeMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { channel } = message.data || {};

    if (!channel) {
      this.sendError(connection, "Channel is required for unsubscription");
      return;
    }

    connection.subscriptions.delete(channel);

    logger.info("WebSocket subscription removed", {
      connectionId: connection.id,
      channel,
      totalSubscriptions: connection.subscriptions.size,
    });

    metrics.increment("websocket.subscriptions.removed");

    this.sendMessage(connection, {
      type: "unsubscribe",
      id: message.id,
      data: { channel, status: "unsubscribed" },
      timestamp: new Date().toISOString(),
    });

    this.emit("unsubscribe", connection, channel);
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(connection: WebSocketConnection, code: number, reason: Buffer): void {
    this.connections.delete(connection.id);

    logger.info("WebSocket connection closed", {
      connectionId: connection.id,
      code,
      reason: reason.toString(),
      totalConnections: this.connections.size,
    });

    metrics.increment("websocket.connections.closed", { code: code.toString() });
    metrics.gauge("websocket.connections.active", this.connections.size);

    this.emit("disconnect", connection, code, reason);
  }

  /**
   * Handle socket error
   */
  private handleSocketError(connection: WebSocketConnection, error: Error): void {
    logger.error("WebSocket socket error:", error, {
      connectionId: connection.id,
    });

    metrics.increment("websocket.socket.errors");
    this.emit("error", connection, error);
  }

  /**
   * Handle server error
   */
  private handleServerError(error: Error): void {
    logger.error("WebSocket server error:", error);
    metrics.increment("websocket.server.errors");
    this.emit("serverError", error);
  }

  /**
   * Handle pong response
   */
  private handlePong(connection: WebSocketConnection): void {
    connection.lastPing = new Date();
    metrics.increment("websocket.pongs.received");
  }

  /**
   * Send message to a specific connection
   */
  public sendMessage(connection: WebSocketConnection, message: WebSocketMessage): boolean {
    try {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(message));
        metrics.increment("websocket.messages.sent", { type: message.type });
        return true;
      } else {
        logger.warn("Attempted to send message to closed connection", {
          connectionId: connection.id,
          readyState: connection.socket.readyState,
        });
        return false;
      }
    } catch (error) {
      logger.error("Error sending WebSocket message:", error, {
        connectionId: connection.id,
      });
      metrics.increment("websocket.messages.send_errors");
      return false;
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(connection: WebSocketConnection, errorMessage: string): void {
    this.sendMessage(connection, {
      type: "error",
      data: { error: errorMessage },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast message to multiple connections
   */
  public broadcast(
    message: WebSocketMessage,
    filter?: (connection: WebSocketConnection) => boolean
  ): number {
    let sentCount = 0;

    for (const connection of this.connections.values()) {
      if (!filter || filter(connection)) {
        if (this.sendMessage(connection, message)) {
          sentCount++;
        }
      }
    }

    logger.debug("Broadcast message sent", {
      messageType: message.type,
      totalConnections: this.connections.size,
      sentCount,
    });

    metrics.histogram("websocket.broadcast.recipients", sentCount);
    return sentCount;
  }

  /**
   * Send notification to specific organization
   */
  public sendToOrganization(organizationId: string, message: WebSocketMessage): number {
    return this.broadcast(message, (connection) => connection.organizationId === organizationId);
  }

  /**
   * Send notification to specific site
   */
  public sendToSite(siteId: string, message: WebSocketMessage): number {
    return this.broadcast(message, (connection) => connection.siteId === siteId);
  }

  /**
   * Send notification to specific user
   */
  public sendToUser(userId: string, message: WebSocketMessage): number {
    return this.broadcast(message, (connection) => connection.userId === userId);
  }

  /**
   * Send notification to subscribers of a channel
   */
  public sendToChannel(channel: string, message: WebSocketMessage): number {
    return this.broadcast(message, (connection) => connection.subscriptions.has(channel));
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = this.config.connectionTimeout!;

      for (const connection of this.connections.values()) {
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();

        if (timeSinceLastPing > timeout) {
          logger.warn("Connection timeout, closing connection", {
            connectionId: connection.id,
            timeSinceLastPing,
          });
          connection.socket.close(1000, "Connection timeout");
          metrics.increment("websocket.connections.timeout");
        } else {
          // Send ping
          connection.socket.ping();
          metrics.increment("websocket.pings.sent");
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Parse connection parameters from URL
   */
  private parseConnectionParams(url: URL): any {
    const params = new URLSearchParams(url.search);

    return {
      organizationId: params.get("organizationId") || "",
      siteId: params.get("siteId"),
      userId: params.get("userId"),
      sessionId: params.get("sessionId"),
      token: params.get("token"),
      metadata: {},
    };
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateConnection(params: any, request: IncomingMessage): Promise<boolean> {
    // TODO: Implement proper authentication logic
    // For now, just check if organizationId is provided
    return !!params.organizationId;
  }

  /**
   * Validate subscription permissions
   */
  private async validateSubscription(
    connection: WebSocketConnection,
    channel: string
  ): Promise<boolean> {
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
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  public getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for an organization
   */
  public getOrganizationConnections(organizationId: string): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.organizationId === organizationId
    );
  }

  /**
   * Close all connections and shutdown server
   */
  public async close(): Promise<void> {
    logger.info("Shutting down WebSocket server");

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.socket.close(1001, "Server shutting down");
    }

    // Close server
    return new Promise((resolve) => {
      this.wss.close(() => {
        logger.info("WebSocket server closed");
        metrics.gauge("websocket.server.status", 0);
        resolve();
      });
    });
  }
}

export default NotificationWebSocketServer;
