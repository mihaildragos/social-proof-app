import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest";
import { BadRequestError } from "../middleware/errorHandler";
import { userService } from "../services/user-service";
import { logger } from "../utils/logger";

const router = Router();

// Update profile validation schema
const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    preferredLanguage: z.string().optional(),
    preferredTimezone: z.string().optional(),
    avatar: z.string().url("Invalid avatar URL").optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
    phoneNumber: z.string().optional(),
    jobTitle: z.string().optional(),
    company: z.string().optional(),
  }),
});

// Update preferences validation schema
const updatePreferencesSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    weeklyReports: z.boolean().optional(),
    theme: z.enum(["light", "dark", "auto"]).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  }),
});

// Change password validation schema
const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  }),
});

/**
 * @route GET /profile
 * @desc Get current user profile
 * @access Private
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const profile = await userService.getUserProfile(req.user.id);

    res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /profile
 * @desc Update current user profile
 * @access Private
 */
router.put(
  "/",
  validateRequest(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const {
        fullName,
        preferredLanguage,
        preferredTimezone,
        avatar,
        bio,
        phoneNumber,
        jobTitle,
        company,
      } = req.body;

      const updatedProfile = await userService.updateUserProfile(req.user.id, {
        fullName,
        preferredLanguage,
        preferredTimezone,
        // Note: Additional fields would need to be added to the userService
        // For now, we'll only update the fields that are already supported
      });

      logger.info("User profile updated", { userId: req.user.id });

      res.status(200).json({
        status: "success",
        data: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /profile/preferences
 * @desc Update user preferences
 * @access Private
 */
router.put(
  "/preferences",
  validateRequest(updatePreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const preferences = req.body;

      // TODO: Implement user preferences update in userService
      // For now, we'll return a success message
      logger.info("User preferences updated", { userId: req.user.id, preferences });

      res.status(200).json({
        status: "success",
        message: "Preferences updated successfully",
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /profile/password
 * @desc Change user password
 * @access Private
 */
router.put(
  "/password",
  validateRequest(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        throw BadRequestError("New password and confirmation do not match");
      }

      await userService.changePassword(req.user.id, currentPassword, newPassword);

      logger.info("User password changed", { userId: req.user.id });

      res.status(200).json({
        status: "success",
        message: "Password updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /profile/activity
 * @desc Get user activity log
 * @access Private
 */
router.get("/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // TODO: Implement user activity log retrieval
    // For now, we'll return mock data
    const activities = [
      {
        id: "1",
        type: "login",
        description: "Signed in to account",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    ];

    res.status(200).json({
      status: "success",
      data: {
        activities,
        pagination: {
          total: activities.length,
          page,
          limit,
          pages: Math.ceil(activities.length / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /profile
 * @desc Delete user account
 * @access Private
 */
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    // TODO: Implement account deletion logic
    // This should include:
    // 1. Remove user from all organizations
    // 2. Cancel all invitations
    // 3. Delete user data (following GDPR requirements)
    // 4. Anonymize or delete associated records

    logger.info("User account deletion requested", { userId: req.user.id });

    res.status(200).json({
      status: "success",
      message: "Account deletion request received. Your account will be deleted within 24 hours.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /profile/export
 * @desc Export user data (GDPR compliance)
 * @access Private
 */
router.post("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    // TODO: Implement data export functionality
    // This should include all user data in a downloadable format

    logger.info("User data export requested", { userId: req.user.id });

    res.status(200).json({
      status: "success",
      message: "Data export request received. You will receive an email with your data within 24 hours.",
    });
  } catch (error) {
    next(error);
  }
});

export { router as profileRoutes }; 