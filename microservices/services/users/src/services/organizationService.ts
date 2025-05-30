import { BadRequestError, NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
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
      const existingOrg = await prisma.organization.findUnique({
        where: {
          slug: slug,
        },
      });

      if (existingOrg) {
        throw BadRequestError("Organization slug is already taken");
      }

      // Create organization
      const organization = await prisma.organization.create({
        data: {
          name: name,
          slug: slug,
          dataRegion: dataRegion || "us-east-1",
          settings: JSON.stringify({}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          dataRegion: true,
          settings: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!organization) {
        throw BadRequestError("Failed to create organization");
      }

      // Add user as owner
      await prisma.organizationMember.create({
        data: {
          userId: userId,
          organizationId: organization.id,
          role: "owner",
          joinedAt: new Date().toISOString(),
        },
      });

      return organization;
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
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
      });

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      // Get organization data
      const organization = await prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
      });

      if (!organization) {
        return null;
      }

      return organization;
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
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
      });

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to update this organization");
      }

      const updateData: any = {};

      if (params.name !== undefined) {
        updateData.name = params.name;
      }

      if (params.settings !== undefined) {
        updateData.settings = JSON.stringify(params.settings);
      }

      updateData.updatedAt = new Date();

      const organization = await prisma.organization.update({
        where: {
          id: organizationId,
        },
        data: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          dataRegion: true,
          settings: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!organization) {
        throw BadRequestError("Failed to update organization");
      }

      return organization;
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
      const organizations = await prisma.organizationMember.findMany({
        where: {
          userId: userId,
        },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              dataRegion: true,
              settings: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return organizations.map((org: any) => ({
        id: org.organization.id,
        name: org.organization.name,
        slug: org.organization.slug,
        dataRegion: org.organization.dataRegion,
        settings: org.organization.settings,
        createdAt: org.organization.createdAt,
        updatedAt: org.organization.updatedAt,
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
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
      });

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      // Get all members
      const members = await prisma.organizationMember.findMany({
        where: {
          organizationId: organizationId,
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      return members.map((member: any) => ({
        id: member.id,
        userId: member.userId,
        organizationId: member.organizationId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: {
          id: member.userId,
          email: `user_${member.userId.substring(0, 8)}@example.com`, // Simulated decryption
          fullName: `User ${member.userId.substring(0, 8)}`, // Simulated decryption
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
      const userMembership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
      });

      if (!userMembership || !["admin", "owner"].includes(userMembership.role)) {
        throw UnauthorizedError("Not authorized to update member roles");
      }

      // Get target member
      const targetMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: memberId,
        },
      });

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
      await prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: memberId,
          },
        },
        data: {
          role: newRole,
        },
      });
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
      const userMembership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
      });

      if (!userMembership || !["admin", "owner"].includes(userMembership.role)) {
        throw UnauthorizedError("Not authorized to remove members");
      }

      // Get target member
      const targetMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: memberId,
        },
      });

      if (!targetMember) {
        throw NotFoundError("Member not found");
      }

      // Prevent removing owner unless user is owner
      if (targetMember.role === "owner" && userMembership.role !== "owner") {
        throw UnauthorizedError("Only owners can remove other owners");
      }

      // Remove member
      await prisma.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: memberId,
          },
        },
      });
    } catch (error) {
      logger.error("Error in removeMember", { error, organizationId, memberId, userId });
      throw error;
    }
  }
}

export const organizationService = new OrganizationService();
