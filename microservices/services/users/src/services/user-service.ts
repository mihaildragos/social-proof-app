import { createHash } from "crypto";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../middleware/errorHandler";
import { db } from "../utils/db";
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
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select(
          `
          id,
          email_encrypted,
          full_name_encrypted,
          preferred_language,
          preferred_timezone,
          created_at,
          last_login_at
        `
        )
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        logger.error("Supabase error getting user profile", { error: userError, userId });
        throw NotFoundError("User not found");
      }

      // 2. Get organization membership
      const { data: orgMembership, error: orgError } = await supabase
        .from("organization_members")
        .select(
          `
          organization_id,
          role
        `
        )
        .eq("user_id", userId)
        .limit(1)
        .single();

      // 3. Simulate decrypting PII (in a real app would call the pgcrypto functions)
      // This is just a placeholder for the actual implementation
      const email = `user_${userId.substring(0, 8)}@example.com`;
      const fullName = `User ${userId.substring(0, 8)}`;

      return {
        id: userData.id,
        email,
        fullName,
        preferredLanguage: userData.preferred_language,
        preferredTimezone: userData.preferred_timezone,
        organizationId: orgMembership?.organization_id,
        role: orgMembership?.role,
        createdAt: userData.created_at,
        lastLoginAt: userData.last_login_at,
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
      const { fullName, preferredLanguage, preferredTimezone } = params;

      // Build update data object with only provided fields
      if (fullName !== undefined) {
        // In a real app, we would encrypt the full name here
        // For now we'll just set a flag to update it
        updateData.full_name = fullName;
      }

      if (preferredLanguage !== undefined) {
        updateData.preferred_language = preferredLanguage;
      }

      if (preferredTimezone !== undefined) {
        updateData.preferred_timezone = preferredTimezone;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();

        const { error } = await supabase.from("users").update(updateData).eq("id", userId);

        if (error) {
          logger.error("Supabase error updating user profile", { error, userId });
          throw BadRequestError("Failed to update profile");
        }
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
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("hashed_password, auth_provider")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        logger.error("Supabase error getting user data", { error: userError, userId });
        throw NotFoundError("User not found");
      }

      // 2. If user uses SSO, don't allow password change
      if (userData.auth_provider && userData.auth_provider !== "email") {
        throw BadRequestError("Password change not allowed for SSO users");
      }

      // 3. Verify current password
      const hashedCurrentPassword = this.hashPassword(currentPassword);
      if (userData.hashed_password !== hashedCurrentPassword) {
        throw UnauthorizedError("Current password is incorrect");
      }

      // 4. Hash new password
      const hashedNewPassword = this.hashPassword(newPassword);

      // 5. Update password
      const { error: updateError } = await supabase
        .from("users")
        .update({
          hashed_password: hashedNewPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        logger.error("Supabase error updating password", { error: updateError, userId });
        throw BadRequestError("Failed to update password");
      }
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

      // Start building the query
      let query = supabase.from("users").select(
        `
          id,
          preferred_language,
          preferred_timezone,
          created_at,
          last_login_at,
          account_status,
          organization_members!inner(
            organization_id,
            role
          )
        `,
        { count: "exact" }
      );

      // Apply organization filter if provided
      if (organizationId) {
        query = query.eq("organization_members.organization_id", organizationId);
      }

      // Apply search filter if provided
      if (search) {
        // In a real app, we would search in decrypted emails and names
        // For this example, we'll just simulate it by limiting results
        query = query.limit(search ? 5 : limit);
      } else {
        // Apply pagination
        query = query.range(offset, offset + limit - 1);
      }

      // Execute query
      const { data: usersData, error, count } = await query;

      if (error) {
        logger.error("Supabase error listing users", { error });
        throw BadRequestError("Failed to list users");
      }

      // Transform results
      const users = await Promise.all(
        (usersData || []).map(async (userData: any) => {
          // Simulate decrypting PII
          const userId = userData.id;
          const email = `user_${userId.substring(0, 8)}@example.com`;
          const fullName = `User ${userId.substring(0, 8)}`;

          const orgMembership = userData.organization_members[0];

          return {
            id: userId,
            email,
            fullName,
            preferredLanguage: userData.preferred_language,
            preferredTimezone: userData.preferred_timezone,
            organizationId: orgMembership?.organization_id,
            role: orgMembership?.role,
            createdAt: userData.created_at,
            lastLoginAt: userData.last_login_at,
          };
        })
      );

      return {
        users,
        total: count || users.length,
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
