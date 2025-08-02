import { Response, NextFunction } from "express";
import {
  Role,
  Permission,
  RBACService,
  requirePermission,
  requireRole,
  requireAnyPermission,
} from "../../auth/rbac";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  getContextLogger: jest.fn(() => ({
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

describe("RBACService", () => {
  describe("Role and Permission Constants", () => {
    it("should have all required roles defined", () => {
      expect(Role.ADMIN).toBe("admin");
      expect(Role.ANALYST).toBe("analyst");
      expect(Role.DESIGNER).toBe("designer");
    });

    it("should have all required permissions defined", () => {
      expect(Permission.USER_CREATE).toBe("user:create");
      expect(Permission.USER_READ).toBe("user:read");
      expect(Permission.NOTIFICATION_CREATE).toBe("notification:create");
      expect(Permission.ANALYTICS_READ).toBe("analytics:read");
      expect(Permission.BILLING_UPDATE).toBe("billing:update");
    });
  });

  describe("getPermissionsForRole", () => {
    it("should return all permissions for admin role", () => {
      const permissions = RBACService.getPermissionsForRole(Role.ADMIN);

      expect(permissions).toContain(Permission.USER_CREATE);
      expect(permissions).toContain(Permission.USER_DELETE);
      expect(permissions).toContain(Permission.NOTIFICATION_CREATE);
      expect(permissions).toContain(Permission.BILLING_UPDATE);
      expect(permissions).toContain(Permission.TEAM_INVITE);
      expect(permissions.length).toBeGreaterThan(20); // Admin should have many permissions
    });

    it("should return limited permissions for analyst role", () => {
      const permissions = RBACService.getPermissionsForRole(Role.ANALYST);

      expect(permissions).toContain(Permission.USER_READ);
      expect(permissions).toContain(Permission.ANALYTICS_READ);
      expect(permissions).toContain(Permission.AB_TEST_CREATE);
      expect(permissions).not.toContain(Permission.USER_DELETE);
      expect(permissions).not.toContain(Permission.BILLING_UPDATE);
      expect(permissions).not.toContain(Permission.TEAM_INVITE);
    });

    it("should return design-focused permissions for designer role", () => {
      const permissions = RBACService.getPermissionsForRole(Role.DESIGNER);

      expect(permissions).toContain(Permission.NOTIFICATION_CREATE);
      expect(permissions).toContain(Permission.TEMPLATE_CREATE);
      expect(permissions).toContain(Permission.TEMPLATE_UPDATE);
      expect(permissions).not.toContain(Permission.USER_DELETE);
      expect(permissions).not.toContain(Permission.BILLING_READ);
      expect(permissions).not.toContain(Permission.TEAM_INVITE);
    });
  });

  describe("hasPermission", () => {
    it("should return true when role has the permission", () => {
      const result = RBACService.hasPermission(Role.ADMIN, Permission.USER_CREATE);
      expect(result).toBe(true);
    });

    it("should return false when role does not have the permission", () => {
      const result = RBACService.hasPermission(Role.DESIGNER, Permission.USER_DELETE);
      expect(result).toBe(false);
    });

    it("should handle analyst permissions correctly", () => {
      expect(RBACService.hasPermission(Role.ANALYST, Permission.ANALYTICS_READ)).toBe(true);
      expect(RBACService.hasPermission(Role.ANALYST, Permission.AB_TEST_CREATE)).toBe(true);
      expect(RBACService.hasPermission(Role.ANALYST, Permission.USER_DELETE)).toBe(false);
    });
  });

  describe("userHasPermission", () => {
    it("should return true for valid role with permission", () => {
      const result = RBACService.userHasPermission("admin", Permission.USER_CREATE);
      expect(result).toBe(true);
    });

    it("should return false for valid role without permission", () => {
      const result = RBACService.userHasPermission("designer", Permission.USER_DELETE);
      expect(result).toBe(false);
    });

    it("should return false for invalid role", () => {
      const result = RBACService.userHasPermission("invalid-role", Permission.USER_READ);
      expect(result).toBe(false);
    });

    it("should handle case sensitivity", () => {
      const result = RBACService.userHasPermission("ADMIN", Permission.USER_CREATE);
      expect(result).toBe(false); // Should be case sensitive
    });
  });

  describe("userHasAnyPermission", () => {
    it("should return true when user has at least one permission", () => {
      const permissions = [Permission.USER_DELETE, Permission.USER_READ];
      const result = RBACService.userHasAnyPermission("admin", permissions);
      expect(result).toBe(true);
    });

    it("should return false when user has none of the permissions", () => {
      const permissions = [Permission.USER_DELETE, Permission.BILLING_UPDATE];
      const result = RBACService.userHasAnyPermission("designer", permissions);
      expect(result).toBe(false);
    });

    it("should return true when designer has template permissions", () => {
      const permissions = [Permission.TEMPLATE_CREATE, Permission.USER_DELETE];
      const result = RBACService.userHasAnyPermission("designer", permissions);
      expect(result).toBe(true);
    });
  });

  describe("userHasAllPermissions", () => {
    it("should return true when user has all permissions", () => {
      const permissions = [Permission.USER_READ, Permission.USER_CREATE];
      const result = RBACService.userHasAllPermissions("admin", permissions);
      expect(result).toBe(true);
    });

    it("should return false when user is missing any permission", () => {
      const permissions = [Permission.USER_READ, Permission.USER_DELETE];
      const result = RBACService.userHasAllPermissions("designer", permissions);
      expect(result).toBe(false);
    });

    it("should return true for empty permission array", () => {
      const result = RBACService.userHasAllPermissions("designer", []);
      expect(result).toBe(true);
    });
  });

  describe("getUserPermissions", () => {
    it("should return all permissions for valid role", () => {
      const permissions = RBACService.getUserPermissions("admin");
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain(Permission.USER_CREATE);
    });

    it("should return empty array for invalid role", () => {
      const permissions = RBACService.getUserPermissions("invalid-role");
      expect(permissions).toEqual([]);
    });
  });

  describe("isValidRole", () => {
    it("should return true for valid roles", () => {
      expect(RBACService.isValidRole("admin")).toBe(true);
      expect(RBACService.isValidRole("analyst")).toBe(true);
      expect(RBACService.isValidRole("designer")).toBe(true);
    });

    it("should return false for invalid roles", () => {
      expect(RBACService.isValidRole("invalid")).toBe(false);
      expect(RBACService.isValidRole("ADMIN")).toBe(false);
      expect(RBACService.isValidRole("")).toBe(false);
    });
  });

  describe("getRoleHierarchy", () => {
    it("should return correct hierarchy values", () => {
      const hierarchy = RBACService.getRoleHierarchy();

      expect(hierarchy[Role.ADMIN]).toBe(3);
      expect(hierarchy[Role.ANALYST]).toBe(2);
      expect(hierarchy[Role.DESIGNER]).toBe(1);
    });
  });

  describe("roleHasHigherPrivileges", () => {
    it("should return true when first role has higher privileges", () => {
      expect(RBACService.roleHasHigherPrivileges(Role.ADMIN, Role.ANALYST)).toBe(true);
      expect(RBACService.roleHasHigherPrivileges(Role.ADMIN, Role.DESIGNER)).toBe(true);
      expect(RBACService.roleHasHigherPrivileges(Role.ANALYST, Role.DESIGNER)).toBe(true);
    });

    it("should return false when first role has lower or equal privileges", () => {
      expect(RBACService.roleHasHigherPrivileges(Role.ANALYST, Role.ADMIN)).toBe(false);
      expect(RBACService.roleHasHigherPrivileges(Role.DESIGNER, Role.ADMIN)).toBe(false);
      expect(RBACService.roleHasHigherPrivileges(Role.ADMIN, Role.ADMIN)).toBe(false);
    });
  });
});

describe("RBAC Middleware", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: {
        id: "user123",
        role: "admin",
      },
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

  describe("requirePermission", () => {
    it("should allow access when user has required permission", () => {
      const middleware = requirePermission(Permission.USER_CREATE);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny access when user lacks required permission", () => {
      mockReq.user.role = "designer";
      const middleware = requirePermission(Permission.USER_DELETE);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Insufficient permissions" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny access when no user in request", () => {
      mockReq.user = undefined;
      const middleware = requirePermission(Permission.USER_READ);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    it("should allow access when user has required role", () => {
      const middleware = requireRole(Role.ADMIN);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny access when user has different role", () => {
      mockReq.user.role = "designer";
      const middleware = requireRole(Role.ADMIN);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Insufficient role privileges" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny access when no user in request", () => {
      mockReq.user = undefined;
      const middleware = requireRole(Role.ADMIN);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAnyPermission", () => {
    it("should allow access when user has any of the required permissions", () => {
      const permissions = [Permission.USER_DELETE, Permission.USER_CREATE];
      const middleware = requireAnyPermission(permissions);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny access when user has none of the required permissions", () => {
      mockReq.user.role = "designer";
      const permissions = [Permission.USER_DELETE, Permission.BILLING_UPDATE];
      const middleware = requireAnyPermission(permissions);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Insufficient permissions" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should deny access when no user in request", () => {
      mockReq.user = undefined;
      const permissions = [Permission.USER_READ];
      const middleware = requireAnyPermission(permissions);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Authentication required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe("Role-Permission Integration", () => {
  it("should ensure admin has all critical permissions", () => {
    const adminPermissions = RBACService.getPermissionsForRole(Role.ADMIN);

    // Critical admin permissions
    expect(adminPermissions).toContain(Permission.USER_CREATE);
    expect(adminPermissions).toContain(Permission.USER_DELETE);
    expect(adminPermissions).toContain(Permission.ORG_CREATE);
    expect(adminPermissions).toContain(Permission.ORG_DELETE);
    expect(adminPermissions).toContain(Permission.BILLING_UPDATE);
    expect(adminPermissions).toContain(Permission.TEAM_INVITE);
    expect(adminPermissions).toContain(Permission.TEAM_REMOVE);
  });

  it("should ensure analyst has read access but limited write access", () => {
    const analystPermissions = RBACService.getPermissionsForRole(Role.ANALYST);

    // Should have read permissions
    expect(analystPermissions).toContain(Permission.USER_READ);
    expect(analystPermissions).toContain(Permission.ANALYTICS_READ);
    expect(analystPermissions).toContain(Permission.NOTIFICATION_READ);

    // Should have A/B testing permissions
    expect(analystPermissions).toContain(Permission.AB_TEST_CREATE);
    expect(analystPermissions).toContain(Permission.AB_TEST_UPDATE);

    // Should NOT have destructive permissions
    expect(analystPermissions).not.toContain(Permission.USER_DELETE);
    expect(analystPermissions).not.toContain(Permission.ORG_DELETE);
    expect(analystPermissions).not.toContain(Permission.BILLING_UPDATE);
  });

  it("should ensure designer has template and notification permissions", () => {
    const designerPermissions = RBACService.getPermissionsForRole(Role.DESIGNER);

    // Should have template permissions
    expect(designerPermissions).toContain(Permission.TEMPLATE_CREATE);
    expect(designerPermissions).toContain(Permission.TEMPLATE_UPDATE);
    expect(designerPermissions).toContain(Permission.TEMPLATE_DELETE);

    // Should have notification permissions
    expect(designerPermissions).toContain(Permission.NOTIFICATION_CREATE);
    expect(designerPermissions).toContain(Permission.NOTIFICATION_UPDATE);

    // Should have basic read permissions
    expect(designerPermissions).toContain(Permission.USER_READ);
    expect(designerPermissions).toContain(Permission.ANALYTICS_READ);

    // Should NOT have admin permissions
    expect(designerPermissions).not.toContain(Permission.USER_DELETE);
    expect(designerPermissions).not.toContain(Permission.BILLING_UPDATE);
    expect(designerPermissions).not.toContain(Permission.TEAM_INVITE);
  });

  it("should maintain proper role hierarchy", () => {
    const adminPerms = RBACService.getPermissionsForRole(Role.ADMIN);
    const analystPerms = RBACService.getPermissionsForRole(Role.ANALYST);
    const designerPerms = RBACService.getPermissionsForRole(Role.DESIGNER);

    // Admin should have more permissions than others
    expect(adminPerms.length).toBeGreaterThan(analystPerms.length);
    expect(adminPerms.length).toBeGreaterThan(designerPerms.length);

    // All analyst read permissions should be available to admin
    const analystReadPerms = analystPerms.filter((p) => p.includes(":read"));
    analystReadPerms.forEach((perm) => {
      expect(adminPerms).toContain(perm);
    });
  });
});
