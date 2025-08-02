import { Request, Response, NextFunction } from "express";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

// Extend Express Request type to include auth from both patterns
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
        sessionId: string;
      };
    }
  }
}

/**
 * Clerk authentication middleware
 * Validates JWT tokens and extracts user/organization information
 */
export const requireAuth = ClerkExpressRequireAuth({
  onError: (error: any) => {
    console.error("Authentication error", { error });
    throw new Error("Authentication required");
  },
});

/**
 * Main authentication middleware for billing service
 * Validates JWT tokens and extracts user information
 * This is the primary middleware used by route files
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Use Clerk auth first
    requireAuth(req, res, (error?: any) => {
      if (error) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Map Clerk auth to user object for backward compatibility
      if (req.auth) {
        req.user = {
          id: req.auth.userId,
          email: "", // Would need to be fetched from Clerk
          organizationId: req.auth.orgId || "",
          role: req.auth.orgRole || "user",
          permissions: [], // Would need to be mapped from role
        };
      }

      next();
    });
  } catch (error) {
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Try to authenticate but don't fail if no token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next();
      return;
    }

    requireAuth(req, res, (error?: any) => {
      if (error) {
        // Don't fail, just continue without auth
        next();
        return;
      }

      // Map Clerk auth to user object if successful
      if (req.auth) {
        req.user = {
          id: req.auth.userId,
          email: "",
          organizationId: req.auth.orgId || "",
          role: req.auth.orgRole || "user",
          permissions: [],
        };
      }

      next();
    });
  } catch (error) {
    // Don't fail on optional auth
    next();
  }
};

/**
 * Organization membership middleware
 * Ensures user belongs to the organization they're trying to access
 */
export const requireOrganization = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { orgId } = req.auth || {};
    const { organizationId } = req.params;

    if (!orgId) {
      res.status(403).json({ error: "Organization membership required" });
      return;
    }

    if (organizationId && orgId !== organizationId) {
      res.status(403).json({ error: "Access denied to this organization" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "Organization check failed" });
  }
};

/**
 * Admin role middleware
 * Ensures user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user && !req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const role = req.user?.role || req.auth?.orgRole;
    if (!role || !["admin", "owner"].includes(role)) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "Authorization check failed" });
  }
};

/**
 * Billing access middleware
 * Ensures user has billing permissions (admin or billing role)
 */
export const requireBillingAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user && !req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const role = req.user?.role || req.auth?.orgRole;
    if (!role || !["admin", "owner", "billing"].includes(role)) {
      res.status(403).json({ error: "Billing access required" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "Authorization check failed" });
  }
};

/**
 * Extract organization ID from auth context
 */
export const getOrganizationId = (req: Request): string => {
  const orgId = req.user?.organizationId || req.auth?.orgId;

  if (!orgId) {
    throw new Error("Organization context required");
  }

  return orgId;
};

/**
 * Extract user ID from auth context
 */
export const getUserId = (req: Request): string => {
  const userId = req.user?.id || req.auth?.userId;

  if (!userId) {
    throw new Error("User authentication required");
  }

  return userId;
};
