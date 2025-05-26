import { BadRequestError, NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import { db } from "../utils/db";
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
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, invitedBy]
      );

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to send invitations");
      }

      // Check if user is already a member
      const existingUser = await db.getOne(
        `SELECT u.id FROM users u 
         JOIN organization_members om ON u.id = om.user_id 
         WHERE u.email_encrypted = $1 AND om.organization_id = $2`,
        [email, organizationId] // Note: In real implementation, email would be encrypted
      );

      if (existingUser) {
        throw BadRequestError("User is already a member of this organization");
      }

      // Check if there's already a pending invitation
      const existingInvitation = await db.getOne(
        "SELECT id FROM invitations WHERE email = $1 AND organization_id = $2 AND status = 'pending'",
        [email, organizationId]
      );

      if (existingInvitation) {
        throw BadRequestError("Invitation already sent to this email");
      }

      // Generate secure token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const invitation = await db.getOne(
        `INSERT INTO invitations (email, organization_id, role, token, status, invited_by, created_at, expires_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), $6)
         RETURNING id, email, organization_id, role, token, status, invited_by, created_at, expires_at`,
        [email, organizationId, role, token, invitedBy, expiresAt.toISOString()]
      );

      if (!invitation) {
        throw BadRequestError("Failed to create invitation");
      }

      // Get organization details
      const organization = await db.getOne(
        "SELECT id, name, slug FROM organizations WHERE id = $1",
        [organizationId]
      );

      // TODO: Send invitation email here
      logger.info("Invitation created", { invitationId: invitation.id, email, organizationId });

      return {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organization_id,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invited_by,
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at,
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
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId]
      );

      if (!membership) {
        throw UnauthorizedError("Not authorized to access this organization");
      }

      const invitations = await db.getMany(
        `SELECT i.id, i.email, i.organization_id, i.role, i.token, i.status, 
                i.invited_by, i.created_at, i.expires_at,
                o.id as org_id, o.name as org_name, o.slug as org_slug
         FROM invitations i
         JOIN organizations o ON i.organization_id = o.id
         WHERE i.organization_id = $1
         ORDER BY i.created_at DESC`,
        [organizationId]
      );

      return invitations.map((invitation: any) => ({
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organization_id,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invited_by,
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at,
        organization: {
          id: invitation.org_id,
          name: invitation.org_name,
          slug: invitation.org_slug,
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
      const invitation = await db.getOne(
        `SELECT i.id, i.email, i.organization_id, i.role, i.token, i.status, 
                i.invited_by, i.created_at, i.expires_at,
                o.id as org_id, o.name as org_name, o.slug as org_slug
         FROM invitations i
         JOIN organizations o ON i.organization_id = o.id
         WHERE i.token = $1`,
        [token]
      );

      if (!invitation) {
        throw NotFoundError("Invalid invitation token");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Invitation has already been used or cancelled");
      }

      if (new Date(invitation.expires_at) < new Date()) {
        throw BadRequestError("Invitation has expired");
      }

      return {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organization_id,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invited_by,
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at,
        organization: {
          id: invitation.org_id,
          name: invitation.org_name,
          slug: invitation.org_slug,
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
        const existingUser = await db.getOne(
          "SELECT id FROM users WHERE email_encrypted = $1",
          [invitation.email] // Note: In real implementation, email would be encrypted
        );

        if (existingUser) {
          throw BadRequestError("User already exists. Please sign in to accept the invitation.");
        }

        // Create new user
        const newUser = await db.getOne(
          `INSERT INTO users (email_encrypted, full_name_encrypted, hashed_password, auth_provider, created_at, updated_at)
           VALUES ($1, $2, $3, 'email', NOW(), NOW())
           RETURNING id`,
          [
            invitation.email, // Note: In real implementation, would be encrypted
            fullName, // Note: In real implementation, would be encrypted
            this.hashPassword(password), // Simple hash for demo
          ]
        );

        if (!newUser) {
          throw BadRequestError("Failed to create user account");
        }

        userId = newUser.id;
      }

      // Add user to organization
      await db.execute(
        `INSERT INTO organization_members (user_id, organization_id, role, joined_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, invitation.organizationId, invitation.role]
      );

      // Mark invitation as accepted
      await db.execute(
        "UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1",
        [invitation.id]
      );

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
      const invitation = await db.getOne(
        "SELECT organization_id, status FROM invitations WHERE id = $1",
        [invitationId]
      );

      if (!invitation) {
        throw NotFoundError("Invitation not found");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Can only cancel pending invitations");
      }

      // Check if user has permission
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [invitation.organization_id, userId]
      );

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to cancel invitations");
      }

      // Cancel invitation
      await db.execute(
        "UPDATE invitations SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
        [invitationId]
      );
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
      const invitation = await db.getOne(
        "SELECT organization_id, status, email FROM invitations WHERE id = $1",
        [invitationId]
      );

      if (!invitation) {
        throw NotFoundError("Invitation not found");
      }

      if (invitation.status !== "pending") {
        throw BadRequestError("Can only resend pending invitations");
      }

      // Check if user has permission
      const membership = await db.getOne(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [invitation.organization_id, userId]
      );

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        throw UnauthorizedError("Not authorized to resend invitations");
      }

      // Update invitation with new expiry
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await db.execute(
        "UPDATE invitations SET expires_at = $1, updated_at = NOW() WHERE id = $2",
        [newExpiresAt.toISOString(), invitationId]
      );

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