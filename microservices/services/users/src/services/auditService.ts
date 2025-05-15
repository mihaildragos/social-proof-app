import { db } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Service for handling audit logging
 */
class AuditService {
  /**
   * Log an action to the audit log
   * @param params Parameters for the audit log entry
   */
  async logAction(params: {
    userId?: string;
    organizationId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const {
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
        metadata,
        ipAddress,
        userAgent,
      } = params;
      
      await db.query(
        `INSERT INTO audit_logs (
          user_id, organization_id, action, resource_type, resource_id,
          metadata, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          organizationId,
          action,
          resourceType,
          resourceId,
          metadata ? JSON.stringify(metadata) : null,
          ipAddress,
          userAgent,
        ]
      );
      
      logger.debug('Audit log created', {
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
      });
    } catch (error) {
      // Log the error but don't throw (audit logging should never fail the main operation)
      logger.error('Failed to create audit log', {
        error: (error as Error).message,
        params,
      });
    }
  }
  
  /**
   * Get audit logs for an organization with pagination and filtering
   */
  async getAuditLogs(params: {
    organizationId: string;
    userId?: string;
    resourceType?: string;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const {
      organizationId,
      userId,
      resourceType,
      actionType,
      startDate,
      endDate,
      page = 1,
      pageSize = 50,
    } = params;
    
    // Build WHERE clause for filtering
    let whereClause = 'organization_id = $1';
    const queryParams: any[] = [organizationId];
    let paramIndex = 2;
    
    if (userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      queryParams.push(userId);
    }
    
    if (resourceType) {
      whereClause += ` AND resource_type = $${paramIndex++}`;
      queryParams.push(resourceType);
    }
    
    if (actionType) {
      whereClause += ` AND action = $${paramIndex++}`;
      queryParams.push(actionType);
    }
    
    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(startDate);
    }
    
    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(endDate);
    }
    
    // Calculate pagination
    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countResult = await db.getOne(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereClause}`,
      queryParams
    );
    
    const total = parseInt(countResult.total, 10);
    
    // Get paginated results
    const logs = await db.getMany(
      `SELECT 
        id, user_id, organization_id, action, resource_type, 
        resource_id, metadata, ip_address, user_agent, created_at
       FROM audit_logs 
       WHERE ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...queryParams, pageSize, offset]
    );
    
    // Return paginated result
    return {
      logs,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
  
  /**
   * Create middleware for automatic audit logging
   */
  createAuditMiddleware(actionType: string, resourceType: string) {
    return async (req: any, res: any, next: any) => {
      // Store original end function
      const originalEnd = res.end;
      
      // Override end function to log after response is sent
      res.end = function(chunk: any, encoding: any) {
        // Call original end function
        originalEnd.call(this, chunk, encoding);
        
        // Only log successful requests
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const resourceId = req.params.id || null;
          
          auditService.logAction({
            userId: req.user?.id,
            organizationId: req.params.organizationId || req.body.organizationId,
            action: actionType,
            resourceType,
            resourceId,
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
              body: req.method !== 'GET' ? req.body : undefined,
              status: res.statusCode,
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
        }
      };
      
      next();
    };
  }
}

export const auditService = new AuditService(); 