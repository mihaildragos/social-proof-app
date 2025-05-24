import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest";
import { requirePermission } from "../middleware/authMiddleware";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { userService } from "../services/userService";
import { logger } from "../utils/logger";

const router = Router();

// Update profile validation schema
const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    preferredLanguage: z.string().optional(),
    preferredTimezone: z.string().optional(),
  }),
});

// Change password validation schema
const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});

/**
 * @route GET /users/me
 * @desc Get current user profile
 * @access Private
 */
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
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
 * @route PUT /users/me
 * @desc Update current user profile
 * @access Private
 */
router.put(
  "/me",
  validateRequest(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const { fullName, preferredLanguage, preferredTimezone } = req.body;

      const updatedProfile = await userService.updateUserProfile(req.user.id, {
        fullName,
        preferredLanguage,
        preferredTimezone,
      });

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
 * @route PUT /users/me/password
 * @desc Change current user password
 * @access Private
 */
router.put(
  "/me/password",
  validateRequest(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const { currentPassword, newPassword } = req.body;

      await userService.changePassword(req.user.id, currentPassword, newPassword);

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
 * @route GET /users/:id
 * @desc Get user by ID
 * @access Private (Admin or same user)
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const userId = req.params.id;

    // Check if the user is requesting their own profile or is an admin
    if (req.user.id !== userId && req.user.role !== "admin" && req.user.role !== "owner") {
      throw BadRequestError("Not authorized to access this user");
    }

    const profile = await userService.getUserProfile(userId);

    if (!profile) {
      throw NotFoundError("User not found");
    }

    res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /users
 * @desc Get all users (with pagination and filters)
 * @access Private (Admin only)
 */
router.get(
  "/",
  requirePermission("users:list"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const organizationId = req.query.organizationId as string;

      const { users, total } = await userService.listUsers({
        page,
        limit,
        search,
        organizationId,
      });

      res.status(200).json({
        status: "success",
        data: {
          users,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRoutes };
