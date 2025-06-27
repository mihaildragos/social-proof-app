import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthenticatedRequest } from "./auth";
import { serviceAuthService, AuthenticatedServiceRequest } from "../auth/service-auth";
import { getContextLogger } from "../../utils/logger";

const logger = getContextLogger({ service: "auth-middleware" });

export interface CombinedAuthRequest extends AuthenticatedRequest, AuthenticatedServiceRequest {}

export class AuthMiddlewareService {
  /**
   * Middleware that accepts either user or service authentication
   */
  static authenticateUserOrService = (
    req: CombinedAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // Check for service authentication first
    const serviceAuthHeader = req.headers["x-service-auth"];
    if (serviceAuthHeader) {
      return serviceAuthService.verifyServiceAuth(req, res, next);
    }

    // Fall back to user authentication
    const userAuthHeader = req.headers.authorization;
    if (userAuthHeader) {
      return authMiddleware.verifyToken(req, res, next);
    }

    logger.warn("No authentication provided", { path: req.path });
    res.status(401).json({ error: "Authentication required" });
  };

  /**
   * Middleware that requires user authentication only
   */
  static requireUserAuth = authMiddleware.verifyToken;

  /**
   * Middleware that requires service authentication only
   */
  static requireServiceAuth = serviceAuthService.verifyServiceAuth;

  /**
   * Middleware that allows optional user authentication
   */
  static optionalUserAuth = authMiddleware.optionalAuth;

  /**
   * Middleware factory for API key authentication
   */
  static requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers["x-api-key"] || req.query.api_key;

    if (!apiKey) {
      logger.warn("No API key provided", { path: req.path });
      res.status(401).json({ error: "API key required" });
      return;
    }

    // TODO: Validate API key against database
    // For now, just check if it's present
    if (typeof apiKey !== "string" || apiKey.length < 32) {
      logger.warn("Invalid API key format", { path: req.path });
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    logger.debug("API key authentication successful", { path: req.path });
    next();
  };

  /**
   * Middleware for webhook authentication
   */
  static requireWebhookAuth = (expectedSecret?: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const signature = req.headers["x-webhook-signature"] || req.headers["x-hub-signature-256"];
      const secret = expectedSecret || process.env.WEBHOOK_SECRET;

      if (!signature || !secret) {
        logger.warn("Missing webhook signature or secret", { path: req.path });
        res.status(401).json({ error: "Webhook authentication failed" });
        return;
      }

      // TODO: Implement proper webhook signature verification
      // This would typically involve HMAC verification
      logger.debug("Webhook authentication successful", { path: req.path });
      next();
    };
  };

  /**
   * Middleware to check if request is from internal network
   */
  static requireInternalNetwork = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];
    const internalNetworks = process.env.INTERNAL_NETWORKS?.split(",") || [
      "127.0.0.1",
      "::1",
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
    ];

    // TODO: Implement proper IP range checking
    // For now, just check for localhost
    const isInternal =
      clientIP === "127.0.0.1" || clientIP === "::1" || clientIP?.includes("127.0.0.1");

    if (!isInternal) {
      logger.warn("Request from external network blocked", { clientIP, path: req.path });
      res.status(403).json({ error: "Access denied" });
      return;
    }

    logger.debug("Internal network access granted", { clientIP, path: req.path });
    next();
  };

  /**
   * Middleware to extract organization context
   */
  static extractOrganizationContext = (
    req: CombinedAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    let organizationId: string | undefined;

    // Try to get organization from user context
    if (req.user?.organizationId) {
      organizationId = req.user.organizationId;
    }

    // Try to get organization from headers
    if (!organizationId) {
      organizationId = req.headers["x-organization-id"] as string;
    }

    // Try to get organization from query params
    if (!organizationId) {
      organizationId = req.query.organizationId as string;
    }

    if (organizationId) {
      (req as any).organizationId = organizationId;
      logger.debug("Organization context extracted", { organizationId, path: req.path });
    }

    next();
  };

  /**
   * Middleware to require organization context
   */
  static requireOrganizationContext = (
    req: CombinedAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    AuthMiddlewareService.extractOrganizationContext(req, res, () => {
      if (!(req as any).organizationId) {
        logger.warn("No organization context found", { path: req.path });
        res.status(400).json({ error: "Organization context required" });
        return;
      }
      next();
    });
  };

  /**
   * Middleware to validate request origin
   */
  static validateOrigin = (allowedOrigins?: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const origin = req.headers.origin;
      const defaultAllowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:3000",
      ];
      const allowed = allowedOrigins || defaultAllowedOrigins;

      if (origin && !allowed.includes(origin)) {
        logger.warn("Request from unauthorized origin", { origin, path: req.path });
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to log authentication events
   */
  static logAuthEvents = (req: CombinedAuthRequest, res: Response, next: NextFunction): void => {
    const authType =
      req.user ? "user"
      : req.service ? "service"
      : "none";
    const identifier = req.user?.id || req.service?.name || "anonymous";

    logger.info("Authentication event", {
      authType,
      identifier,
      path: req.path,
      method: req.method,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    next();
  };
}

// Export commonly used middleware combinations
export const authMiddlewares = {
  // Basic authentication
  userAuth: AuthMiddlewareService.requireUserAuth,
  serviceAuth: AuthMiddlewareService.requireServiceAuth,
  userOrServiceAuth: AuthMiddlewareService.authenticateUserOrService,
  optionalUserAuth: AuthMiddlewareService.optionalUserAuth,

  // API authentication
  apiKey: AuthMiddlewareService.requireApiKey,
  webhook: AuthMiddlewareService.requireWebhookAuth,

  // Network security
  internalOnly: AuthMiddlewareService.requireInternalNetwork,
  validateOrigin: AuthMiddlewareService.validateOrigin,

  // Context extraction
  extractOrg: AuthMiddlewareService.extractOrganizationContext,
  requireOrg: AuthMiddlewareService.requireOrganizationContext,

  // Logging
  logAuth: AuthMiddlewareService.logAuthEvents,

  // Common combinations
  userWithOrg: [
    AuthMiddlewareService.requireUserAuth,
    AuthMiddlewareService.requireOrganizationContext,
  ],

  serviceWithLogging: [
    AuthMiddlewareService.requireServiceAuth,
    AuthMiddlewareService.logAuthEvents,
  ],

  publicWithOriginCheck: [
    AuthMiddlewareService.validateOrigin(),
    AuthMiddlewareService.logAuthEvents,
  ],
};
