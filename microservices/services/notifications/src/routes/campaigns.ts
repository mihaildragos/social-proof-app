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
const validateCampaign = [
  body("name")
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1-100 characters"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must be max 500 characters"),
  body("siteId").isUUID().withMessage("Site ID must be a valid UUID"),
  body("templateId").isUUID().withMessage("Template ID must be a valid UUID"),
  body("status")
    .optional()
    .isIn(["draft", "scheduled", "active", "paused", "completed"])
    .withMessage("Status must be draft, scheduled, active, paused, or completed"),
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object"),
  body("targetingRules")
    .optional()
    .isArray()
    .withMessage("Targeting rules must be an array"),
];

const validateCampaignUpdate = [
  param("id").isUUID().withMessage("Campaign ID must be a valid UUID"),
  body("name")
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1-100 characters"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must be max 500 characters"),
  body("templateId")
    .optional()
    .isUUID()
    .withMessage("Template ID must be a valid UUID"),
  body("status")
    .optional()
    .isIn(["draft", "scheduled", "active", "paused", "completed"])
    .withMessage("Status must be draft, scheduled, active, paused, or completed"),
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object"),
  body("targetingRules")
    .optional()
    .isArray()
    .withMessage("Targeting rules must be an array"),
];

const validateCampaignId = [
  param("id").isUUID().withMessage("Campaign ID must be a valid UUID"),
];

const validateSiteId = [
  param("siteId").isUUID().withMessage("Site ID must be a valid UUID"),
];

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().withMessage("Search must be a string"),
  query("status")
    .optional()
    .isIn(["draft", "scheduled", "active", "paused", "completed"])
    .withMessage("Status filter must be draft, scheduled, active, paused, or completed"),
];

// GET /api/notifications/campaigns - Get all campaigns for organization
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
      const status = req.query.status as string;
      const siteId = req.query.siteId as string;

      const campaigns = await notificationService.getCampaigns(req.user.organizationId, {
        page,
        limit,
        search,
        status,
        siteId,
      });

      res.json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch campaigns",
      });
    }
  }
);

// GET /api/notifications/campaigns/site/:siteId - Get campaigns for specific site
router.get(
  "/site/:siteId",
  authMiddleware.verifyToken,
  validateSiteId,
  validatePagination,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { siteId } = req.params;

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const campaigns = await notificationService.getCampaignsBySite(
        siteId,
        req.user.organizationId,
        { page, limit, search, status }
      );

      res.json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      console.error("Error fetching campaigns for site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch campaigns for site",
      });
    }
  }
);

// GET /api/notifications/campaigns/:id - Get specific campaign
router.get(
  "/:id",
  authMiddleware.verifyToken,
  validateCampaignId,
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

      const campaign = await notificationService.getCampaignById(id, req.user.organizationId);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch campaign",
      });
    }
  }
);

// POST /api/notifications/campaigns - Create new campaign
router.post(
  "/",
  authMiddleware.verifyToken,
  validateCampaign,
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

      // Verify site belongs to organization
      const site = await notificationService.getSiteById(req.body.siteId, req.user.organizationId);
      if (!site) {
        return res.status(404).json({
          success: false,
          error: "Site not found",
        });
      }

      // Verify template belongs to organization
      const template = await notificationService.getTemplateByIdForOrg(
        req.body.templateId,
        req.user.organizationId
      );
      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      const campaignData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      const campaign = await notificationService.createCampaign(campaignData);

      res.status(201).json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create campaign",
      });
    }
  }
);

// PUT /api/notifications/campaigns/:id - Update campaign
router.put(
  "/:id",
  authMiddleware.verifyToken,
  validateCampaignUpdate,
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

      // If templateId is being updated, verify it belongs to organization
      if (req.body.templateId) {
        const template = await notificationService.getTemplateByIdForOrg(
          req.body.templateId,
          req.user.organizationId
        );
        if (!template) {
          return res.status(404).json({
            success: false,
            error: "Template not found",
          });
        }
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
      };

      const campaign = await notificationService.updateCampaign(
        id,
        req.user.organizationId,
        updateData
      );

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update campaign",
      });
    }
  }
);

// DELETE /api/notifications/campaigns/:id - Delete campaign
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  validateCampaignId,
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

      const deleted = await notificationService.deleteCampaign(id, req.user.organizationId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        message: "Campaign deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete campaign",
      });
    }
  }
);

// POST /api/notifications/campaigns/:id/start - Start campaign
router.post(
  "/:id/start",
  authMiddleware.verifyToken,
  validateCampaignId,
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

      const campaign = await notificationService.startCampaign(id, req.user.organizationId, req.user.id);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        data: campaign,
        message: "Campaign started successfully",
      });
    } catch (error) {
      console.error("Error starting campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start campaign",
      });
    }
  }
);

// POST /api/notifications/campaigns/:id/pause - Pause campaign
router.post(
  "/:id/pause",
  authMiddleware.verifyToken,
  validateCampaignId,
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

      const campaign = await notificationService.pauseCampaign(id, req.user.organizationId, req.user.id);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        data: campaign,
        message: "Campaign paused successfully",
      });
    } catch (error) {
      console.error("Error pausing campaign:", error);
      res.status(500).json({
        success: false,
        error: "Failed to pause campaign",
      });
    }
  }
);

// GET /api/notifications/campaigns/:id/stats - Get campaign statistics
router.get(
  "/:id/stats",
  authMiddleware.verifyToken,
  validateCampaignId,
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

      const stats = await notificationService.getCampaignStats(id, req.user.organizationId);

      if (!stats) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found",
        });
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch campaign statistics",
      });
    }
  }
);

export default router; 