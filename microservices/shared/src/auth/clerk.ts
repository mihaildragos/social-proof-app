import { getContextLogger } from "../utils/logger";
import { AuthMiddleware, JWTPayload } from "../middleware/auth";
import { Role, RBACService } from "./rbac";

const logger = getContextLogger({ service: "clerk-integration" });

export interface ClerkUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  organizationMemberships?: ClerkOrganizationMembership[];
}

export interface ClerkOrganizationMembership {
  id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  permissions: string[];
}

export interface ClerkWebhookEvent {
  type: string;
  data: any;
  object: string;
}

export class ClerkService {
  private authMiddleware: AuthMiddleware;
  private clerkSecretKey: string;
  private clerkWebhookSecret: string;

  constructor(
    clerkSecretKey: string = process.env.CLERK_SECRET_KEY || "",
    clerkWebhookSecret: string = process.env.CLERK_WEBHOOK_SECRET || ""
  ) {
    this.clerkSecretKey = clerkSecretKey;
    this.clerkWebhookSecret = clerkWebhookSecret;
    this.authMiddleware = new AuthMiddleware();
  }

  /**
   * Convert Clerk user to internal JWT payload
   */
  convertClerkUserToJWT(clerkUser: ClerkUser, organizationId?: string): JWTPayload {
    // Get the primary organization membership or use provided organizationId
    const primaryMembership =
      organizationId ?
        clerkUser.organizationMemberships?.find((m) => m.organization.id === organizationId)
      : clerkUser.organizationMemberships?.[0];

    if (!primaryMembership && !organizationId) {
      throw new Error("User must belong to an organization");
    }

    // Map Clerk role to internal role
    const internalRole = this.mapClerkRoleToInternal(primaryMembership?.role || "member");
    const permissions = RBACService.getUserPermissions(internalRole);

    return {
      sub: clerkUser.id,
      email: clerkUser.email,
      organizationId: organizationId || primaryMembership!.organization.id,
      role: internalRole,
      permissions: permissions.map((p) => p.toString()),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      iss: process.env.JWT_ISSUER || "social-proof-app",
      aud: process.env.JWT_AUDIENCE || "social-proof-api",
    };
  }

  /**
   * Map Clerk organization role to internal role
   */
  private mapClerkRoleToInternal(clerkRole: string): Role {
    const roleMapping: Record<string, Role> = {
      admin: Role.ADMIN,
      "org:admin": Role.ADMIN,
      analyst: Role.ANALYST,
      "org:analyst": Role.ANALYST,
      designer: Role.DESIGNER,
      "org:designer": Role.DESIGNER,
      member: Role.DESIGNER, // Default to designer for basic members
      "org:member": Role.DESIGNER,
    };

    const mappedRole = roleMapping[clerkRole.toLowerCase()];
    if (!mappedRole) {
      logger.warn("Unknown Clerk role, defaulting to designer", { clerkRole });
      return Role.DESIGNER;
    }

    return mappedRole;
  }

  /**
   * Generate internal JWT token from Clerk user
   */
  generateTokenFromClerkUser(clerkUser: ClerkUser, organizationId?: string): string {
    try {
      const jwtPayload = this.convertClerkUserToJWT(clerkUser, organizationId);
      return this.authMiddleware.generateToken(jwtPayload);
    } catch (error) {
      logger.error("Failed to generate token from Clerk user", {
        error: error instanceof Error ? error.message : String(error),
        userId: clerkUser.id,
      });
      throw error;
    }
  }

