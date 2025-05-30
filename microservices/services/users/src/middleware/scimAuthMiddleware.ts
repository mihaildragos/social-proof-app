import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { UnauthorizedError } from "./errorHandler";
import { prisma } from "../lib/prisma";

/**
 * Middleware to authenticate SCIM requests using bearer token
 * Adds organizationId to the request object for downstream handlers
 */
export const scimAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw UnauthorizedError("Missing token in Authorization header");
    }

    // Look up the token in the database using Prisma
    const scimToken = await prisma.scimToken.findFirst({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!scimToken) {
      throw UnauthorizedError("Invalid SCIM token");
    }

    // Check if token is active
    if (!scimToken.isActive) {
      throw UnauthorizedError("SCIM token is inactive");
    }

    // Check if token has expired
    if (scimToken.expiresAt && scimToken.expiresAt < new Date()) {
      throw UnauthorizedError("SCIM token has expired");
    }

    // Add organization ID to request for downstream handlers
    req.organizationId = scimToken.organizationId;

    // Update last used timestamp
    await prisma.scimToken.update({
      where: { id: scimToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Log SCIM API usage
    logger.info("SCIM API request", {
      method: req.method,
      path: req.path,
      organizationId: req.organizationId,
    });

    // Create audit log entry
    await prisma.scimAuditLog.create({
      data: {
        organizationId: req.organizationId,
        operation: req.method,
        resourceType:
          req.path.includes("/Users") ? "User"
          : req.path.includes("/Groups") ? "Group"
          : "Other",
        resourceId: req.params.id || "list",
        performedBy: `SCIM Token (${scimToken.id})`,
        requestPayload: req.method !== "GET" ? JSON.stringify(req.body) : null,
        createdAt: new Date(),
      },
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Extend Express Request interface to include organizationId
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}
