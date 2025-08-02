import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validateRequest";
import { requirePermission } from "../middleware/authMiddleware";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { organizationService } from "../services/organizationService";
import { logger } from "../utils/logger";

const router = Router();

// Add team member validation schema
const addTeamMemberSchema = z.object({
  body: z.object({
    userId: z.string().uuid("Invalid user ID"),
    organizationId: z.string().uuid("Invalid organization ID"),
    role: z.string().refine((val) => ["admin", "member", "analyst", "designer"].includes(val), {
      message: "Invalid role",
    }),
  }),
});

// Update team member role validation schema
const updateTeamMemberRoleSchema = z.object({
  body: z.object({
    role: z.string().refine((val) => ["admin", "member", "analyst", "designer"].includes(val), {
      message: "Invalid role",
    }),
  }),
});

/**
 * @route GET /teams/organizations/:organizationId/members
 * @desc Get all team members for an organization
 * @access Private (member of the organization)
 */
router.get(
  "/organizations/:organizationId/members",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;

      const members = await organizationService.listOrganizationMembers(organizationId, req.user.id);

      res.status(200).json({
        status: "success",
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /teams/organizations/:organizationId/members
 * @desc Add a team member to an organization
 * @access Private (admin or owner of the organization)
 */
router.post(
  "/organizations/:organizationId/members",
  validateRequest(addTeamMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;
      const { userId, role } = req.body;

      // Verify the organization ID matches the one in the body
      if (organizationId !== req.body.organizationId) {
        throw BadRequestError("Organization ID mismatch");
      }

      // This would typically be handled by the invitation system
      // For direct team member addition, we need to implement this logic
      // For now, we'll return a message indicating to use invitations
      res.status(400).json({
        status: "error",
        message: "Please use the invitation system to add team members",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /teams/organizations/:organizationId/members/:userId/role
 * @desc Update team member role
 * @access Private (admin or owner of the organization)
 */
router.put(
  "/organizations/:organizationId/members/:userId/role",
  validateRequest(updateTeamMemberRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;
      const memberId = req.params.userId;
      const { role } = req.body;

      await organizationService.updateMemberRole(organizationId, memberId, role, req.user.id);

      res.status(200).json({
        status: "success",
        message: "Team member role updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /teams/organizations/:organizationId/members/:userId
 * @desc Remove team member from organization
 * @access Private (admin or owner of the organization)
 */
router.delete(
  "/organizations/:organizationId/members/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;
      const memberId = req.params.userId;

      await organizationService.removeMember(organizationId, memberId, req.user.id);

      res.status(200).json({
        status: "success",
        message: "Team member removed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /teams/organizations/:organizationId/roles
 * @desc Get available roles for the organization
 * @access Private (member of the organization)
 */
router.get(
  "/organizations/:organizationId/roles",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw BadRequestError("User not authenticated");
      }

      const organizationId = req.params.organizationId;

      // Check if user is a member of the organization
      const organization = await organizationService.getOrganization(organizationId, req.user.id);

      if (!organization) {
        throw NotFoundError("Organization not found");
      }

      const roles = [
        {
          value: "owner",
          label: "Owner",
          description: "Full access to all organization features and settings",
          permissions: ["*"],
        },
        {
          value: "admin",
          label: "Administrator",
          description: "Manage team members, notifications, and organization settings",
          permissions: [
            "users:list",
            "users:invite",
            "users:remove",
            "notifications:create",
            "notifications:edit",
            "notifications:delete",
            "analytics:view",
            "integrations:manage",
          ],
        },
        {
          value: "analyst",
          label: "Analyst",
          description: "View analytics and create reports",
          permissions: ["analytics:view", "reports:create", "notifications:view"],
        },
        {
          value: "designer",
          label: "Designer",
          description: "Create and edit notification templates",
          permissions: ["notifications:create", "notifications:edit", "templates:manage"],
        },
        {
          value: "member",
          label: "Member",
          description: "Basic access to view notifications and analytics",
          permissions: ["notifications:view", "analytics:view"],
        },
      ];

      res.status(200).json({
        status: "success",
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /teams/my-teams
 * @desc Get all teams/organizations the current user is a member of
 * @access Private
 */
router.get("/my-teams", async (req: Request, res: Response, next: NextFunction) => {
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

export { router as teamRoutes }; 