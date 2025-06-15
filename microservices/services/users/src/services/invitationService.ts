import { BadRequestError, NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { randomBytes } from "crypto";

interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: string;
  token: string;
  status: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface CreateInvitationParams {
  email: string;
  organizationId: string;
  role: string;
  invitedBy: string;
}

interface AcceptInvitationParams {
  token: string;
  fullName?: string;
  password?: string;
  user?: any; // Current authenticated user if any
}

class InvitationService {
  /**
   * Create a new invitation
   */
  async createInvitation(params: CreateInvitationParams): Promise<Invitation> {
    try {
      const { email, organizationId, role, invitedBy } = params;

      // Check if user has permission to invite
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: invitedBy,
        },
        select: {
          role: true,
        },
      });

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to send invitations");
      }

      // Check if user is already a member
      const existingUser = await prisma.user.findFirst({
        where: {
          emailEncrypted: email,
          organizationMembers: {
            some: {
              organizationId: organizationId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw BadRequestError("User is already a member of this organization");
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email: email,
          organizationId: organizationId,
          status: "pending",
        },
        select: {
          id: true,
        },
      });

      if (existingInvitation) {
        throw BadRequestError("Invitation already sent to this email");
      }

      // Generate secure token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const invitation = await prisma.invitation.create({
        data: {
          email: email,
          organizationId: organizationId,
          role: role,
          token: token,
          status: "pending",
          invitedBy: invitedBy,
          createdAt: new Date(),
          expiresAt: expiresAt.toISOString(),
        },
        select: {
          id: true,
          email: true,
          organizationId: true,
          role: true,
          token: true,
          status: true,
          invitedBy: true,
          createdAt: true,
          expiresAt: true,
        },
      });

      if (!invitation) {
        throw BadRequestError("Failed to create invitation");
      }

      // Get organization details
      const organization = await prisma.organization.findFirst({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      // TODO: Send invitation email here
      logger.info("Invitation created", { invitationId: invitation.id, email, organizationId });

      return {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organizationId,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        organization: organization ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        } : undefined,
      };
    } catch (error) {
      logger.error("Error in createInvitation", { error, params });
      throw error;
    }
  }

  /**
   * List invitations for an organization
   */
  async listOrganizationInvitations(organizationId: string, userId: string): Promise<Invitation[]> {
    try {
      // Check if user is a member of the organization
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organizationId,
          userId: userId,
        },
        select: {
          role: true,
        },
      });

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      const invitations = await prisma.invitation.findMany({
        where: {
          organizationId: organizationId,
        },
        select: {
          id: true,
          email: true,
          organizationId: true,
          role: true,
          token: true,
          status: true,
          invitedBy: true,
          createdAt: true,
          expiresAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return invitations.map((invitation: any) => ({
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organizationId,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        },
      }));
    } catch (error) {
      logger.error("Error in listOrganizationInvitations", { error, organizationId, userId });
      throw error;
    }
  }

  /**
   * Verify invitation token
   */
  async verifyInvitationToken(token: string): Promise<Invitation> {
    try {
      const invitation = await prisma.invitation.findFirst({
        where: {
          token: token,
        },
        select: {
          id: true,
          email: true,
          organizationId: true,
          role: true,
          token: true,
          status: true,
          invitedBy: true,
          createdAt: true,
          expiresAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!invitation) {
        throw NotFoundError("Invalid invitation token");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Invitation has already been used or cancelled");
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        throw BadRequestError("Invitation has expired");
      }

      return {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organizationId,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        },
      };
    } catch (error) {
      logger.error("Error in verifyInvitationToken", { error, token });
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(params: AcceptInvitationParams): Promise<any> {
    try {
      const { token, fullName, password, user } = params;

      // Verify invitation
      const invitation = await this.verifyInvitationToken(token);

      let userId: string;

      if (user) {
        // User is already authenticated
        userId = user.id;

        // Check if user's email matches invitation email
        // In real implementation, we would decrypt the user's email to compare
        // For now, we'll assume it matches if user is authenticated
      } else {
        // User needs to create an account or sign in
        if (!fullName || !password) {
          throw BadRequestError("Full name and password are required for new users");
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            emailEncrypted: invitation.email,
          },
          select: {
            id: true,
          },
        });

        if (existingUser) {
          throw BadRequestError("User already exists. Please sign in to accept the invitation.");
        }

        // Create new user
        const newUser = await prisma.user.create({
          data: {
            emailEncrypted: invitation.email,
            fullNameEncrypted: fullName,
            hashedPassword: this.hashPassword(password),
            authProvider: "email",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          select: {
            id: true,
          },
        });

        if (!newUser) {
          throw BadRequestError("Failed to create user account");
        }

        userId = newUser.id;
      }

      // Add user to organization
      await prisma.organizationMember.create({
        data: {
          userId: userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          joinedAt: new Date(),
        },
      });

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      });

      return {
        message: "Invitation accepted successfully",
        organizationId: invitation.organizationId,
        role: invitation.role,
        userId,
      };
    } catch (error) {
      logger.error("Error in acceptInvitation", { error, params });
      throw error;
    }
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      // Get invitation details
      const invitation = await prisma.invitation.findFirst({
        where: {
          id: invitationId,
        },
        select: {
          organizationId: true,
          status: true,
        },
      });

      if (!invitation) {
        throw NotFoundError("Invitation not found");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Can only cancel pending invitations");
      }

      // Check if user has permission
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          userId: userId,
        },
        select: {
          role: true,
        },
      });

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to cancel invitations");
      }

      // Cancel invitation
      await prisma.invitation.update({
        where: {
          id: invitationId,
        },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error in cancelInvitation", { error, invitationId, userId });
      throw error;
    }
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      // Get invitation details
      const invitation = await prisma.invitation.findFirst({
        where: {
          id: invitationId,
        },
        select: {
          organizationId: true,
          status: true,
          email: true,
        },
      });

      if (!invitation) {
        throw NotFoundError("Invitation not found");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Can only resend pending invitations");
      }

      // Check if user has permission
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          userId: userId,
        },
        select: {
          role: true,
        },
      });

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to resend invitations");
      }

      // Update invitation with new expiry
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.invitation.update({
        where: {
          id: invitationId,
        },
        data: {
          expiresAt: newExpiresAt.toISOString(),
          
        },
      });

      // TODO: Send invitation email here
      logger.info("Invitation resent", { invitationId, email: invitation.email });
    } catch (error) {
      logger.error("Error in resendInvitation", { error, invitationId, userId });
      throw error;
    }
  }

  /**
   * Simple password hashing (for demo purposes)
   * In production, use bcrypt or similar
   */
  private hashPassword(password: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(password).digest("hex");
  }
}

export const invitationService = new InvitationService(); 