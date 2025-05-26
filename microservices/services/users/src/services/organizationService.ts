import { BadRequestError, NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import { db } from "../utils/db";
import { logger } from "../utils/logger";

interface Organization {
  id: string;
  name: string;
  slug: string;
  dataRegion?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface CreateOrganizationParams {
  name: string;
  slug: string;
  dataRegion?: string;
  userId: string;
}

interface UpdateOrganizationParams {
  name?: string;
  settings?: Record<string, any>;
}

interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
}

class OrganizationService {
  /**
   * Create a new organization
   */
  async createOrganization(params: CreateOrganizationParams): Promise<Organization> {
    try {
      const { name, slug, dataRegion, userId } = params;

      // Check if slug is already taken
      const existingOrg = await db.getOne(
        "SELECT id FROM organizations WHERE slug = $1",
        [slug]
      );

      if (existingOrg) {
        throw BadRequestError("Organization slug is already taken");
      }

      // Create organization
      const organization = await db.getOne(
        `INSERT INTO organizations (name, slug, data_region, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, slug, data_region, settings, created_at, updated_at`,
        [name, slug, dataRegion || "us-east-1", JSON.stringify({})]
      );

      if (!organization) {
        throw BadRequestError("Failed to create organization");
      }

      // Add user as owner
      await db.execute(
        `INSERT INTO organization_members (user_id, organization_id, role, joined_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, organization.id, "owner"]
      );

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        dataRegion: organization.data_region,
        settings: organization.settings,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      };
    } catch (error) {
      logger.error("Error in createOrganization", { error, params });
      throw error;
    }
  }

  /**
   * Get organization by ID (with permission check)
   */
  async getOrganization(organizationId: string, userId: string): Promise<Organization | null> {
    try {
      // Check if user is a member of the organization
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      // Get organization data
      const organization = await db.getOne(
        "SELECT * FROM organizations WHERE id = $1",
        [organizationId]
      );

      if (!organization) {
        return null;
      }

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        dataRegion: organization.data_region,
        settings: organization.settings,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      };
    } catch (error) {
      logger.error("Error in getOrganization", { error, organizationId, userId });
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    params: UpdateOrganizationParams,
    userId: string
  ): Promise<Organization> {
    try {
      // Check if user has admin or owner role
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to update this organization");
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (params.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(params.name);
      }

      if (params.settings !== undefined) {
        updateFields.push(`settings = $${paramIndex++}`);
        updateValues.push(JSON.stringify(params.settings));
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(organizationId);

      const organization = await db.getOne(
        `UPDATE organizations SET ${updateFields.join(", ")} 
         WHERE id = $${paramIndex} 
         RETURNING id, name, slug, data_region, settings, created_at, updated_at`,
        updateValues
      );

      if (!organization) {
        throw BadRequestError("Failed to update organization");
      }

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        dataRegion: organization.data_region,
        settings: organization.settings,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      };
    } catch (error) {
      logger.error("Error in updateOrganization", { error, organizationId, userId });
      throw error;
    }
  }

  /**
   * List organizations for a user
   */
  async listUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      const organizations = await db.getMany(
        `SELECT o.id, o.name, o.slug, o.data_region, o.settings, o.created_at, o.updated_at
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = $1`,
        [userId]
      );

      return organizations.map((org: any) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        dataRegion: org.data_region,
        settings: org.settings,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      }));
    } catch (error) {
      logger.error("Error in listUserOrganizations", { error, userId });
      throw error;
    }
  }

  /**
   * List organization members
   */
  async listOrganizationMembers(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMember[]> {
    try {
      // Check if user is a member of the organization
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      // Get all members
      const members = await db.getMany(
        `SELECT om.id, om.user_id, om.organization_id, om.role, om.joined_at,
                u.id as user_id, u.email_encrypted, u.full_name_encrypted
         FROM organization_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1`,
        [organizationId]
      );

      return members.map((member: any) => ({
        id: member.id,
        userId: member.user_id,
        organizationId: member.organization_id,
        role: member.role,
        joinedAt: member.joined_at,
        user: {
          id: member.user_id,
          email: `user_${member.user_id.substring(0, 8)}@example.com`, // Simulated decryption
          fullName: `User ${member.user_id.substring(0, 8)}`, // Simulated decryption
        },
      }));
    } catch (error) {
      logger.error("Error in listOrganizationMembers", { error, organizationId, userId });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if user has admin or owner role
      const userMembership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!userMembership || !["admin", "owner"].includes(userMembership.role)) {
        throw UnauthorizedError("Not authorized to update member roles");
      }

      // Get target member
      const targetMember = await db.getOne(
        "SELECT role, user_id FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, memberId]
      );

      if (!targetMember) {
        throw NotFoundError("Member not found");
      }

      // Prevent changing owner role unless user is owner
      if (targetMember.role === "owner" && userMembership.role !== "owner") {
        throw UnauthorizedError("Only owners can change owner roles");
      }

      // Prevent setting owner role unless user is owner
      if (newRole === "owner" && userMembership.role !== "owner") {
        throw UnauthorizedError("Only owners can assign owner role");
      }

      // Update member role
      await db.execute(
        "UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3",
        [newRole, organizationId, memberId]
      );
    } catch (error) {
      logger.error("Error in updateMemberRole", { error, organizationId, memberId, userId });
      throw error;
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, memberId: string, userId: string): Promise<void> {
    try {
      // Check if user has admin or owner role
      const userMembership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!userMembership || !["admin", "owner"].includes(userMembership.role)) {
        throw UnauthorizedError("Not authorized to remove members");
      }

      // Get target member
      const targetMember = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, memberId]
      );

      if (!targetMember) {
        throw NotFoundError("Member not found");
      }

      // Prevent removing owner unless user is owner
      if (targetMember.role === "owner" && userMembership.role !== "owner") {
        throw UnauthorizedError("Only owners can remove other owners");
      }

      // Remove member
      await db.execute(
        "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, memberId]
      );
    } catch (error) {
      logger.error("Error in removeMember", { error, organizationId, memberId, userId });
      throw error;
    }
  }
}

export const organizationService = new OrganizationService(); 