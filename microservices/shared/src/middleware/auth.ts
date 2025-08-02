import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getContextLogger } from "../../utils/logger";

const logger = getContextLogger({ service: "auth-middleware" });

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
    permissions: string[];
  };
  token?: string;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  organizationId: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export class AuthMiddleware {
  private jwtSecret: string;
  private jwtIssuer: string;
  private jwtAudience: string;

  constructor(
    jwtSecret: string = process.env.JWT_SECRET || "default-secret",
    jwtIssuer: string = process.env.JWT_ISSUER || "social-proof-app",
    jwtAudience: string = process.env.JWT_AUDIENCE || "social-proof-api"
  ) {
    this.jwtSecret = jwtSecret;
    this.jwtIssuer = jwtIssuer;
    this.jwtAudience = jwtAudience;
  }

  /**
   * Middleware to verify JWT token and extract user information
   */
  verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader === undefined) {
        logger.warn("No authorization header provided", { path: req.path });
        res.status(401).json({ error: "No authorization header provided" });
        return;
      }

      if (!authHeader || authHeader.trim() === "") {
        logger.warn("Empty authorization header provided", { path: req.path });
        res.status(401).json({ error: "No token provided" });
        return;
      }

      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

      if (!token || token.trim() === "") {
        logger.warn("No token provided in authorization header", { path: req.path });
        res.status(401).json({ error: "No token provided" });
        return;
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      }) as JWTPayload;

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        organizationId: decoded.organizationId,
        role: decoded.role,
        permissions: decoded.permissions,
      };
      req.token = token;

      logger.debug("Token verified successfully", {
        userId: decoded.sub,
        role: decoded.role,
        path: req.path,
      });

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn("JWT token expired", { path: req.path });
        res.status(401).json({ error: "Token expired" });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("Invalid JWT token", { error: (error as Error).message, path: req.path });
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      logger.error("Token verification failed", {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });
      res.status(500).json({ error: "Authentication failed" });
    }
  };

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    this.verifyToken(req, res, next);
  };

  /**
   * Generate JWT token for user
   */
  generateToken(payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud">): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: "24h",
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    });
  }

  /**
   * Refresh token if it's close to expiry
   */
  refreshTokenIfNeeded(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;

      // Refresh if token expires in less than 1 hour
      if (timeUntilExpiry < 3600) {
        return this.generateToken({
          sub: decoded.sub,
          email: decoded.email,
          organizationId: decoded.organizationId,
          role: decoded.role,
          permissions: decoded.permissions,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to refresh token", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Validate token without throwing errors
   */
  validateToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      }) as JWTPayload;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();
