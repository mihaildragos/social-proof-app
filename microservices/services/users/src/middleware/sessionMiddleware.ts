import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { UnauthorizedError } from './errorHandler';
import { verifyToken, generateToken, generateRefreshToken, blacklistToken } from '../utils/jwt';

/**
 * Middleware to manage user sessions
 */
export const sessionManager = {
  /**
   * Create a new session for a user
   */
  createSession: async (req: Request, res: Response, userId: string) => {
    try {
      // Generate a session ID
      const sessionId = randomUUID();
      
      // Get user info
      const user = await db.getOne(
        `SELECT email, role FROM users WHERE id = $1`,
        [userId]
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get organization info if the user belongs to one
      const orgMember = await db.getOne(
        `SELECT organization_id, role FROM organization_members 
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      // Get user permissions
      const permissions = await db.getMany(
        `SELECT p.name FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.id
         WHERE up.user_id = $1
         UNION
         SELECT p.name FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $2`,
        [userId, orgMember?.role || user.role]
      );

      const permissionNames = permissions.map(p => p.name);
      
      // Create a new session record
      await db.query(
        `INSERT INTO user_sessions (
          id, user_id, ip_address, user_agent, is_active,
          organization_id, last_activity
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          sessionId,
          userId,
          req.ip,
          req.headers['user-agent'],
          true,
          orgMember?.organization_id,
        ]
      );
      
      // Generate access token
      const accessToken = await generateToken({
        userId,
        email: user.email,
        organizationId: orgMember?.organization_id,
        role: orgMember?.role || user.role,
        permissions: permissionNames,
        sessionId,
      });
      
      // Generate refresh token
      const refreshToken = await generateRefreshToken(userId, sessionId);
      
      // Set tokens in cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: parseInt(process.env.TOKEN_EXPIRY || '86400', 10) * 1000,
      });
      
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth/refresh',
        maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10) * 1000,
      });
      
      // Return tokens for API usage
      return {
        accessToken,
        refreshToken,
        expiresIn: parseInt(process.env.TOKEN_EXPIRY || '86400', 10),
      };
    } catch (error) {
      logger.error('Failed to create session', { 
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  },
  
  /**
   * Validate a session
   */
  validateSession: async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from cookies or Authorization header
      let token = req.cookies?.accessToken;
      
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }
      
      if (!token) {
        throw UnauthorizedError('Authentication required');
      }
      
      // Verify token
      const payload = await verifyToken(token);
      
      // Check if session exists and is active
      if (payload.sessionId) {
        const session = await db.getOne(
          `SELECT id, is_active FROM user_sessions WHERE id = $1 AND user_id = $2`,
          [payload.sessionId, payload.userId]
        );
        
        if (!session || !session.is_active) {
          throw UnauthorizedError('Session expired or invalid');
        }
        
        // Update last activity time
        await db.query(
          `UPDATE user_sessions SET last_activity = NOW() WHERE id = $1`,
          [payload.sessionId]
        );
      }
      
      // Set user info on request
      req.user = {
        id: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role,
        permissions: payload.permissions,
      };
      
      next();
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Refresh a session with a new access token
   */
  refreshSession: async (req: Request, res: Response) => {
    try {
      // Get refresh token from cookies or request body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        throw UnauthorizedError('Refresh token required');
      }
      
      // Verify refresh token
      const { userId, sessionId } = await verifyToken(refreshToken) as { userId: string; sessionId: string };
      
      // Check if session exists and is active
      const session = await db.getOne(
        `SELECT id, is_active, organization_id FROM user_sessions 
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );
      
      if (!session || !session.is_active) {
        throw UnauthorizedError('Session expired or invalid');
      }
      
      // Get user info
      const user = await db.getOne(
        `SELECT email, role FROM users WHERE id = $1`,
        [userId]
      );
      
      if (!user) {
        throw UnauthorizedError('User not found');
      }
      
      // Get organization role
      const orgMember = await db.getOne(
        `SELECT role FROM organization_members 
         WHERE user_id = $1 AND organization_id = $2`,
        [userId, session.organization_id]
      );

      // Get user permissions
      const permissions = await db.getMany(
        `SELECT p.name FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.id
         WHERE up.user_id = $1
         UNION
         SELECT p.name FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $2`,
        [userId, orgMember?.role || user.role]
      );

      const permissionNames = permissions.map(p => p.name);
      
      // Generate new access token
      const accessToken = await generateToken({
        userId,
        email: user.email,
        organizationId: session.organization_id,
        role: orgMember?.role || user.role,
        permissions: permissionNames,
        sessionId,
      });
      
      // Update session last activity
      await db.query(
        `UPDATE user_sessions SET last_activity = NOW() WHERE id = $1`,
        [sessionId]
      );
      
      // Set new access token in cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: parseInt(process.env.TOKEN_EXPIRY || '86400', 10) * 1000,
      });
      
      // Return new access token
      return {
        accessToken,
        expiresIn: parseInt(process.env.TOKEN_EXPIRY || '86400', 10),
      };
    } catch (error) {
      logger.error('Failed to refresh session', { 
        error: (error as Error).message 
      });
      throw error;
    }
  },
  
  /**
   * End a session (logout)
   */
  endSession: async (req: Request, res: Response) => {
    try {
      // Get token from cookies or Authorization header
      let token = req.cookies?.accessToken;
      
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }
      
      if (token) {
        try {
          // Verify token
          const payload = await verifyToken(token);
          
          // Add token to blacklist
          if (payload.exp) {
            await blacklistToken(payload.jti as string, payload.exp);
          }
          
          // Deactivate session
          if (payload.sessionId) {
            await db.query(
              `UPDATE user_sessions SET is_active = false, ended_at = NOW() 
               WHERE id = $1 AND user_id = $2`,
              [payload.sessionId, payload.userId]
            );
          }
        } catch (error) {
          // Continue even if token verification fails
          logger.warn('Failed to verify token during logout', { 
            error: (error as Error).message 
          });
        }
      }
      
      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to end session', { 
        error: (error as Error).message 
      });
      throw error;
    }
  },
}; 