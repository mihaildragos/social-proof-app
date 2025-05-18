import { SignJWT } from "jose";
import { randomBytes, createHash } from "crypto";
import { UnauthorizedError, BadRequestError, ConflictError } from "../middleware/errorHandler";
import { supabase } from "../index";
import { logger } from "../utils/logger";

// Define interfaces
interface SignupParams {
  email: string;
  password: string;
  fullName: string;
  preferredLanguage?: string;
  preferredTimezone?: string;
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
      // 1. Find user with email
      const { data: users, error } = await supabase
        .from("users")
        .select("id, auth_provider, hashed_password")
        .eq("email", email)
        .limit(1);

      if (error) {
        logger.error("Supabase error during login", { error });
        throw UnauthorizedError("Invalid credentials");
      }

      if (!users || users.length === 0) {
        throw UnauthorizedError("Invalid credentials");
      }

      const user = users[0];

      // 2. If user uses SSO, don't allow password login
      if (user.auth_provider && user.auth_provider !== "email") {
        throw UnauthorizedError("Please login using your SSO provider");
      }

      // 3. Verify password
      const hashedPassword = this.hashPassword(password);
      if (user.hashed_password !== hashedPassword) {
        throw UnauthorizedError("Invalid credentials");
      }

      // 4. Get full user profile
      const userProfile = await this.getUserProfile(user.id);

      // 5. Generate JWT token
      const token = await this.generateToken(
        user.id,
        userProfile.email,
        userProfile.organizationId,
        userProfile.role
      );

      // 6. Update last login timestamp
      await supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", user.id);

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
      const { email, password, fullName, preferredLanguage, preferredTimezone } = params;

      // 1. Check if email already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1);

      if (checkError) {
        logger.error("Supabase error during signup check", { error: checkError });
        throw BadRequestError("Failed to create account");
      }

      if (existingUsers && existingUsers.length > 0) {
        throw ConflictError("Email already in use");
      }

      // 2. Hash password
      const hashedPassword = this.hashPassword(password);

      // 3. Generate verification token
      const verificationToken = randomBytes(32).toString("hex");
      const tokenExpiration = new Date();
      tokenExpiration.setHours(tokenExpiration.getHours() + 24); // 24 hours

      // 4. Create user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email,
          full_name: fullName,
          hashed_password: hashedPassword,
          auth_provider: "email",
          preferred_language: preferredLanguage || "en",
          preferred_timezone: preferredTimezone || "UTC",
          verification_token: verificationToken,
          verification_token_expires_at: tokenExpiration.toISOString(),
          account_status: "unverified",
        })
        .select("id")
        .single();

      if (createError || !newUser) {
        logger.error("Supabase error during user creation", { error: createError });
        throw BadRequestError("Failed to create account");
      }

      // 5. Generate JWT token
      const token = await this.generateToken(newUser.id, email, null, "user");

      // 6. Send verification email (in a real app this would call an email service)
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
   * Send password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      // 1. Find user with email
      const { data: users, error } = await supabase
        .from("users")
        .select("id, auth_provider")
        .eq("email", email)
        .limit(1);

      if (error) {
        logger.error("Supabase error during forgot password", { error });
        return; // Don't expose if user exists or not
      }

      if (!users || users.length === 0) {
        return; // Don't expose if user exists or not
      }

      const user = users[0];

      // 2. If user uses SSO, don't allow password reset
      if (user.auth_provider && user.auth_provider !== "email") {
        return; // Don't expose if user uses SSO
      }

      // 3. Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      const tokenExpiration = new Date();
      tokenExpiration.setHours(tokenExpiration.getHours() + 1); // 1 hour

      // 4. Save reset token
      await supabase
        .from("users")
        .update({
          reset_token: resetToken,
          reset_token_expires_at: tokenExpiration.toISOString(),
        })
        .eq("id", user.id);

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
      const now = new Date().toISOString();
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("reset_token", token)
        .gt("reset_token_expires_at", now)
        .limit(1);

      if (error) {
        logger.error("Supabase error during reset password", { error });
        throw BadRequestError("Invalid or expired token");
      }

      if (!users || users.length === 0) {
        throw BadRequestError("Invalid or expired token");
      }

      const user = users[0];

      // 2. Hash new password
      const hashedPassword = this.hashPassword(newPassword);

      // 3. Update password and clear token
      await supabase
        .from("users")
        .update({
          hashed_password: hashedPassword,
          reset_token: null,
          reset_token_expires_at: null,
        })
        .eq("id", user.id);
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
      const now = new Date().toISOString();
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("verification_token", token)
        .gt("verification_token_expires_at", now)
        .eq("account_status", "unverified")
        .limit(1);

      if (error) {
        logger.error("Supabase error during email verification", { error });
        throw BadRequestError("Invalid or expired token");
      }

      if (!users || users.length === 0) {
        throw BadRequestError("Invalid or expired token");
      }

      const user = users[0];

      // 2. Update account status and clear token
      await supabase
        .from("users")
        .update({
          account_status: "active",
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq("id", user.id);
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
      await supabase
        .from("users")
        .update({ last_logout_at: new Date().toISOString() })
        .eq("id", userId);
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
   * Get user profile
   */
  private async getUserProfile(userId: string): Promise<{
    email: string;
    fullName: string;
    organizationId?: string;
    role?: string;
  }> {
    // In a real app, this would use the secure PII decryption functions
    // For this example, we're simulating the decryption

    // 1. Get user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        email_encrypted,
        full_name_encrypted
      `
      )
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      logger.error("Supabase error getting user profile", { error: userError, userId });
      throw new Error("Failed to get user profile");
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
      email,
      fullName,
      organizationId: orgMembership?.organization_id,
      role: orgMembership?.role,
    };
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
