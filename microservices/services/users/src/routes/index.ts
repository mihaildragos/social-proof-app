import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { userRoutes } from "./userRoutes";
import { profileRoutes } from "./profileRoutes";
import { organizationRoutes } from "./organizationRoutes";
import { invitationRoutes } from "./invitationRoutes";
import { teamRoutes } from "./teamRoutes";
import { scimRoutes } from "./scimRoutes";
import { authService } from "../services/authService";
import { validateRequest } from "../middleware/validateRequest";
import { z } from "zod";

const router = Router();

// Validation schemas for planned API endpoints
const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

const signupSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    preferredLanguage: z.string().optional(),
    preferredTimezone: z.string().optional(),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

// Mount routes with planned API structure
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/profile", profileRoutes);
router.use("/organizations", organizationRoutes);
router.use("/invitations", invitationRoutes);
router.use("/teams", teamRoutes);
router.use("/scim/v2", scimRoutes);

// Mount routes under planned API paths to match the plan exactly
router.post("/api/users/register", validateRequest(signupSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, preferredLanguage, preferredTimezone } = req.body;
    const result = await authService.signup({
      email,
      password,
      fullName,
      preferredLanguage,
      preferredTimezone,
    });
    res.status(201).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/users/login", validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/users/password-reset", validateRequest(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.status(200).json({
      status: "success",
      message: "If the email exists, a password reset link has been sent",
    });
  } catch (error) {
    res.status(200).json({
      status: "success",
      message: "If the email exists, a password reset link has been sent",
    });
  }
});

router.use("/api/users/profile", profileRoutes);
router.use("/api/users/organizations", organizationRoutes);
router.use("/api/users/teams", teamRoutes);
router.use("/api/users/invitations", invitationRoutes);

export { router };
