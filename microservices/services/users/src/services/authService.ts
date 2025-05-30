import { SignJWT } from "jose";
import { randomBytes, createHash } from "crypto";
import { UnauthorizedError, BadRequestError, ConflictError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

// Define interfaces
interface SignupParams {
  email: string;
  password: string;
  fullName: string;
  preferredLanguage?: string;
  preferredTimezone?: string;
  clerkUserId?: string; // For Clerk sync
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    role?: string;
  };
  token: string;
  expiresAt: number;
}

class AuthService {
  /**
   * Authenticate a user and generate JWT token
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // 1. Find user with email using Prisma
      const user = await prisma.user.findFirst({
        where: {
          AND: [
            { email: { contains: email } }, // This would need custom function for encrypted search
            { authProvider: "email" },
          ],
        },
        select: {
          id: true,
          hashedPassword: true,
          authProvider: true,
          authProviderId: true,
        },
      });

      if (!user) {
        throw UnauthorizedError("Invalid credentials");
      }

      // 2. If user uses SSO, don't allow password login
      if (user.authProvider && user.authProvider !== "email") {
        throw UnauthorizedError("Please login using your SSO provider");
      }

      // 3. Verify password
      const hashedPassword = this.hashPassword(password);
      if (user.hashedPassword !== hashedPassword) {
        throw UnauthorizedError("Invalid credentials");
      }

      // 4. Get full user profile with organization
      const userProfile = await this.getUserProfile(user.id);

      // 5. Generate JWT token
      const token = await this.generateToken(
        user.id,
        userProfile.email,
        userProfile.organizationId,
        userProfile.role
      );

      // 6. Update last login timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        user: {
          id: user.id,
          email: userProfile.email,
          fullName: userProfile.fullName,
          role: userProfile.role,
        },
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
    } catch (error) {
      logger.error("Error during login", { error, email });
      throw error;
    }
  }

  /**
   * Register a new user
   */
  async signup(params: SignupParams): Promise<AuthResult> {
    try {
      const { email, password, fullName, preferredLanguage, preferredTimezone, clerkUserId } =
        params;

      // 1. Check if email already exists using Prisma
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: email }, { emailEncrypted: email }],
        },
        select: { id: true },
      });

      if (existingUser) {
        throw ConflictError("Email already in use");
      }

      // 2. Hash password
      const hashedPassword = this.hashPassword(password);

      // 3. Generate verification token
      const verificationToken = randomBytes(32).toString("hex");
      const tokenExpiration = new Date();
      tokenExpiration.setHours(tokenExpiration.getHours() + 24); // 24 hours

      // 4. Create user using Prisma
      const newUser = await prisma.user.create({
        data: {
          email: email,
          emailEncrypted: email, // In production, this would be encrypted
          fullName: fullName,
          fullNameEncrypted: fullName, // In production, this would be encrypted
          hashedPassword: hashedPassword,
          authProvider: clerkUserId ? "clerk" : "email",
          authProviderId: clerkUserId || null,
          clerkUserId: clerkUserId || null,
          preferredLanguage: preferredLanguage || "en",
          preferredTimezone: preferredTimezone || "UTC",
          verificationToken: verificationToken,
          verificationTokenExpiresAt: tokenExpiration,
          accountStatus: "unverified",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      if (!newUser) {
        throw BadRequestError("Failed to create account");
      }

      // 5. Note: Clerk sync is handled via webhooks, not direct calls here
      if (clerkUserId) {
        logger.info("User created with Clerk sync", { userId: newUser.id, clerkUserId });
      }

      // 6. Generate JWT token
      const token = await this.generateToken(newUser.id, email, null, "user");

      // 7. Send verification email (in a real app this would call an email service)
      await this.sendVerificationEmail(email, verificationToken);

      return {
        user: {
          id: newUser.id,
          email,
          fullName,
          role: "user",
        },
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
    } catch (error) {
      logger.error("Error during signup", { error, email: params.email });
      throw error;
    }
  }

  /**
   * Sync user from Clerk (for frontend auth integration)
   */
  async syncFromClerk(clerkUserId: string, clerkUserData: any): Promise<AuthResult | null> {
    try {
      // 1. Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          authProvider: "clerk",
          authProviderId: clerkUserId,
        },
      });

      if (existingUser) {
        // Update existing user data
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            lastLoginAt: new Date(),
          },
        });

        const userProfile = await this.getUserProfile(existingUser.id);
        const token = await this.generateToken(
          existingUser.id,
          userProfile.email,
          userProfile.organizationId,
          userProfile.role
        );

        return {
          user: {
            id: existingUser.id,
            email: userProfile.email,
            fullName: userProfile.fullName,
            role: userProfile.role,
          },
          token,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
      }

      // 2. Create new user from Clerk data
      return await this.signup({
        email: clerkUserData.emailAddresses[0]?.emailAddress || "",
        password: "", // No password for Clerk users
        fullName: `${clerkUserData.firstName || ""} ${clerkUserData.lastName || ""}`.trim(),
        preferredLanguage: "en",
        preferredTimezone: "UTC",
        clerkUserId: clerkUserId,
      });
    } catch (error) {
      logger.error("Error syncing from Clerk", { error, clerkUserId });
      return null;
    }
  }

  /**
   * Send password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      // 1. Find user with email using Prisma
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: email }, { emailEncrypted: email }],
        },
        select: {
          id: true,
          authProvider: true,
        },
      });

      if (!user) {
        return; // Don't expose if user exists or not
      }

      // 2. If user uses SSO, don't allow password reset
      if (user.authProvider && user.authProvider !== "email") {
        return; // Don't expose if user uses SSO
      }

      // 3. Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      const tokenExpiration = new Date();
      tokenExpiration.setHours(tokenExpiration.getHours() + 1); // 1 hour

      // 4. Save reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: resetToken,
          resetTokenExpiresAt: tokenExpiration,
        },
      });

      // 5. Send reset email (in a real app this would call an email service)
      await this.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      logger.error("Error during forgot password", { error, email });
      // Don't expose errors
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // 1. Find user with reset token
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw BadRequestError("Invalid or expired token");
      }

      // 2. Hash new password
      const hashedPassword = this.hashPassword(newPassword);

      // 3. Update password and clear token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          hashedPassword: hashedPassword,
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    } catch (error) {
      logger.error("Error during reset password", { error });
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      // 1. Find user with verification token
      const user = await prisma.user.findFirst({
        where: {
          verificationToken: token,
          verificationTokenExpiresAt: {
            gt: new Date(),
          },
          accountStatus: "unverified",
        },
      });

      if (!user) {
        throw BadRequestError("Invalid or expired token");
      }

      // 2. Update account status and clear token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountStatus: "active",
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    } catch (error) {
      logger.error("Error during email verification", { error });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    // In a real app, this would add the token to a blacklist or invalidate it
    // For this example, we'll just update the last logout timestamp
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLogoutAt: new Date() },
      });
    } catch (error) {
      logger.error("Error during logout", { error, userId });
      // Don't throw, just log
    }
  }

  // Private helper methods

  /**
   * Generate JWT token
   */
  private async generateToken(
    userId: string,
    email: string,
    organizationId?: string | null,
    role?: string | null
  ): Promise<string> {
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || "default_secret_for_dev_only"
      );
      const alg = "HS256";

      const jwt = await new SignJWT({ email, org_id: organizationId, role })
        .setProtectedHeader({ alg })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(secret);

      return jwt;
    } catch (error) {
      logger.error("Error generating JWT token", { error, userId });
      throw new Error("Authentication failed");
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

  /**
   * Get user profile using Prisma
   */
  private async getUserProfile(userId: string): Promise<{
    email: string;
    fullName: string;
    organizationId?: string;
    role?: string;
  }> {
    try {
      // 1. Get user data using Prisma
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          emailEncrypted: true,
          fullName: true,
          fullNameEncrypted: true,
        },
      });

      if (!user) {
        throw new Error("Failed to get user profile");
      }

      // 2. Get organization membership
      const orgMembership = await prisma.organizationMember.findFirst({
        where: { userId: userId },
        select: {
          organizationId: true,
          role: true,
        },
      });

      return {
        email: user.email || user.emailEncrypted || "",
        fullName: user.fullName || user.fullNameEncrypted || "",
        organizationId: orgMembership?.organizationId,
        role: orgMembership?.role,
      };
    } catch (error) {
      logger.error("Error getting user profile", { error, userId });
      throw new Error("Failed to get user profile");
    }
  }

  /**
   * Send verification email
   * Note: In a real app, this would call an email service
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    // Simulate sending email
    logger.info("Verification email would be sent", {
      to: email,
      subject: "Verify your email",
      verificationLink: `${process.env.APP_URL || "http://localhost:3000"}/auth/verify-email?token=${token}`,
    });
  }

  /**
   * Send password reset email
   * Note: In a real app, this would call an email service
   */
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // Simulate sending email
    logger.info("Password reset email would be sent", {
      to: email,
      subject: "Reset your password",
      resetLink: `${process.env.APP_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`,
    });
  }
}

export const authService = new AuthService();
