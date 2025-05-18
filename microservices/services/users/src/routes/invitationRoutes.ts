import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest";
import { requirePermission } from "../middleware/authMiddleware";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { invitationService } from "../services/invitationService";
import { logger } from "../utils/logger";

const router = Router();

// Create invitation validation schema
const createInvitationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    organizationId: z.string().uuid("Invalid organization ID"),
    role: z
      .string()
      .refine((val) => ["admin", "member", "analyst", "designer"].includes(val), {
        message: "Invalid role",
      }),
  }),
});

// Accept invitation validation schema
const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string(),
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
  }),
});

/**
 * @route POST /invitations
 * @desc Create a new invitation
 * @access Private (admin or owner of the organization)
 */
router.post(
  "/",
  validateRequest(createInvitationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const { email, organizationId, role } = req.body;

      const invitation = await invitationService.createInvitation({
        email,
        organizationId,
        role,
        invitedBy: req.user.id,
      });

      logger.info("Invitation created", { invitationId: invitation.id, organizationId });

      res.status(201).json({
        status: "success",
        data: invitation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /invitations/organization/:organizationId
 * @desc Get all invitations for an organization
 * @access Private (member of the organization)
 */
router.get(
  "/organization/:organizationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;

      const invitations = await invitationService.listOrganizationInvitations(
        organizationId,
        req.user.id
      );

      res.status(200).json({
        status: "success",
        data: invitations,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /invitations/token/:token
 * @desc Verify invitation token
 * @access Public
 */
router.get("/token/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;

    const invitation = await invitationService.verifyInvitationToken(token);

    res.status(200).json({
      status: "success",
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /invitations/accept
 * @desc Accept an invitation
 * @access Public
 */
router.post(
  "/accept",
  validateRequest(acceptInvitationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, fullName, password } = req.body;

      const result = await invitationService.acceptInvitation({
        token,
        fullName,
        password,
        user: req.user,
      });

      logger.info("Invitation accepted", { token });

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
 * @route DELETE /invitations/:id
 * @desc Cancel an invitation
 * @access Private (admin or owner of the organization)
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const invitationId = req.params.id;

    await invitationService.cancelInvitation(invitationId, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Invitation cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /invitations/:id/resend
 * @desc Resend an invitation
 * @access Private (admin or owner of the organization)
 */
router.post("/:id/resend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const invitationId = req.params.id;

    await invitationService.resendInvitation(invitationId, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Invitation resent successfully",
    });
  } catch (error) {
    next(error);
  }
});

export { router as invitationRoutes };
