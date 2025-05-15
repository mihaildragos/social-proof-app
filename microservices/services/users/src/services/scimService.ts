import { db, beginTransaction } from '../utils/db';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler';

/**
 * Service for handling SCIM user and group provisioning
 */
class ScimService {
  /**
   * Retrieve users with pagination and filtering
   */
  async getUsers({ organizationId, startIndex = 1, count = 100, filter = '' }) {
    let whereClause = 'su.organization_id = $1';
    const params = [organizationId];
    
    // Simple filter parsing (SCIM filters can be complex in practice)
    if (filter) {
      if (filter.includes('userName eq')) {
        const username = filter.match(/userName eq "([^"]+)"/)?.[1];
        if (username) {
          whereClause += ' AND su.scim_username = $2';
          params.push(username);
        }
      } else if (filter.includes('externalId eq')) {
        const externalId = filter.match(/externalId eq "([^"]+)"/)?.[1];
        if (externalId) {
          whereClause += ' AND su.external_id = $2';
          params.push(externalId);
        }
      }
    }
    
    const offset = Math.max(0, startIndex - 1);
    
    // First get total count
    const countResult = await db.getOne(
      `SELECT COUNT(*) AS total
       FROM scim_users su
       WHERE ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.total, 10);
    
    // Get paginated users
    const users = await db.getMany(
      `SELECT su.id, su.external_id, su.scim_username, su.active,
              u.id as user_id,
              get_user_email(u.id) as email,
              get_user_full_name(u.id) as full_name
       FROM scim_users su
       JOIN users u ON su.user_id = u.id
       WHERE ${whereClause}
       ORDER BY su.scim_username
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, count, offset]
    );
    
    // Transform to SCIM format
    const scimUsers = users.map(user => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.external_id,
      userName: user.scim_username,
      name: {
        formatted: user.full_name,
      },
      emails: [
        {
          value: user.email,
          primary: true,
          type: 'work'
        }
      ],
      active: user.active,
      meta: {
        resourceType: 'User',
        created: user.created_at,
        lastModified: user.updated_at,
      }
    }));
    
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: scimUsers,
    };
  }
  
  /**
   * Get a user by ID
   */
  async getUserById({ organizationId, id }) {
    const user = await db.getOne(
      `SELECT su.id, su.external_id, su.scim_username, su.active, 
              su.created_at, su.updated_at,
              u.id as user_id,
              get_user_email(u.id) as email,
              get_user_full_name(u.id) as full_name
       FROM scim_users su
       JOIN users u ON su.user_id = u.id
       WHERE su.id = $1 AND su.organization_id = $2`,
      [id, organizationId]
    );
    
    if (!user) {
      return null;
    }
    
    // Transform to SCIM format
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.external_id,
      userName: user.scim_username,
      name: {
        formatted: user.full_name,
      },
      emails: [
        {
          value: user.email,
          primary: true,
          type: 'work'
        }
      ],
      active: user.active,
      meta: {
        resourceType: 'User',
        created: user.created_at,
        lastModified: user.updated_at,
      }
    };
  }
  
  /**
   * Create a new user via SCIM
   */
  async createUser({ organizationId, userData }) {
    // Begin transaction
    const client = await beginTransaction();
    
    try {
      // Check if user already exists by username or externalId
      let existingUser;
      
      if (userData.externalId) {
        existingUser = await client.query(
          `SELECT id FROM scim_users 
           WHERE organization_id = $1 AND external_id = $2`,
          [organizationId, userData.externalId]
        );
        
        if (existingUser.rows.length > 0) {
          throw ConflictError(`User with externalId ${userData.externalId} already exists`);
        }
      }
      
      existingUser = await client.query(
        `SELECT id FROM scim_users 
         WHERE organization_id = $1 AND scim_username = $2`,
        [organizationId, userData.userName]
      );
      
      if (existingUser.rows.length > 0) {
        throw ConflictError(`User with userName ${userData.userName} already exists`);
      }
      
      // Extract primary email
      const email = userData.emails?.find(e => e.primary)?.value || 
                    userData.emails?.[0]?.value;
      
      if (!email) {
        throw BadRequestError('Email is required');
      }
      
      // Get or create user
      const userResult = await client.query(
        `INSERT INTO users (email, full_name, auth_provider, auth_provider_id)
         VALUES ($1, $2, 'scim', $3)
         RETURNING id`,
        [
          email,
          userData.name?.formatted || `${userData.name?.givenName || ''} ${userData.name?.familyName || ''}`.trim() || email.split('@')[0],
          userData.externalId || userData.userName
        ]
      );
      
      const userId = userResult.rows[0].id;
      
      // Create SCIM user mapping
      const scimUserResult = await client.query(
        `INSERT INTO scim_users (
          user_id, organization_id, external_id, scim_username, active
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at, updated_at`,
        [
          userId,
          organizationId,
          userData.externalId,
          userData.userName,
          userData.active !== undefined ? userData.active : true
        ]
      );
      
      const scimUser = scimUserResult.rows[0];
      
      // Add user to organization
      await client.query(
        `INSERT INTO organization_members (user_id, organization_id, role)
         VALUES ($1, $2, 'user')`,
        [userId, organizationId]
      );
      
      await client.query('COMMIT');
      client.release();
      
      // Return SCIM-formatted user
      return {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: scimUser.id,
        externalId: userData.externalId,
        userName: userData.userName,
        name: userData.name,
        emails: userData.emails,
        active: userData.active !== undefined ? userData.active : true,
        meta: {
          resourceType: 'User',
          created: scimUser.created_at,
          lastModified: scimUser.updated_at,
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }
  }
  
  // Remaining methods would be implemented with similar transaction handling
  async replaceUser({ organizationId, id, userData }) {
    // Implementation would update user details
    // For brevity, returning dummy SCIM user object
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: id,
      userName: userData.userName,
      // ... other fields
    };
  }
  
  async updateUser({ organizationId, id, operations }) {
    // Implementation would apply patch operations
    // For brevity, returning dummy SCIM user object
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: id,
      // ... other fields
    };
  }
  
  async deleteUser({ organizationId, id }) {
    // Implementation would delete the user
    return true;
  }
  
  // Similar methods for Groups (getGroups, getGroupById, etc.)
  async getGroups({ organizationId, startIndex = 1, count = 100, filter = '' }) {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 0,
      startIndex,
      itemsPerPage: count,
      Resources: [],
    };
  }
  
  async getGroupById({ organizationId, id }) {
    return null; // Would implement actual group lookup
  }
  
  async createGroup({ organizationId, groupData }) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: '123',
      displayName: groupData.displayName,
      // ... other fields
    };
  }
  
  async replaceGroup({ organizationId, id, groupData }) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: id,
      displayName: groupData.displayName,
      // ... other fields
    };
  }
  
  async updateGroup({ organizationId, id, operations }) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: id,
      // ... other fields
    };
  }
  
  async deleteGroup({ organizationId, id }) {
    return true;
  }
}

export const scimService = new ScimService(); 