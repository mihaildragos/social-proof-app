import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";
import {
  ServiceAuthService,
  ServiceScope,
  ServiceJWTPayload,
  AuthenticatedServiceRequest,
  createServiceClient,
} from "../../auth/service-auth";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  getContextLogger: jest.fn(() => ({
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

describe("ServiceAuthService", () => {
  let serviceAuth: ServiceAuthService;
  let mockReq: Partial<AuthenticatedServiceRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const testSecret = "test-service-secret";
  const testIssuer = "test-services";
  const testAudience = "test-api";

  beforeEach(() => {
    serviceAuth = new ServiceAuthService(testSecret, testIssuer, testAudience);
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

  describe("ServiceScope Constants", () => {
    it("should have all required service scopes defined", () => {
      expect(ServiceScope.USER_READ).toBe("user:read");
      expect(ServiceScope.NOTIFICATION_WRITE).toBe("notification:write");
      expect(ServiceScope.ANALYTICS_READ).toBe("analytics:read");
      expect(ServiceScope.INTEGRATION_WEBHOOK).toBe("integration:webhook");
      expect(ServiceScope.BILLING_READ).toBe("billing:read");
      expect(ServiceScope.STREAM_PUBLISH).toBe("stream:publish");
    });
  });

  describe("generateServiceToken", () => {
    it("should generate a valid service token for users service", () => {
      const token = serviceAuth.generateServiceToken("users");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = jwt.decode(token) as ServiceJWTPayload;
      expect(decoded.sub).toBe("users");
      expect(decoded.iss).toBe(testIssuer);
      expect(decoded.aud).toBe(testAudience);
      expect(decoded.scope).toContain(ServiceScope.USER_READ);
      expect(decoded.scope).toContain(ServiceScope.USER_WRITE);
      expect(decoded.scope).toContain(ServiceScope.ANALYTICS_WRITE);
    });

    it("should generate a valid service token for notifications service", () => {
      const token = serviceAuth.generateServiceToken("notifications");
      expect(token).toBeDefined();

      const decoded = jwt.decode(token) as ServiceJWTPayload;
      expect(decoded.sub).toBe("notifications");
      expect(decoded.scope).toContain(ServiceScope.NOTIFICATION_READ);
      expect(decoded.scope).toContain(ServiceScope.NOTIFICATION_WRITE);
      expect(decoded.scope).toContain(ServiceScope.USER_READ);
      expect(decoded.scope).toContain(ServiceScope.STREAM_PUBLISH);
    });

    it("should generate a valid service token for integrations service", () => {
      const token = serviceAuth.generateServiceToken("integrations");
      expect(token).toBeDefined();

      const decoded = jwt.decode(token) as ServiceJWTPayload;
      expect(decoded.sub).toBe("integrations");
      expect(decoded.scope).toContain(ServiceScope.INTEGRATION_READ);
      expect(decoded.scope).toContain(ServiceScope.INTEGRATION_WEBHOOK);
      expect(decoded.scope).toContain(ServiceScope.NOTIFICATION_WRITE);
    });

    it("should generate token with proper expiration (1 hour)", () => {
      const token = serviceAuth.generateServiceToken("users");
      const decoded = jwt.decode(token) as ServiceJWTPayload;

      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + 60 * 60; // 1 hour

      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5); // Allow 5 second tolerance
    });

    it("should return empty scope for unknown service", () => {
      const token = serviceAuth.generateServiceToken("unknown-service");
      const decoded = jwt.decode(token) as ServiceJWTPayload;

      expect(decoded.sub).toBe("unknown-service");
      expect(decoded.scope).toEqual([]);
    });
  });

  describe("verifyServiceToken", () => {
    it("should verify a valid service token", () => {
      const token = serviceAuth.generateServiceToken("users");
      const result = serviceAuth.verifyServiceToken(token);

      expect(result).toBeDefined();
      expect(result?.sub).toBe("users");
      expect(result?.scope).toContain(ServiceScope.USER_READ);
    });

    it("should return null for invalid token", () => {
      const result = serviceAuth.verifyServiceToken("invalid.token");
      expect(result).toBeNull();
    });

    it("should return null for token with wrong secret", () => {
      const wrongToken = jwt.sign({ sub: "users", scope: ["user:read"] }, "wrong-secret");
      const result = serviceAuth.verifyServiceToken(wrongToken);
      expect(result).toBeNull();
    });

    it("should return null for expired token", () => {
      const expiredToken = jwt.sign(
        {
          sub: "users",
          scope: ["user:read"],
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        testSecret
      );
      const result = serviceAuth.verifyServiceToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe("verifyServiceAuth middleware", () => {
    it("should authenticate valid service token via X-Service-Auth header", () => {
      const token = serviceAuth.generateServiceToken("users");
      mockReq.headers = { "x-service-auth": `Bearer ${token}` };

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.service).toBeDefined();
      expect(mockReq.service?.name).toBe("users");
      expect(mockReq.service?.scope).toContain(ServiceScope.USER_READ);
      expect(mockReq.serviceToken).toBe(token);
    });

    it("should authenticate valid service token via Authorization header", () => {
      const token = serviceAuth.generateServiceToken("notifications");
      mockReq.headers = { authorization: `Bearer ${token}` };

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.service?.name).toBe("notifications");
    });

    it("should handle token without Bearer prefix", () => {
      const token = serviceAuth.generateServiceToken("users");
      mockReq.headers = { "x-service-auth": token };

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.service?.name).toBe("users");
    });

    it("should reject request with no auth header", () => {
      mockReq.headers = {};

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Service authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with empty token", () => {
      mockReq.headers = { "x-service-auth": "" };

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Service authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid token", () => {
      mockReq.headers = { "x-service-auth": "Bearer invalid.token" };

      serviceAuth.verifyServiceAuth(
        mockReq as AuthenticatedServiceRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid service token" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireServiceScope middleware", () => {
    beforeEach(() => {
      mockReq.service = {
        name: "users",
        scope: [ServiceScope.USER_READ, ServiceScope.USER_WRITE, ServiceScope.ANALYTICS_WRITE],
      };
    });

    it("should allow access when service has required scope", () => {
      const middleware = serviceAuth.requireServiceScope(ServiceScope.USER_READ);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny access when service lacks required scope", () => {
      const middleware = serviceAuth.requireServiceScope(ServiceScope.BILLING_READ);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Insufficient service permissions" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny access when no service in request", () => {
      mockReq.service = undefined;
      const middleware = serviceAuth.requireServiceScope(ServiceScope.USER_READ);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Service authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAnyServiceScope middleware", () => {
    beforeEach(() => {
      mockReq.service = {
        name: "notifications",
        scope: [
          ServiceScope.NOTIFICATION_READ,
          ServiceScope.USER_READ,
          ServiceScope.STREAM_PUBLISH,
        ],
      };
    });

    it("should allow access when service has any of the required scopes", () => {
      const scopes = [ServiceScope.BILLING_READ, ServiceScope.USER_READ];
      const middleware = serviceAuth.requireAnyServiceScope(scopes);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny access when service has none of the required scopes", () => {
      const scopes = [ServiceScope.BILLING_READ, ServiceScope.INTEGRATION_WEBHOOK];
      const middleware = serviceAuth.requireAnyServiceScope(scopes);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Insufficient service permissions" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny access when no service in request", () => {
      mockReq.service = undefined;
      const scopes = [ServiceScope.USER_READ];
      const middleware = serviceAuth.requireAnyServiceScope(scopes);

      middleware(mockReq as AuthenticatedServiceRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Service authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("getAuthenticatedHttpClient", () => {
    it("should return client with proper headers and token", () => {
      const client = serviceAuth.getAuthenticatedHttpClient("users");

      expect(client.headers).toBeDefined();
      expect(client.headers["X-Service-Auth"]).toMatch(/^Bearer .+/);
      expect(client.headers["Content-Type"]).toBe("application/json");
      expect(client.token).toBeDefined();

      // Verify token is valid
      const decoded = jwt.decode(client.token) as ServiceJWTPayload;
      expect(decoded.sub).toBe("users");
    });
  });

  describe("utility methods", () => {
    it("should validate known service names", () => {
      expect(serviceAuth.isValidService("users")).toBe(true);
      expect(serviceAuth.isValidService("notifications")).toBe(true);
      expect(serviceAuth.isValidService("analytics")).toBe(true);
      expect(serviceAuth.isValidService("integrations")).toBe(true);
      expect(serviceAuth.isValidService("billing")).toBe(true);
      expect(serviceAuth.isValidService("notification-stream-service")).toBe(true);
    });

    it("should reject unknown service names", () => {
      expect(serviceAuth.isValidService("unknown")).toBe(false);
      expect(serviceAuth.isValidService("")).toBe(false);
      expect(serviceAuth.isValidService("USERS")).toBe(false);
    });

    it("should return correct scopes for each service", () => {
      const userScopes = serviceAuth.getServiceScopes("users");
      expect(userScopes).toContain(ServiceScope.USER_READ);
      expect(userScopes).toContain(ServiceScope.USER_WRITE);
      expect(userScopes).toContain(ServiceScope.ANALYTICS_WRITE);

      const notificationScopes = serviceAuth.getServiceScopes("notifications");
      expect(notificationScopes).toContain(ServiceScope.NOTIFICATION_READ);
      expect(notificationScopes).toContain(ServiceScope.STREAM_PUBLISH);

      const unknownScopes = serviceAuth.getServiceScopes("unknown");
      expect(unknownScopes).toEqual([]);
    });

    it("should check service scope correctly", () => {
      expect(serviceAuth.serviceHasScope("users", ServiceScope.USER_READ)).toBe(true);
      expect(serviceAuth.serviceHasScope("users", ServiceScope.BILLING_READ)).toBe(false);
      expect(serviceAuth.serviceHasScope("notifications", ServiceScope.NOTIFICATION_WRITE)).toBe(
        true
      );
      expect(serviceAuth.serviceHasScope("unknown", ServiceScope.USER_READ)).toBe(false);
    });
  });

  describe("constructor", () => {
    it("should use environment variables when provided", () => {
      process.env.SERVICE_JWT_SECRET = "env-service-secret";
      process.env.JWT_ISSUER = "env-services";
      process.env.JWT_AUDIENCE = "env-api";

      const service = new ServiceAuthService();
      const token = service.generateServiceToken("users");
      const decoded = jwt.decode(token) as ServiceJWTPayload;

      expect(decoded.iss).toBe("env-services");
      expect(decoded.aud).toBe("env-api");

      // Clean up
      delete process.env.SERVICE_JWT_SECRET;
      delete process.env.JWT_ISSUER;
      delete process.env.JWT_AUDIENCE;
    });

    it("should fall back to JWT_SECRET when SERVICE_JWT_SECRET is not provided", () => {
      process.env.JWT_SECRET = "fallback-secret";

      const service = new ServiceAuthService();
      const token = service.generateServiceToken("users");

      // Should not throw error, indicating secret was used
      expect(token).toBeDefined();

      delete process.env.JWT_SECRET;
    });

    it("should use default values when no environment variables provided", () => {
      const service = new ServiceAuthService();
      const token = service.generateServiceToken("users");
      const decoded = jwt.decode(token) as ServiceJWTPayload;

      expect(decoded.iss).toBe("social-proof-services");
      expect(decoded.aud).toBe("social-proof-api");
    });
  });
});

describe("createServiceClient", () => {
  it("should create client for valid service", () => {
    const client = createServiceClient("users");

    expect(client.headers).toBeDefined();
    expect(client.headers["X-Service-Auth"]).toMatch(/^Bearer .+/);
    expect(client.token).toBeDefined();
  });

  it("should throw error for invalid service", () => {
    expect(() => createServiceClient("invalid-service")).toThrow(
      "Invalid service name: invalid-service"
    );
  });
});

describe("Service Scope Mappings", () => {
  it("should ensure users service has appropriate scopes", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("users");

    expect(scopes).toContain(ServiceScope.USER_READ);
    expect(scopes).toContain(ServiceScope.USER_WRITE);
    expect(scopes).toContain(ServiceScope.USER_DELETE);
    expect(scopes).toContain(ServiceScope.ANALYTICS_WRITE);
    expect(scopes).not.toContain(ServiceScope.BILLING_READ);
  });

  it("should ensure notifications service has cross-service access", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("notifications");

    expect(scopes).toContain(ServiceScope.NOTIFICATION_READ);
    expect(scopes).toContain(ServiceScope.NOTIFICATION_WRITE);
    expect(scopes).toContain(ServiceScope.USER_READ); // Cross-service
    expect(scopes).toContain(ServiceScope.ANALYTICS_WRITE); // Cross-service
    expect(scopes).toContain(ServiceScope.STREAM_PUBLISH); // Cross-service
  });

  it("should ensure integrations service can create notifications", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("integrations");

    expect(scopes).toContain(ServiceScope.INTEGRATION_READ);
    expect(scopes).toContain(ServiceScope.INTEGRATION_WEBHOOK);
    expect(scopes).toContain(ServiceScope.NOTIFICATION_WRITE); // Can create notifications
    expect(scopes).toContain(ServiceScope.USER_READ); // Can read user data
    expect(scopes).toContain(ServiceScope.STREAM_PUBLISH); // Can publish events
  });

  it("should ensure analytics service has read access to other services", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("analytics");

    expect(scopes).toContain(ServiceScope.ANALYTICS_READ);
    expect(scopes).toContain(ServiceScope.ANALYTICS_WRITE);
    expect(scopes).toContain(ServiceScope.USER_READ); // Cross-service read
    expect(scopes).toContain(ServiceScope.NOTIFICATION_READ); // Cross-service read
    expect(scopes).not.toContain(ServiceScope.USER_WRITE); // No write access
  });

  it("should ensure billing service has limited but necessary access", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("billing");

    expect(scopes).toContain(ServiceScope.BILLING_READ);
    expect(scopes).toContain(ServiceScope.BILLING_WRITE);
    expect(scopes).toContain(ServiceScope.USER_READ); // Can read user data
    expect(scopes).toContain(ServiceScope.ANALYTICS_WRITE); // Can write analytics
    expect(scopes).not.toContain(ServiceScope.NOTIFICATION_WRITE); // No notification access
  });

  it("should ensure notification-stream-service has streaming capabilities", () => {
    const serviceAuth = new ServiceAuthService();
    const scopes = serviceAuth.getServiceScopes("notification-stream-service");

    expect(scopes).toContain(ServiceScope.STREAM_READ);
    expect(scopes).toContain(ServiceScope.STREAM_WRITE);
    expect(scopes).toContain(ServiceScope.STREAM_PUBLISH);
    expect(scopes).toContain(ServiceScope.NOTIFICATION_READ); // Can read notifications
    expect(scopes).toContain(ServiceScope.USER_READ); // Can read user data
    expect(scopes).toContain(ServiceScope.ANALYTICS_WRITE); // Can write analytics
  });
});
