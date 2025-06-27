import { createHash } from "crypto";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  preferredLanguage: string;
  preferredTimezone: string;
  role?: string;
  organizationId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface UpdateProfileParams {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  preferredLanguage?: string;
  preferredTimezone?: string;
}

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  organizationId?: string;
}

class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      // In a real app, this would use the secure PII decryption functions
      // For this example, we're simulating the decryption

      // 1. Get user data
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          organizationId: true,
          preferredLanguage: true,
          preferredTimezone: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!userData) {
        logger.error("User not found in database", { userId });
        throw NotFoundError("User not found");
      }

      // 2. Get organization membership if no direct organizationId
      let organizationId = userData.organizationId;
      let role = userData.role;
      
      if (!organizationId) {
        const orgMembership = await prisma.organizationMember.findFirst({
          where: { userId },
          select: {
            organizationId: true,
            role: true,
          },
        });
        organizationId = orgMembership?.organizationId;
        role = orgMembership?.role;
      }

      // 3. Use actual user data (prefer firstName/lastName over fullName)
      const email = userData.email || `user_${userId.substring(0, 8)}@example.com`;
      const fullName = userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`
        : userData.fullName || `User ${userId.substring(0, 8)}`;

      return {
        id: userData.id,
        email,
        fullName,
        preferredLanguage: userData.preferredLanguage,
        preferredTimezone: userData.preferredTimezone,
        organizationId,
        role,
        createdAt: userData.createdAt.toISOString(),
        lastLoginAt: userData.lastLoginAt?.toISOString(),
      };
    } catch (error) {
      logger.error("Error getting user profile", { error, userId });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, params: UpdateProfileParams): Promise<UserProfile> {
    try {
      const updateData: Record<string, any> = {};
      const { fullName, firstName, lastName, preferredLanguage, preferredTimezone } = params;

      // Build update data object with only provided fields
      if (fullName !== undefined) {
        updateData.fullName = fullName;
      }

      if (firstName !== undefined) {
        updateData.firstName = firstName;
      }

      if (lastName !== undefined) {
        updateData.lastName = lastName;
      }

      if (preferredLanguage !== undefined) {
        updateData.preferredLanguage = preferredLanguage;
      }

      if (preferredTimezone !== undefined) {
        updateData.preferredTimezone = preferredTimezone;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();

        await prisma.user.update({
          where: { id: userId },
          data: updateData,
        });
      }

      // Get updated profile
      return this.getUserProfile(userId);
    } catch (error) {
      logger.error("Error updating user profile", { error, userId });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // 1. Get user's current password hash
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { hashedPassword: true, authProvider: true },
      });

      if (!userData) {
        logger.error("User not found for password change", { userId });
        throw NotFoundError("User not found");
      }

      // 2. If user uses SSO, don't allow password change
      if (userData.authProvider && userData.authProvider !== "email") {
        throw BadRequestError("Password change not allowed for SSO users");
      }

      // 3. Verify current password
      const hashedCurrentPassword = this.hashPassword(currentPassword);
      if (userData.hashedPassword !== hashedCurrentPassword) {
        throw UnauthorizedError("Current password is incorrect");
      }

      // 4. Hash new password
      const hashedNewPassword = this.hashPassword(newPassword);

      // 5. Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          hashedPassword: hashedNewPassword,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error changing password", { error, userId });
      throw error;
    }
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(params: ListUsersParams): Promise<{ users: UserProfile[]; total: number }> {
    try {
      const { page, limit, search, organizationId } = params;
      const offset = (page - 1) * limit;

      // Build where clause
      let whereClause: any = {};
      if (organizationId) {
        whereClause.organizationMembers = {
          some: {
            organizationId: organizationId,
          },
        };
      }

      // Execute query with proper pagination
      const [usersData, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            preferredLanguage: true,
            preferredTimezone: true,
            createdAt: true,
            lastLoginAt: true,
            accountStatus: true,
            organizationMembers: {
              select: {
                organizationId: true,
                role: true,
              },
            },
          },
          where: whereClause,
          take: search ? 5 : limit, // Limit search results
          skip: search ? 0 : offset,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      // Transform results
      const users = await Promise.all(
        usersData.map(async (userData: any) => {
          // Simulate decrypting PII
          const userId = userData.id;
          const email = `user_${userId.substring(0, 8)}@example.com`;
          const fullName = `User ${userId.substring(0, 8)}`;

          const orgMembership = userData.organizationMembers[0];

          return {
            id: userId,
            email,
            fullName,
            preferredLanguage: userData.preferredLanguage,
            preferredTimezone: userData.preferredTimezone,
            organizationId: orgMembership?.organizationId,
            role: orgMembership?.role,
            createdAt: userData.createdAt.toISOString(),
            lastLoginAt: userData.lastLoginAt?.toISOString(),
          };
        })
      );

      return {
        users,
        total,
      };
    } catch (error) {
      logger.error("Error listing users", { error });
      throw error;
    }
  }

  /**
   * Hash password
   * Note: In a production app, use bcrypt or another proper password hashing library
   */
  private hashPassword(password: string): string {
    const salt = process.env.PASSWORD_SALT || "default_salt_for_dev_only";
    return createHash("sha256")
      .update(password + salt)
      .digest("hex");
  }
}

export const userService = new UserService();
