import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { UnauthorizedError } from './errorHandler';
import { db } from '../utils/db';

/**
 * Middleware to authenticate SCIM requests using bearer token
 * Adds organizationId to the request object for downstream handlers
 */
export const scimAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('Missing or invalid Authorization header');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw UnauthorizedError('Missing token in Authorization header');
    }
    
    // Look up the token in the database
    const result = await db.query(
      `SELECT id, organization_id, is_active, expires_at
       FROM scim_tokens
       WHERE token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      throw UnauthorizedError('Invalid SCIM token');
    }
    
    const scimToken = result.rows[0];
    
    // Check if token is active
    if (!scimToken.is_active) {
      throw UnauthorizedError('SCIM token is inactive');
    }
    
    // Check if token has expired
    if (scimToken.expires_at && new Date(scimToken.expires_at) < new Date()) {
      throw UnauthorizedError('SCIM token has expired');
    }
    
    // Add organization ID to request for downstream handlers
    req.organizationId = scimToken.organization_id;
    
    // Update last used timestamp
    await db.query(
      `UPDATE scim_tokens
       SET last_used_at = NOW()
       WHERE id = $1`,
      [scimToken.id]
    );
    
    // Log SCIM API usage
    logger.info('SCIM API request', {
      method: req.method,
      path: req.path,
      organizationId: req.organizationId
    });
    
    // Create audit log entry
    await db.query(
      `INSERT INTO scim_audit_logs (
         organization_id, operation, resource_type, resource_id, 
         performed_by, request_payload
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.organizationId,
        req.method,
        req.path.includes('/Users') ? 'User' : req.path.includes('/Groups') ? 'Group' : 'Other',
        req.params.id || 'list',
        `SCIM Token (${scimToken.id})`,
        req.method !== 'GET' ? JSON.stringify(req.body) : null
      ]
    );
    
    next();
  } catch (error) {
    next(error);
  }
};

// Extend Express Request interface to include organizationId
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
} 