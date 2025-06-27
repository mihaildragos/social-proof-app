import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";
import { AuthMiddleware, JWTPayload, AuthenticatedRequest } from "../../middleware/auth";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  getContextLogger: jest.fn(() => ({
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

describe("AuthMiddleware", () => {
  let authMiddleware: AuthMiddleware;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const testSecret = "test-secret";
  const testIssuer = "test-issuer";
  const testAudience = "test-audience";

  beforeEach(() => {
    authMiddleware = new AuthMiddleware(testSecret, testIssuer, testAudience);
    mockReq = {
      headers: {},
      path: "/test",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateToken", () => {
    it("should generate a valid JWT token", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read", "user:write"],
      };

      const token = authMiddleware.generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify token structure
      const decoded = jwt.decode(token) as JWTPayload;
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.organizationId).toBe(payload.organizationId);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.permissions).toEqual(payload.permissions);
      expect(decoded.iss).toBe(testIssuer);
      expect(decoded.aud).toBe(testAudience);
    });

    it("should generate tokens with proper expiration", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      const decoded = jwt.decode(token) as JWTPayload;

      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + 24 * 60 * 60; // 24 hours

      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5); // Allow 5 second tolerance
    });
  });

  describe("verifyToken", () => {
    it("should successfully verify a valid token", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read", "user:write"],
      };

      const token = authMiddleware.generateToken(payload);
      mockReq.headers = { authorization: `Bearer ${token}` };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe(payload.sub);
      expect(mockReq.user?.email).toBe(payload.email);
      expect(mockReq.user?.organizationId).toBe(payload.organizationId);
      expect(mockReq.user?.role).toBe(payload.role);
      expect(mockReq.user?.permissions).toEqual(payload.permissions);
      expect(mockReq.token).toBe(token);
    });

    it("should handle missing authorization header", () => {
      mockReq.headers = {};

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "No authorization header provided" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle empty authorization header", () => {
      mockReq.headers = { authorization: "" };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "No token provided" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle Bearer token format", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      mockReq.headers = { authorization: `Bearer ${token}` };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    it("should handle token without Bearer prefix", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      mockReq.headers = { authorization: token };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    it("should handle invalid token signature", () => {
      const invalidToken = jwt.sign({ sub: "user123", email: "test@example.com" }, "wrong-secret");
      mockReq.headers = { authorization: `Bearer ${invalidToken}` };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle expired token", () => {
      const expiredToken = jwt.sign(
        {
          sub: "user123",
          email: "test@example.com",
          organizationId: "org123",
          role: "admin",
          permissions: ["user:read"],
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        testSecret,
        { issuer: testIssuer, audience: testAudience }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Token expired" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle malformed token", () => {
      mockReq.headers = { authorization: "Bearer invalid.token.format" };

      authMiddleware.verifyToken(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("should proceed without authentication when no header provided", () => {
      mockReq.headers = {};

      authMiddleware.optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it("should verify token when authorization header is provided", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      mockReq.headers = { authorization: `Bearer ${token}` };

      authMiddleware.optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe("refreshTokenIfNeeded", () => {
    it("should return null for token with more than 1 hour remaining", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      const refreshedToken = authMiddleware.refreshTokenIfNeeded(token);

      expect(refreshedToken).toBeNull();
    });

    it("should return new token for token expiring within 1 hour", () => {
      // Create a token that expires in 30 minutes
      const shortLivedToken = jwt.sign(
        {
          sub: "user123",
          email: "test@example.com",
          organizationId: "org123",
          role: "admin",
          permissions: ["user:read"],
          exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        },
        testSecret,
        { issuer: testIssuer, audience: testAudience }
      );

      const refreshedToken = authMiddleware.refreshTokenIfNeeded(shortLivedToken);

      expect(refreshedToken).toBeDefined();
      expect(refreshedToken).not.toBe(shortLivedToken);

      if (refreshedToken) {
        const decoded = jwt.decode(refreshedToken) as JWTPayload;
        expect(decoded.sub).toBe("user123");
        expect(decoded.email).toBe("test@example.com");
      }
    });

    it("should handle invalid token gracefully", () => {
      const refreshedToken = authMiddleware.refreshTokenIfNeeded("invalid.token");

      expect(refreshedToken).toBeNull();
    });
  });

  describe("validateToken", () => {
    it("should return decoded payload for valid token", () => {
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = authMiddleware.generateToken(payload);
      const result = authMiddleware.validateToken(token);

      expect(result).toBeDefined();
      expect(result?.sub).toBe(payload.sub);
      expect(result?.email).toBe(payload.email);
    });

    it("should return null for invalid token", () => {
      const result = authMiddleware.validateToken("invalid.token");

      expect(result).toBeNull();
    });

    it("should return null for expired token", () => {
      const expiredToken = jwt.sign(
        {
          sub: "user123",
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        testSecret
      );

      const result = authMiddleware.validateToken(expiredToken);

      expect(result).toBeNull();
    });
  });

  describe("constructor", () => {
    it("should use environment variables when provided", () => {
      process.env.JWT_SECRET = "env-secret";
      process.env.JWT_ISSUER = "env-issuer";
      process.env.JWT_AUDIENCE = "env-audience";

      const middleware = new AuthMiddleware();

      // Test by generating and verifying a token
      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = middleware.generateToken(payload);
      const decoded = jwt.decode(token) as JWTPayload;

      expect(decoded.iss).toBe("env-issuer");
      expect(decoded.aud).toBe("env-audience");

      // Clean up
      delete process.env.JWT_SECRET;
      delete process.env.JWT_ISSUER;
      delete process.env.JWT_AUDIENCE;
    });

    it("should use default values when environment variables are not provided", () => {
      const middleware = new AuthMiddleware();

      const payload: Omit<JWTPayload, "iat" | "exp" | "iss" | "aud"> = {
        sub: "user123",
        email: "test@example.com",
        organizationId: "org123",
        role: "admin",
        permissions: ["user:read"],
      };

      const token = middleware.generateToken(payload);
      const decoded = jwt.decode(token) as JWTPayload;

      expect(decoded.iss).toBe("social-proof-app");
      expect(decoded.aud).toBe("social-proof-api");
    });
  });
});
