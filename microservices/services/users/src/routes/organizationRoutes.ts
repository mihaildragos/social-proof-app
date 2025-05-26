import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest";
import { requirePermission } from "../middleware/authMiddleware";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { organizationService } from "../services/organizationService";
import { logger } from "../utils/logger";

const router = Router();

// Create organization validation schema
const createOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Organization name must be at least 2 characters"),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
    dataRegion: z.string().optional(),
  }),
});

// Update organization validation schema
const updateOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Organization name must be at least 2 characters").optional(),
    settings: z.record(z.any()).optional(),
  }),
});

/**
 * @route POST /organizations
 * @desc Create a new organization
 * @access Private
 */
router.post(
  "/",
  validateRequest(createOrgSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const { name, slug, dataRegion } = req.body;

      const organization = await organizationService.createOrganization({
        name,
        slug,
        dataRegion,
        userId: req.user.id,
      });

      logger.info("Organization created", { organizationId: organization.id, userId: req.user.id });

      res.status(201).json({
        status: "success",
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /organizations
 * @desc Get all organizations for current user
 * @access Private
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const organizations = await organizationService.listUserOrganizations(req.user.id);

    res.status(200).json({
      status: "success",
      data: organizations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /organizations/:id
 * @desc Get organization by ID
 * @access Private (member of the organization)
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const organizationId = req.params.id;

    const organization = await organizationService.getOrganization(organizationId, req.user.id);

    if (!organization) {
      throw NotFoundError("Organization not found");
    }

    res.status(200).json({
      status: "success",
      data: organization,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /organizations/:id
 * @desc Update organization
 * @access Private (admin or owner of the organization)
 */
router.put(
  "/:id",
  validateRequest(updateOrgSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.id;
      const { name, settings } = req.body;

      const organization = await organizationService.updateOrganization(
        organizationId,
        { name, settings },
        req.user.id
      );

      res.status(200).json({
        status: "success",
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /organizations/:id/members
 * @desc Get all members of an organization
 * @access Private (member of the organization)
 */
router.get("/:id/members", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const organizationId = req.params.id;

    const members = await organizationService.listOrganizationMembers(organizationId, req.user.id);

    res.status(200).json({
      status: "success",
      data: members,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /organizations/:id/members/:userId
 * @desc Update member role
 * @access Private (admin or owner of the organization)
 */
router.put("/:id/members/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const organizationId = req.params.id;
    const memberId = req.params.userId;
    const { role } = req.body;

    if (!role || !["admin", "member", "analyst", "designer"].includes(role)) {
      throw BadRequestError("Invalid role");
    }

    await organizationService.updateMemberRole(organizationId, memberId, role, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Member role updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /organizations/:id/members/:userId
 * @desc Remove member from organization
 * @access Private (admin or owner of the organization, or self-removal)
 */
router.delete("/:id/members/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw BadRequestError("User not authenticated");
    }

    const organizationId = req.params.id;
    const memberId = req.params.userId;

    // Allow self-removal or admin/owner removal
    const isSelfRemoval = req.user.id === memberId;

    await organizationService.removeMember(organizationId, memberId, req.user.id);

    res.status(200).json({
      status: "success",
      message: "Member removed successfully",
    });
  } catch (error) {
    next(error);
  }
});

export { router as organizationRoutes };
