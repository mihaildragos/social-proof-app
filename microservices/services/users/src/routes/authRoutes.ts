import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";
import { BadRequestError, UnauthorizedError } from "../middleware/errorHandler";
import { validateRequest } from "../middleware/validateRequest";
import { authService } from "../services/authService";

const router = Router();

// Login request validation schema
const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

// Signup request validation schema
const signupSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    preferredLanguage: z.string().optional(),
    preferredTimezone: z.string().optional(),
  }),
});

// Forgot password request validation schema
const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

// Reset password request validation schema
const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

/**
 * @route POST /auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post(
  "/login",
  validateRequest(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      logger.info("User logged in successfully", { userId: result.user.id });

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post(
  "/signup",
  validateRequest(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, preferredLanguage, preferredTimezone } = req.body;

      const result = await authService.signup({
        email,
        password,
        fullName,
        preferredLanguage,
        preferredTimezone,
      });

      logger.info("User registered successfully", { userId: result.user.id });

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /auth/forgot-password
 * @desc Request password reset email
 * @access Public
 */
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      await authService.forgotPassword(email);

      logger.info("Password reset requested", { email });

      // Always return success for security reasons, even if email doesn't exist
      res.status(200).json({
        status: "success",
        message: "If the email exists, a password reset link has been sent",
      });
    } catch (error) {
      // Don't expose error details for security
      logger.error("Error in forgot password endpoint", { error });

      res.status(200).json({
        status: "success",
        message: "If the email exists, a password reset link has been sent",
      });
    }
  }
);

/**
 * @route POST /auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;

      await authService.resetPassword(token, password);

      logger.info("Password reset successfully");

      res.status(200).json({
        status: "success",
        message: "Password has been reset successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /auth/logout
 * @desc Logout and invalidate token
 * @access Private
 */
router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw UnauthorizedError("Not authenticated");
    }

    await authService.logout(req.user.id);

    logger.info("User logged out successfully", { userId: req.user.id });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /auth/verify-email
 * @desc Verify email with token
 * @access Public
 */
router.get("/verify-email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      throw BadRequestError("Token is required");
    }

    await authService.verifyEmail(token);

    logger.info("Email verified successfully");

    res.status(200).json({
      status: "success",
      message: "Email has been verified successfully",
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };
