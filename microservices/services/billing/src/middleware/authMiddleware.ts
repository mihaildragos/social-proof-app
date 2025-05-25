import { Request, Response, NextFunction } from "express";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import { logger } from "../utils/logger";
import { UnauthorizedError, ForbiddenError } from "./errorHandler";

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
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
    logger.error("Authentication error", { error });
    throw new UnauthorizedError("Authentication required");
  },
});

/**
 * Organization membership middleware
 * Ensures user belongs to the organization they're trying to access
 */
export const requireOrganization = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.auth || {};
    const { organizationId } = req.params;

    if (!orgId) {
      throw new ForbiddenError("Organization membership required");
    }

    if (organizationId && orgId !== organizationId) {
      throw new ForbiddenError("Access denied to this organization");
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Admin role middleware
 * Ensures user has admin role in the organization
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgRole } = req.auth || {};

    if (!orgRole || !["admin", "owner"].includes(orgRole)) {
      throw new ForbiddenError("Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Billing access middleware
 * Ensures user has billing permissions (admin or billing role)
 */
export const requireBillingAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgRole } = req.auth || {};

    if (!orgRole || !["admin", "owner", "billing"].includes(orgRole)) {
      throw new ForbiddenError("Billing access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Extract organization ID from auth context
 */
export const getOrganizationId = (req: Request): string => {
  const { orgId } = req.auth || {};

  if (!orgId) {
    throw new ForbiddenError("Organization context required");
  }

  return orgId;
};

/**
 * Extract user ID from auth context
 */
export const getUserId = (req: Request): string => {
  const { userId } = req.auth || {};

  if (!userId) {
    throw new UnauthorizedError("User authentication required");
  }

  return userId;
};
