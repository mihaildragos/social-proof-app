import { Router, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { AuthenticatedRequest, authMiddleware } from "@social-proof/shared";
import { NotificationService } from "../services/notificationService";
import { config } from "../config";
import { Logger } from "../utils/logger";

const router = Router();
const logger = new Logger({
  serviceName: "notifications-service",
  level: config.logLevel,
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
});
const notificationService = new NotificationService(config.database, logger);

// Validation middleware
const validateSite = [
  body("name")
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1-100 characters"),
  body("domain").isURL().withMessage("Domain must be a valid URL"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must be max 500 characters"),
  body("settings").optional().isObject().withMessage("Settings must be an object"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const validateSiteUpdate = [
  param("id").isUUID().withMessage("Site ID must be a valid UUID"),
  body("name")
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1-100 characters"),
  body("domain").optional().isURL().withMessage("Domain must be a valid URL"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must be max 500 characters"),
  body("settings").optional().isObject().withMessage("Settings must be an object"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const validateSiteId = [param("id").isUUID().withMessage("Site ID must be a valid UUID")];

const validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().withMessage("Search must be a string"),
];

// GET /api/notifications/sites - Get all sites for organization
router.get(
  "/",
  authMiddleware.verifyToken,
  validatePagination,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;

      const sites = await notificationService.getSites(req.user.organizationId, {
        page,
        limit,
        search,
      });

      res.json({
        success: true,
        data: sites,
      });
    } catch (error) {
      console.error("Error fetching sites:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch sites",
      });
    }
  }
);

// GET /api/notifications/sites/:id - Get specific site
router.get(
  "/:id",
  authMiddleware.verifyToken,
  validateSiteId,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const site = await notificationService.getSiteById(id, req.user.organizationId);

      if (!site) {
        return res.status(404).json({
          success: false,
          error: "Site not found",
        });
      }

      res.json({
        success: true,
        data: site,
      });
    } catch (error) {
      console.error("Error fetching site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch site",
      });
    }
  }
);

// POST /api/notifications/sites - Create new site
router.post(
  "/",
  authMiddleware.verifyToken,
  validateSite,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user?.organizationId || !req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const siteData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      const site = await notificationService.createSite(siteData);

      res.status(201).json({
        success: true,
        data: site,
      });
    } catch (error) {
      console.error("Error creating site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create site",
      });
    }
  }
);

// PUT /api/notifications/sites/:id - Update site
router.put(
  "/:id",
  authMiddleware.verifyToken,
  validateSiteUpdate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      if (!req.user?.organizationId || !req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
      };

      const site = await notificationService.updateSite(id, req.user.organizationId, updateData);

      if (!site) {
        return res.status(404).json({
          success: false,
          error: "Site not found",
        });
      }

      res.json({
        success: true,
        data: site,
      });
    } catch (error) {
      console.error("Error updating site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update site",
      });
    }
  }
);

// DELETE /api/notifications/sites/:id - Delete site
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  validateSiteId,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const deleted = await notificationService.deleteSite(id, req.user.organizationId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Site not found",
        });
      }

      res.json({
        success: true,
        message: "Site deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete site",
      });
    }
  }
);

// GET /api/notifications/sites/:id/stats - Get site statistics
router.get(
  "/:id/stats",
  authMiddleware.verifyToken,
  validateSiteId,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const stats = await notificationService.getSiteStats(id, req.user.organizationId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching site stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch site statistics",
      });
    }
  }
);

export default router;
