import { getContextLogger } from "../utils/logger";

const logger = getContextLogger({ service: "rbac" });

export enum Role {
  ADMIN = "admin",
  ANALYST = "analyst",
  DESIGNER = "designer",
}

export enum Permission {
  // User management
  USER_CREATE = "user:create",
  USER_READ = "user:read",
  USER_UPDATE = "user:update",
  USER_DELETE = "user:delete",

  // Organization management
  ORG_CREATE = "org:create",
  ORG_READ = "org:read",
  ORG_UPDATE = "org:update",
  ORG_DELETE = "org:delete",

  // Site management
  SITE_CREATE = "site:create",
  SITE_READ = "site:read",
  SITE_UPDATE = "site:update",
  SITE_DELETE = "site:delete",

  // Notification management
  NOTIFICATION_CREATE = "notification:create",
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_UPDATE = "notification:update",
  NOTIFICATION_DELETE = "notification:delete",
  NOTIFICATION_PUBLISH = "notification:publish",

  // Template management
  TEMPLATE_CREATE = "template:create",
  TEMPLATE_READ = "template:read",
  TEMPLATE_UPDATE = "template:update",
  TEMPLATE_DELETE = "template:delete",

  // Analytics
  ANALYTICS_READ = "analytics:read",
  ANALYTICS_EXPORT = "analytics:export",

  // A/B Testing
  AB_TEST_CREATE = "ab_test:create",
  AB_TEST_READ = "ab_test:read",
  AB_TEST_UPDATE = "ab_test:update",
  AB_TEST_DELETE = "ab_test:delete",

  // Integration management
  INTEGRATION_CREATE = "integration:create",
  INTEGRATION_READ = "integration:read",
  INTEGRATION_UPDATE = "integration:update",
  INTEGRATION_DELETE = "integration:delete",

  // Billing
  BILLING_READ = "billing:read",
  BILLING_UPDATE = "billing:update",

  // Team management
  TEAM_INVITE = "team:invite",
  TEAM_REMOVE = "team:remove",
  TEAM_UPDATE_ROLES = "team:update_roles",
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    // Full access to everything
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.ORG_CREATE,
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_DELETE,
    Permission.SITE_CREATE,
    Permission.SITE_READ,
    Permission.SITE_UPDATE,
    Permission.SITE_DELETE,
    Permission.NOTIFICATION_CREATE,
    Permission.NOTIFICATION_READ,
    Permission.NOTIFICATION_UPDATE,
    Permission.NOTIFICATION_DELETE,
    Permission.NOTIFICATION_PUBLISH,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_UPDATE,
    Permission.TEMPLATE_DELETE,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
    Permission.AB_TEST_CREATE,
    Permission.AB_TEST_READ,
    Permission.AB_TEST_UPDATE,
    Permission.AB_TEST_DELETE,
    Permission.INTEGRATION_CREATE,
    Permission.INTEGRATION_READ,
    Permission.INTEGRATION_UPDATE,
    Permission.INTEGRATION_DELETE,
    Permission.BILLING_READ,
    Permission.BILLING_UPDATE,
    Permission.TEAM_INVITE,
    Permission.TEAM_REMOVE,
    Permission.TEAM_UPDATE_ROLES,
  ],

  [Role.ANALYST]: [
    // Read access to most things, limited write access
    Permission.USER_READ,
    Permission.ORG_READ,
    Permission.SITE_READ,
    Permission.NOTIFICATION_READ,
    Permission.TEMPLATE_READ,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
    Permission.AB_TEST_CREATE,
    Permission.AB_TEST_READ,
    Permission.AB_TEST_UPDATE,
    Permission.AB_TEST_DELETE,
    Permission.INTEGRATION_READ,
    Permission.BILLING_READ,
  ],

  [Role.DESIGNER]: [
    // Focus on templates and notifications
    Permission.USER_READ,
    Permission.ORG_READ,
    Permission.SITE_READ,
    Permission.NOTIFICATION_CREATE,
    Permission.NOTIFICATION_READ,
    Permission.NOTIFICATION_UPDATE,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_UPDATE,
    Permission.TEMPLATE_DELETE,
    Permission.ANALYTICS_READ,
    Permission.AB_TEST_READ,
    Permission.INTEGRATION_READ,
  ],
};

export class RBACService {
  /**
   * Get permissions for a role
   */
  static getPermissionsForRole(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: Role, permission: Permission): boolean {
    const permissions = this.getPermissionsForRole(role);
    return permissions.includes(permission);
  }

  /**
   * Check if a user has a specific permission
   */
  static userHasPermission(userRole: string, permission: Permission): boolean {
    const role = userRole as Role;
    if (!Object.values(Role).includes(role)) {
      logger.warn("Invalid role provided", { role: userRole });
      return false;
    }

    return this.hasPermission(role, permission);
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static userHasAnyPermission(userRole: string, permissions: Permission[]): boolean {
    return permissions.some((permission) => this.userHasPermission(userRole, permission));
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static userHasAllPermissions(userRole: string, permissions: Permission[]): boolean {
    return permissions.every((permission) => this.userHasPermission(userRole, permission));
  }

  /**
   * Get all permissions for a user
   */
  static getUserPermissions(userRole: string): Permission[] {
    const role = userRole as Role;
    if (!Object.values(Role).includes(role)) {
      logger.warn("Invalid role provided", { role: userRole });
      return [];
    }

    return this.getPermissionsForRole(role);
  }

  /**
   * Validate if a role is valid
   */
  static isValidRole(role: string): role is Role {
    return Object.values(Role).includes(role as Role);
  }

  /**
   * Get role hierarchy (for future use)
   */
  static getRoleHierarchy(): Record<Role, number> {
    return {
      [Role.ADMIN]: 3,
      [Role.ANALYST]: 2,
      [Role.DESIGNER]: 1,
    };
  }

  /**
   * Check if one role has higher privileges than another
   */
  static roleHasHigherPrivileges(role1: Role, role2: Role): boolean {
    const hierarchy = this.getRoleHierarchy();
    return hierarchy[role1] > hierarchy[role2];
  }
}

// Middleware factory for permission checking
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      logger.warn("No user found in request for permission check", { permission });
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!RBACService.userHasPermission(req.user.role, permission)) {
      logger.warn("User lacks required permission", {
        userId: req.user.id,
        role: req.user.role,
        permission,
        path: req.path,
      });
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// Middleware factory for role checking
export function requireRole(role: Role) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      logger.warn("No user found in request for role check", { role });
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== role) {
      logger.warn("User lacks required role", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole: role,
        path: req.path,
      });
      return res.status(403).json({ error: "Insufficient role privileges" });
    }

    next();
  };
}

// Middleware factory for checking any of multiple permissions
export function requireAnyPermission(permissions: Permission[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      logger.warn("No user found in request for permission check", { permissions });
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!RBACService.userHasAnyPermission(req.user.role, permissions)) {
      logger.warn("User lacks any of the required permissions", {
        userId: req.user.id,
        role: req.user.role,
        permissions,
        path: req.path,
      });
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
