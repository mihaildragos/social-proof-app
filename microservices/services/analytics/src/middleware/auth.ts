import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization token required" });
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      res.status(401).json({ error: "Authorization token required" });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      req.user = {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        organizationId: decoded.organizationId || decoded.org_id,
        role: decoded.role || "user",
      };
      
      next();
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
    return;
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      req.user = {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        organizationId: decoded.organizationId || decoded.org_id,
        role: decoded.role || "user",
      };
    } catch (jwtError) {
      // Ignore JWT errors for optional auth
      console.warn("Optional auth JWT error:", jwtError);
    }
    
    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.role !== requiredRole && req.user.role !== "admin") {
      res.status(403).json({ error: `${requiredRole} role required` });
      return;
    }

    next();
  };
};

export const requireAnyRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role) && req.user.role !== "admin") {
      res.status(403).json({ error: `One of the following roles required: ${roles.join(", ")}` });
      return;
    }

    next();
  };
}; 