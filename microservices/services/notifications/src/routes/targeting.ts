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
const validateTargetingRule = [
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
  body("conditions")
    .isArray({ min: 1 })
    .withMessage("Conditions must be a non-empty array"),
  body("conditions.*.attribute")
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage("Condition attribute must be 1-50 characters"),
  body("conditions.*.operator")
    .isIn(["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in"])
    .withMessage("Invalid condition operator"),
  body("conditions.*.value")
    .notEmpty()
    .withMessage("Condition value is required"),
  body("operator")
    .isIn(["AND", "OR"])
    .withMessage("Operator must be AND or OR"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
  body("priority")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Priority must be between 1 and 100"),
];

const validateTargetingRuleUpdate = [
  param("id").isUUID().withMessage("Targeting rule ID must be a valid UUID"),
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
  body("conditions")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Conditions must be a non-empty array"),
  body("conditions.*.attribute")
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage("Condition attribute must be 1-50 characters"),
  body("conditions.*.operator")
    .optional()
    .isIn(["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in"])
    .withMessage("Invalid condition operator"),
  body("conditions.*.value")
    .optional()
    .notEmpty()
    .withMessage("Condition value is required"),
  body("operator")
    .optional()
    .isIn(["AND", "OR"])
    .withMessage("Operator must be AND or OR"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
  body("priority")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Priority must be between 1 and 100"),
];

const validateTargetingRuleId = [
  param("id").isUUID().withMessage("Targeting rule ID must be a valid UUID"),
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
    .isIn(["active", "inactive"])
    .withMessage("Status filter must be active or inactive"),
];

// GET /api/notifications/targeting - Get all targeting rules for organization
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

      const targetingRules = await notificationService.getTargetingRules(req.user.organizationId, {
        page,
        limit,
        search,
        status,
        siteId,
      });

      res.json({
        success: true,
        data: targetingRules,
      });
    } catch (error) {
      console.error("Error fetching targeting rules:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch targeting rules",
      });
    }
  }
);

// GET /api/notifications/targeting/site/:siteId - Get targeting rules for specific site
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

      const targetingRules = await notificationService.getTargetingRulesBySite(
        siteId,
        req.user.organizationId,
        { page, limit, search, status }
      );

      res.json({
        success: true,
        data: targetingRules,
      });
    } catch (error) {
      console.error("Error fetching targeting rules for site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch targeting rules for site",
      });
    }
  }
);

// GET /api/notifications/targeting/:id - Get specific targeting rule
router.get(
  "/:id",
  authMiddleware.verifyToken,
  validateTargetingRuleId,
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

      const targetingRule = await notificationService.getTargetingRuleById(id, req.user.organizationId);

      if (!targetingRule) {
        return res.status(404).json({
          success: false,
          error: "Targeting rule not found",
        });
      }

      res.json({
        success: true,
        data: targetingRule,
      });
    } catch (error) {
      console.error("Error fetching targeting rule:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch targeting rule",
      });
    }
  }
);

// POST /api/notifications/targeting - Create new targeting rule
router.post(
  "/",
  authMiddleware.verifyToken,
  validateTargetingRule,
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

      const targetingRuleData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      const targetingRule = await notificationService.createTargetingRule(targetingRuleData);

      res.status(201).json({
        success: true,
        data: targetingRule,
      });
    } catch (error) {
      console.error("Error creating targeting rule:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create targeting rule",
      });
    }
  }
);

// PUT /api/notifications/targeting/:id - Update targeting rule
router.put(
  "/:id",
  authMiddleware.verifyToken,
  validateTargetingRuleUpdate,
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

      const targetingRule = await notificationService.updateTargetingRule(
        id,
        req.user.organizationId,
        updateData
      );

      if (!targetingRule) {
        return res.status(404).json({
          success: false,
          error: "Targeting rule not found",
        });
      }

      res.json({
        success: true,
        data: targetingRule,
      });
    } catch (error) {
      console.error("Error updating targeting rule:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update targeting rule",
      });
    }
  }
);

// DELETE /api/notifications/targeting/:id - Delete targeting rule
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  validateTargetingRuleId,
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

      const deleted = await notificationService.deleteTargetingRule(id, req.user.organizationId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Targeting rule not found",
        });
      }

      res.json({
        success: true,
        message: "Targeting rule deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting targeting rule:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete targeting rule",
      });
    }
  }
);

// POST /api/notifications/targeting/:id/test - Test targeting rule against sample data
router.post(
  "/:id/test",
  authMiddleware.verifyToken,
  validateTargetingRuleId,
  body("testData").isObject().withMessage("Test data must be an object"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { testData } = req.body;

      if (!req.user?.organizationId) {
        return res.status(401).json({
          success: false,
          error: "Organization context required",
        });
      }

      const result = await notificationService.testTargetingRule(id, req.user.organizationId, testData);

      if (result === null) {
        return res.status(404).json({
          success: false,
          error: "Targeting rule not found",
        });
      }

      res.json({
        success: true,
        data: {
          matches: result,
          testData,
        },
      });
    } catch (error) {
      console.error("Error testing targeting rule:", error);
      res.status(500).json({
        success: false,
        error: "Failed to test targeting rule",
      });
    }
  }
);

export default router; 