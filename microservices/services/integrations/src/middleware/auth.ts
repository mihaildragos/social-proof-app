import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationId: string;
        role: string;
        permissions: string[];
      };
      auth?: {
        userId: string;
        orgId?: string;
        orgRole?: string;
      };
    }
  }
}

/**
 * Main authentication middleware for integrations service
 * Validates JWT tokens and extracts user information
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      res.status(500).json({ error: "JWT secret not configured" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    // Map JWT payload to user object
    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email || "",
      organizationId: decoded.orgId || decoded.organizationId || "",
      role: decoded.role || "user",
      permissions: decoded.permissions || [],
    };

    // Also set auth for backward compatibility
    req.auth = {
      userId: decoded.sub || decoded.userId,
      orgId: decoded.orgId || decoded.organizationId,
      orgRole: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
    return;
  }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      next();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email || "",
      organizationId: decoded.orgId || decoded.organizationId || "",
      role: decoded.role || "user",
      permissions: decoded.permissions || [],
    };

    req.auth = {
      userId: decoded.sub || decoded.userId,
      orgId: decoded.orgId || decoded.organizationId,
      orgRole: decoded.role,
    };

    next();
  } catch (error) {
    // Don't fail on optional auth
    next();
  }
};

/**
 * Admin role middleware
 * Ensures user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
};

/**
 * Organization access middleware
 * Ensures user belongs to the specified organization
 */
export const requireOrganization = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { organizationId } = req.params;

  if (organizationId && req.user.organizationId !== organizationId) {
    res.status(403).json({ error: "Access denied to this organization" });
    return;
  }

  next();
};

/**
 * Permission-based middleware
 * Ensures user has specific permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== "admin") {
      res.status(403).json({ error: `Permission required: ${permission}` });
      return;
    }

    next();
  };
};

/**
 * API key authentication middleware
 * For external integrations and webhooks
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      res.status(401).json({ error: "API key required" });
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith("sk_") && !apiKey.startsWith("pk_")) {
      res.status(401).json({ error: "Invalid API key format" });
      return;
    }

    // TODO: Validate API key against database
    // For now, just check if it's not empty
    if (apiKey.length < 10) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Set user context from API key
    req.user = {
      id: "api_user",
      email: "",
      organizationId: "",
      role: "api",
      permissions: ["api:read", "api:write"],
    };

    next();
  } catch (error) {
    console.error("API key auth error:", error);
    res.status(500).json({ error: "API key authentication failed" });
    return;
  }
};
