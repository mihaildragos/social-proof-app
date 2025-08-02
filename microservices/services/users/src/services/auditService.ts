import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

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

      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action,
          resourceType,
          resourceId,
          metadata: metadata ? JSON.stringify(metadata) : null,
          ipAddress,
          userAgent,
          createdAt: new Date(),
        },
      });

      logger.debug("Audit log created", {
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
      });
    } catch (error) {
      // Log the error but don't throw (audit logging should never fail the main operation)
      logger.error("Failed to create audit log", {
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

    // Calculate pagination
    const offset = (page - 1) * pageSize;

    // Build where clause dynamically
    const whereClause: any = {
      organizationId,
    };

    if (userId) {
      whereClause.userId = userId;
    }

    if (resourceType) {
      whereClause.resourceType = resourceType;
    }

    if (actionType) {
      whereClause.action = actionType;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = startDate;
      }
      if (endDate) {
        whereClause.createdAt.lte = endDate;
      }
    }

    // Get total count
    const total = await prisma.auditLog.count({
      where: whereClause,
    });

    // Get paginated results
    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        organizationId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

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
      res.end = function (chunk: any, encoding: any) {
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
              body: req.method !== "GET" ? req.body : undefined,
              status: res.statusCode,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }
      };

      next();
    };
  }
}

export const auditService = new AuditService();