  /**
   * Verify Clerk webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      // Clerk uses HMAC-SHA256 for webhook signatures
      const crypto = require("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", this.clerkWebhookSecret)
        .update(payload)
        .digest("hex");

      // Clerk sends signature in format: v1,<signature>
      const receivedSignature = signature.replace("v1,", "");

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(receivedSignature, "hex")
      );
    } catch (error) {
      logger.error("Failed to verify webhook signature", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Process Clerk webhook events
   */
  async processWebhookEvent(event: ClerkWebhookEvent): Promise<void> {
    try {
      logger.info("Processing Clerk webhook event", { type: event.type, object: event.object });

      switch (event.type) {
        case "user.created":
          await this.handleUserCreated(event.data);
          break;
        case "user.updated":
          await this.handleUserUpdated(event.data);
          break;
        case "user.deleted":
          await this.handleUserDeleted(event.data);
          break;
        case "organizationMembership.created":
          await this.handleOrganizationMembershipCreated(event.data);
          break;
        case "organizationMembership.updated":
          await this.handleOrganizationMembershipUpdated(event.data);
          break;
        case "organizationMembership.deleted":
          await this.handleOrganizationMembershipDeleted(event.data);
          break;
        case "organization.created":
          await this.handleOrganizationCreated(event.data);
          break;
        case "organization.updated":
          await this.handleOrganizationUpdated(event.data);
          break;
        case "organization.deleted":
          await this.handleOrganizationDeleted(event.data);
          break;
        default:
          logger.warn("Unhandled webhook event type", { type: event.type });
      }
    } catch (error) {
      logger.error("Failed to process webhook event", {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
      });
      throw error;
    }
  }

  /**
   * Handle user created event
   */
  private async handleUserCreated(userData: any): Promise<void> {
    logger.info("User created in Clerk", {
      userId: userData.id,
      email: userData.email_addresses?.[0]?.email_address,
    });
    // TODO: Sync user to internal database
  }

  /**
   * Handle user updated event
   */
  private async handleUserUpdated(userData: any): Promise<void> {
    logger.info("User updated in Clerk", { userId: userData.id });
    // TODO: Update user in internal database
  }

  /**
   * Handle user deleted event
   */
  private async handleUserDeleted(userData: any): Promise<void> {
    logger.info("User deleted in Clerk", { userId: userData.id });
    // TODO: Handle user deletion in internal database
  }

  /**
   * Handle organization membership created event
   */
  private async handleOrganizationMembershipCreated(membershipData: any): Promise<void> {
    logger.info("Organization membership created", {
      userId: membershipData.public_user_data?.user_id,
      organizationId: membershipData.organization?.id,
      role: membershipData.role,
    });
    // TODO: Update user permissions in internal database
  }

  /**
   * Handle organization membership updated event
   */
  private async handleOrganizationMembershipUpdated(membershipData: any): Promise<void> {
    logger.info("Organization membership updated", {
      userId: membershipData.public_user_data?.user_id,
      organizationId: membershipData.organization?.id,
      role: membershipData.role,
    });
    // TODO: Update user permissions in internal database
  }

  /**
   * Handle organization membership deleted event
   */
  private async handleOrganizationMembershipDeleted(membershipData: any): Promise<void> {
    logger.info("Organization membership deleted", {
      userId: membershipData.public_user_data?.user_id,
      organizationId: membershipData.organization?.id,
    });
    // TODO: Remove user access to organization in internal database
  }

  /**
   * Handle organization created event
   */
  private async handleOrganizationCreated(organizationData: any): Promise<void> {
    logger.info("Organization created in Clerk", {
      organizationId: organizationData.id,
      name: organizationData.name,
    });
    // TODO: Create organization in internal database
  }

  /**
   * Handle organization updated event
   */
  private async handleOrganizationUpdated(organizationData: any): Promise<void> {
    logger.info("Organization updated in Clerk", {
      organizationId: organizationData.id,
      name: organizationData.name,
    });
    // TODO: Update organization in internal database
  }

  /**
   * Handle organization deleted event
   */
  private async handleOrganizationDeleted(organizationData: any): Promise<void> {
    logger.info("Organization deleted in Clerk", {
      organizationId: organizationData.id,
    });
    // TODO: Handle organization deletion in internal database
  }

  /**
   * Validate Clerk session token
   */
  async validateClerkSession(sessionToken: string): Promise<ClerkUser | null> {
    try {
      // TODO: Implement Clerk session validation
      // This would typically involve calling Clerk's API to verify the session
      logger.debug("Validating Clerk session token");
      return null;
    } catch (error) {
      logger.error("Failed to validate Clerk session", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get user organizations from Clerk
   */
  async getUserOrganizations(userId: string): Promise<ClerkOrganizationMembership[]> {
    try {
      // TODO: Implement Clerk API call to get user organizations
      logger.debug("Getting user organizations from Clerk", { userId });
      return [];
    } catch (error) {
      logger.error("Failed to get user organizations", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }
}

// Export singleton instance
export const clerkService = new ClerkService();
