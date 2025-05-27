import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getContextLogger } from "../../utils/logger";

const logger = getContextLogger({ service: "service-auth" });

export interface ServiceJWTPayload {
  sub: string; // service name
  iss: string; // issuer
  aud: string; // audience
  iat: number;
  exp: number;
  scope: string[]; // service permissions
}

export interface AuthenticatedServiceRequest extends Request {
  service?: {
    name: string;
    scope: string[];
  };
  serviceToken?: string;
}

export enum ServiceScope {
  // User service scopes
  USER_READ = "user:read",
  USER_WRITE = "user:write",
  USER_DELETE = "user:delete",

  // Notification service scopes
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_WRITE = "notification:write",
  NOTIFICATION_SEND = "notification:send",

  // Analytics service scopes
  ANALYTICS_READ = "analytics:read",
  ANALYTICS_WRITE = "analytics:write",

  // Integration service scopes
  INTEGRATION_READ = "integration:read",
  INTEGRATION_WRITE = "integration:write",
  INTEGRATION_WEBHOOK = "integration:webhook",

  // Billing service scopes
  BILLING_READ = "billing:read",
  BILLING_WRITE = "billing:write",

  // Stream service scopes
  STREAM_READ = "stream:read",
  STREAM_WRITE = "stream:write",
  STREAM_PUBLISH = "stream:publish",
}

// Service-specific scope mappings
const SERVICE_SCOPES: Record<string, ServiceScope[]> = {
  users: [
    ServiceScope.USER_READ,
    ServiceScope.USER_WRITE,
    ServiceScope.USER_DELETE,
    ServiceScope.ANALYTICS_WRITE, // Can write analytics events
  ],
  notifications: [
    ServiceScope.NOTIFICATION_READ,
    ServiceScope.NOTIFICATION_WRITE,
    ServiceScope.NOTIFICATION_SEND,
    ServiceScope.USER_READ, // Can read user data
    ServiceScope.ANALYTICS_WRITE, // Can write analytics events
    ServiceScope.STREAM_PUBLISH, // Can publish to streams
  ],
  analytics: [
    ServiceScope.ANALYTICS_READ,
    ServiceScope.ANALYTICS_WRITE,
    ServiceScope.USER_READ, // Can read user data
    ServiceScope.NOTIFICATION_READ, // Can read notification data
  ],
  integrations: [
    ServiceScope.INTEGRATION_READ,
    ServiceScope.INTEGRATION_WRITE,
    ServiceScope.INTEGRATION_WEBHOOK,
    ServiceScope.USER_READ, // Can read user data
    ServiceScope.NOTIFICATION_WRITE, // Can create notifications
    ServiceScope.ANALYTICS_WRITE, // Can write analytics events
    ServiceScope.STREAM_PUBLISH, // Can publish to streams
  ],
  billing: [
    ServiceScope.BILLING_READ,
    ServiceScope.BILLING_WRITE,
    ServiceScope.USER_READ, // Can read user data
    ServiceScope.ANALYTICS_WRITE, // Can write analytics events
  ],
  "notification-stream-service": [
    ServiceScope.STREAM_READ,
    ServiceScope.STREAM_WRITE,
    ServiceScope.STREAM_PUBLISH,
    ServiceScope.NOTIFICATION_READ, // Can read notification data
    ServiceScope.USER_READ, // Can read user data
    ServiceScope.ANALYTICS_WRITE, // Can write analytics events
  ],
};

export class ServiceAuthService {
  private jwtSecret: string;
  private jwtIssuer: string;
  private jwtAudience: string;

  constructor(
    jwtSecret: string = process.env.SERVICE_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "service-secret",
    jwtIssuer: string = process.env.JWT_ISSUER || "social-proof-services",
    jwtAudience: string = process.env.JWT_AUDIENCE || "social-proof-api"
  ) {
    this.jwtSecret = jwtSecret;
    this.jwtIssuer = jwtIssuer;
    this.jwtAudience = jwtAudience;
  }

