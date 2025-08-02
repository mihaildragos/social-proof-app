import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { verify } from "jsonwebtoken";
import { UnauthorizedError } from "./errorHandler";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { generateToken, generateRefreshToken, blacklistToken } from "../utils/jwt";

/**
 * Middleware to manage user sessions
 */
export const sessionManager = {
  /**
   * Create a new session for a user
   */
  createSession: async (req: Request, res: Response, userId: string) => {
    try {
      // Generate a session ID
      const sessionId = randomUUID();

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Get organization info if the user belongs to one
      const orgMember = await prisma.organizationMember.findFirst({
        where: {
          userId: userId,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { organizationId: true, role: true },
      });

      // Get user permissions
      const permissions = await prisma.userPermission.findMany({
        where: {
          userId: userId,
        },
        select: {
          permission: {
            select: { name: true },
          },
        },
      });

      const permissionNames = permissions.map(
        (p: { permission: { name: any } }) => p.permission.name
      );

      // Create a new session record
      await prisma.userSession.create({
        data: {
          id: sessionId,
          userId: userId,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          isActive: true,
          organizationId: orgMember?.organizationId,
          lastActivity: new Date(),
        },
      });

      // Generate access token
      const accessToken = await generateToken({
        userId,
        email: user.email,
        organizationId: orgMember?.organizationId,
        role: orgMember?.role || user.role,
        permissions: permissionNames,
        sessionId,
      });

      // Generate refresh token
      const refreshToken = await generateRefreshToken(userId, sessionId);

      // Set tokens in cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: parseInt(process.env.TOKEN_EXPIRY || "86400", 10) * 1000,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/auth/refresh",
        maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRY || "2592000", 10) * 1000,
      });

      // Return tokens for API usage
      return {
        accessToken,
        refreshToken,
        expiresIn: parseInt(process.env.TOKEN_EXPIRY || "86400", 10),
      };
    } catch (error) {
      logger.error("Failed to create session", {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  },

  /**
   * Validate a session
   */
  validateSession: async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Get token from cookies or Authorization header
      let token = req.cookies?.accessToken;

      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.split(" ")[1];
        }
      }

      if (!token) {
        throw UnauthorizedError("Authentication required");
      }

      // Verify token
      const payload = verify(token, process.env.JWT_SECRET as string) as any;

      // Check if session exists and is active
      if (payload.sessionId) {
        const session = await prisma.userSession.findUnique({
          where: { id: payload.sessionId },
          select: { isActive: true },
        });

        if (!session || !session.isActive) {
          throw UnauthorizedError("Session expired or invalid");
        }

        // Update last activity time
        await prisma.userSession.update({
          where: { id: payload.sessionId },
          data: { lastActivity: new Date() },
        });
      }

      // Set user info on request
      req.user = {
        id: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role,
        permissions: payload.permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Refresh a session with a new access token
   */
  refreshSession: async (req: Request, res: Response) => {
    try {
      // Get refresh token from cookies or request body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw UnauthorizedError("Refresh token required");
      }

      // Verify refresh token
      const { userId, sessionId } = verify(
        refreshToken,
        process.env.JWT_SECRET as string
      ) as any as {
        userId: string;
        sessionId: string;
      };

      // Check if session exists and is active
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { isActive: true, organizationId: true },
      });

      if (!session || !session.isActive) {
        throw UnauthorizedError("Session expired or invalid");
      }

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      });

      if (!user) {
        throw UnauthorizedError("User not found");
      }

      // Get organization role
      const orgMember = await prisma.organizationMember.findFirst({
        where: {
          userId: userId,
          organizationId: session.organizationId,
        },
        select: { role: true },
      });

      // Get user permissions
      const permissions = await prisma.userPermission.findMany({
        where: {
          userId: userId,
        },
        select: {
          permission: {
            select: { name: true },
          },
        },
      });

      const permissionNames = permissions.map(
        (p: { permission: { name: any } }) => p.permission.name
      );

      // Generate new access token
      const accessToken = await generateToken({
        userId,
        email: user.email,
        organizationId: session.organizationId,
        role: orgMember?.role || user.role,
        permissions: permissionNames,
        sessionId,
      });

      // Update session last activity
      await prisma.userSession.update({
        where: { id: sessionId },
        data: { lastActivity: new Date() },
      });

      // Set new access token in cookie
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: parseInt(process.env.TOKEN_EXPIRY || "86400", 10) * 1000,
      });

      // Return new access token
      return {
        accessToken,
        expiresIn: parseInt(process.env.TOKEN_EXPIRY || "86400", 10),
      };
    } catch (error) {
      logger.error("Failed to refresh session", {
        error: (error as Error).message,
      });
      throw error;
    }
  },

  /**
   * End a session (logout)
   */
  endSession: async (req: Request, res: Response) => {
    try {
      // Get token from cookies or Authorization header
      let token = req.cookies?.accessToken;

      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.split(" ")[1];
        }
      }

      if (token) {
        try {
          // Verify token
          const payload = verify(token, process.env.JWT_SECRET as string) as any;

          // Add token to blacklist
          if (payload.exp) {
            await blacklistToken(payload.jti as string, payload.exp);
          }

          // Deactivate session
          if (payload.sessionId) {
            await prisma.userSession.update({
              where: { id: payload.sessionId },
              data: { isActive: false, endedAt: new Date() },
            });
          }
        } catch (error) {
          // Continue even if token verification fails
          logger.warn("Failed to verify token during logout", {
            error: (error as Error).message,
          });
        }
      }

      // Clear cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken", { path: "/auth/refresh" });

      return { success: true };
    } catch (error) {
      logger.error("Failed to end session", {
        error: (error as Error).message,
      });
      throw error;
    }
  },
};
