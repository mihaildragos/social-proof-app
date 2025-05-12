import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './errorHandler';
import { logger } from '../utils/logger';
import { db } from '../utils/db';

/**
 * Middleware factory that checks if a user has the required permissions
 * @param requiredResource The resource to check permissions for (e.g., 'organization', 'notification')
 * @param requiredAction The action to check permissions for (e.g., 'read', 'write', 'delete')
 */
export const requirePermission = (requiredResource: string, requiredAction: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ForbiddenError('Authentication required');
      }
      
      // Get organization context (typically from route params or query)
      const organizationId = req.params.organizationId || req.query.organizationId || req.body.organizationId;
      
      if (!organizationId) {
        throw ForbiddenError('Organization context required');
      }
      
      // Check if user has permission
      const hasPermission = await checkUserPermission(
        req.user.id,
        organizationId,
        requiredResource,
        requiredAction
      );
      
      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.user.id,
          organizationId,
          resource: requiredResource,
          action: requiredAction,
        });
        
        throw ForbiddenError(`You don't have permission to ${requiredAction} ${requiredResource}`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware factory that checks if user has any role in the organization
 */
export const requireOrganizationMember = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ForbiddenError('Authentication required');
      }
      
      const organizationId = req.params.organizationId || req.query.organizationId || req.body.organizationId;
      
      if (!organizationId) {
        throw ForbiddenError('Organization context required');
      }
      
      // Check if user is a member of the organization
      const result = await db.query(
        `SELECT role FROM organization_members 
         WHERE user_id = $1 AND organization_id = $2`,
        [req.user.id, organizationId]
      );
      
      if (result.rows.length === 0) {
        throw ForbiddenError('You are not a member of this organization');
      }
      
      // Add user role to request for later use
      req.userRole = result.rows[0].role;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware factory that checks if user has a specific role in the organization
 * @param requiredRoles Array of roles that are allowed to access the resource
 */
export const requireRole = (requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ForbiddenError('Authentication required');
      }
      
      const organizationId = req.params.organizationId || req.query.organizationId || req.body.organizationId;
      
      if (!organizationId) {
        throw ForbiddenError('Organization context required');
      }
      
      // Check if user has the required role
      const result = await db.query(
        `SELECT role FROM organization_members 
         WHERE user_id = $1 AND organization_id = $2`,
        [req.user.id, organizationId]
      );
      
      if (result.rows.length === 0) {
        throw ForbiddenError('You are not a member of this organization');
      }
      
      const userRole = result.rows[0].role;
      
      // Add user role to request for later use
      req.userRole = userRole;
      
      if (!requiredRoles.includes(userRole)) {
        logger.warn('Role permission denied', {
          userId: req.user.id,
          organizationId,
          userRole,
          requiredRoles,
        });
        
        throw ForbiddenError(`This action requires one of these roles: ${requiredRoles.join(', ')}`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Helper function to check if a user has a specific permission
 */
async function checkUserPermission(
  userId: string,
  organizationId: string,
  resource: string,
  action: string
): Promise<boolean> {
  // First, check if the user is an owner or admin (they have all permissions)
  const memberResult = await db.query(
    `SELECT role FROM organization_members 
     WHERE user_id = $1 AND organization_id = $2`,
    [userId, organizationId]
  );
  
  if (memberResult.rows.length === 0) {
    return false;
  }
  
  const userRole = memberResult.rows[0].role;
  
  // Owners and admins have all permissions
  if (['owner', 'admin'].includes(userRole)) {
    return true;
  }
  
  // Check if the role has the specific permission
  const permissionResult = await db.query(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     JOIN roles r ON rp.role_id = r.id
     WHERE r.name = $1 AND p.resource = $2 AND p.action = $3`,
    [userRole, resource, action]
  );
  
  if (permissionResult.rows.length > 0) {
    return true;
  }
  
  // Check for explicit user permission grants
  const userPermissionResult = await db.query(
    `SELECT 1 FROM user_permissions up
     JOIN permissions p ON up.permission_id = p.id
     WHERE up.user_id = $1 AND up.organization_id = $2 
     AND p.resource = $3 AND p.action = $4`,
    [userId, organizationId, resource, action]
  );
  
  return userPermissionResult.rows.length > 0;
}

// Extend Express Request interface to include userRole
declare global {
  namespace Express {
    interface Request {
      userRole?: string;
    }
  }
} 