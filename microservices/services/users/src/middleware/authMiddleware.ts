import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { UnauthorizedError } from "./errorHandler";
import { logger } from "../utils/logger";

// Extend the Express Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationId?: string;
        role?: string;
        permissions?: string[];
      };
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw UnauthorizedError("Missing token");
    }

    // Verify the token
    const payload = await verifyToken(token);

    // Add user info to request object
    req.user = {
      id: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
      role: payload.role,
      permissions: (payload.permissions as string[]) || [],
    };

    next();
  } catch (error) {
    logger.warn("Authentication failed", {
      error: (error as Error).message,
      path: req.path,
    });
    next(UnauthorizedError("Authentication failed"));
  }
};

/**
 * Middleware that allows a request to proceed with or without authentication
 * If a valid token is provided, it sets the user on the request object,
 * but does not fail if no token or an invalid token is provided.
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      if (token) {
        try {
          // Verify the token
          const payload = await verifyToken(token);

          // Add user info to request object
          req.user = {
            id: payload.userId,
            email: payload.email,
            organizationId: payload.organizationId,
            role: payload.role,
            permissions: (payload.permissions as string[]) || [],
          };
        } catch (error) {
          // Log but don't fail
          logger.debug("Optional auth token invalid", {
            error: (error as Error).message,
          });
        }
      }
    }

    next();
  } catch (error) {
    // Should never happen with the try/catch inside, but just in case
    logger.error("Error in optional auth middleware", {
      error: (error as Error).message,
    });
    next();
  }
};

/**
 * Middleware to check if the user has the required permissions
 */
export const requirePermission = (requiredPermissions: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Check if user exists
      if (!req.user) {
        throw UnauthorizedError("Authentication required");
      }

      // Admin role has all permissions
      if (req.user.role === "admin" || req.user.role === "owner") {
        return next();
      }

      // Convert single permission to array
      const permissions =
        Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

      // Check if user has at least one of the required permissions
      const hasPermission = permissions.some((permission) =>
        req.user?.permissions?.includes(permission)
      );

      if (!hasPermission) {
        throw UnauthorizedError("Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