  /**
   * Generate service-to-service JWT token
   */
  generateServiceToken(serviceName: string): string {
    const scopes = SERVICE_SCOPES[serviceName] || [];

    const payload: Omit<ServiceJWTPayload, "iat" | "exp" | "iss" | "aud"> = {
      sub: serviceName,
      scope: scopes.map((s) => s.toString()),
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: "1h", // Shorter expiry for service tokens
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    });
  }

  /**
   * Verify service token
   */
  verifyServiceToken(token: string): ServiceJWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      }) as ServiceJWTPayload;
    } catch (error) {
      logger.warn("Invalid service token", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Middleware to verify service-to-service authentication
   */
  verifyServiceAuth = (
    req: AuthenticatedServiceRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const authHeader = req.headers["x-service-auth"] || req.headers.authorization;

      if (!authHeader) {
        logger.warn("No service auth header provided", { path: req.path });
        res.status(401).json({ error: "Service authentication required" });
        return;
      }

      const token =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ") ?
          authHeader.slice(7)
        : authHeader;

      if (!token || (typeof token === "string" && token.trim() === "")) {
        logger.warn("No service token provided", { path: req.path });
        res.status(401).json({ error: "Service authentication required" });
        return;
      }

      const decoded = this.verifyServiceToken(token as string);

      if (!decoded) {
        res.status(401).json({ error: "Invalid service token" });
        return;
      }

      req.service = {
        name: decoded.sub,
        scope: decoded.scope,
      };
      req.serviceToken = token as string;

      logger.debug("Service authenticated successfully", {
        serviceName: decoded.sub,
        scope: decoded.scope,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error("Service authentication failed", {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });
      res.status(500).json({ error: "Service authentication failed" });
    }
  };

  /**
   * Middleware to check if service has required scope
   */
  requireServiceScope = (requiredScope: ServiceScope) => {
    return (req: AuthenticatedServiceRequest, res: Response, next: NextFunction): void => {
      if (!req.service) {
        logger.warn("No service found in request for scope check", { requiredScope });
        res.status(401).json({ error: "Service authentication required" });
        return;
      }

      if (!req.service.scope.includes(requiredScope)) {
        logger.warn("Service lacks required scope", {
          serviceName: req.service.name,
          serviceScope: req.service.scope,
          requiredScope,
          path: req.path,
        });
        res.status(403).json({ error: "Insufficient service permissions" });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if service has any of the required scopes
   */
  requireAnyServiceScope = (requiredScopes: ServiceScope[]) => {
    return (req: AuthenticatedServiceRequest, res: Response, next: NextFunction): void => {
      if (!req.service) {
        logger.warn("No service found in request for scope check", { requiredScopes });
        res.status(401).json({ error: "Service authentication required" });
        return;
      }

      const hasAnyScope = requiredScopes.some((scope) => req.service!.scope.includes(scope));

      if (!hasAnyScope) {
        logger.warn("Service lacks any of the required scopes", {
          serviceName: req.service.name,
          serviceScope: req.service.scope,
          requiredScopes,
          path: req.path,
        });
        res.status(403).json({ error: "Insufficient service permissions" });
        return;
      }

      next();
    };
  };

  /**
   * Get HTTP client with service authentication
   */
  getAuthenticatedHttpClient(serviceName: string) {
    const token = this.generateServiceToken(serviceName);

    return {
      headers: {
        "X-Service-Auth": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      token,
    };
  }

  /**
   * Validate service name
   */
  isValidService(serviceName: string): boolean {
    return Object.keys(SERVICE_SCOPES).includes(serviceName);
  }

  /**
   * Get scopes for a service
   */
  getServiceScopes(serviceName: string): ServiceScope[] {
    return SERVICE_SCOPES[serviceName] || [];
  }

  /**
   * Check if a service has a specific scope
   */
  serviceHasScope(serviceName: string, scope: ServiceScope): boolean {
    const serviceScopes = this.getServiceScopes(serviceName);
    return serviceScopes.includes(scope);
  }
}

// Export singleton instance
export const serviceAuthService = new ServiceAuthService();

// Helper function to create service client
export function createServiceClient(serviceName: string) {
  if (!serviceAuthService.isValidService(serviceName)) {
    throw new Error(`Invalid service name: ${serviceName}`);
  }

  return serviceAuthService.getAuthenticatedHttpClient(serviceName);
}
