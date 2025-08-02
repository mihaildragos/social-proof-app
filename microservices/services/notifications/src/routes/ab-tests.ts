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
const validateAbTest = [
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
  body("controlTemplateId").isUUID().withMessage("Control template ID must be a valid UUID"),
  body("variantTemplateId").isUUID().withMessage("Variant template ID must be a valid UUID"),
  body("trafficSplit")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Traffic split must be between 0 and 100"),
  body("status")
    .optional()
    .isIn(["draft", "running", "paused", "completed"])
    .withMessage("Status must be draft, running, paused, or completed"),
  body("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO 8601 date"),
  body("endDate").optional().isISO8601().withMessage("End date must be a valid ISO 8601 date"),
  body("hypothesis")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Hypothesis must be max 1000 characters"),
  body("successMetric")
    .optional()
    .isIn(["click_rate", "conversion_rate", "engagement_rate"])
    .withMessage("Success metric must be click_rate, conversion_rate, or engagement_rate"),
  body("minimumSampleSize")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum sample size must be a positive integer"),
];

const validateAbTestUpdate = [
  param("id").isUUID().withMessage("A/B test ID must be a valid UUID"),
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
  body("controlTemplateId")
    .optional()
    .isUUID()
    .withMessage("Control template ID must be a valid UUID"),
  body("variantTemplateId")
    .optional()
    .isUUID()
    .withMessage("Variant template ID must be a valid UUID"),
  body("trafficSplit")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Traffic split must be between 0 and 100"),
  body("status")
    .optional()
    .isIn(["draft", "running", "paused", "completed"])
    .withMessage("Status must be draft, running, paused, or completed"),
  body("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO 8601 date"),
  body("endDate").optional().isISO8601().withMessage("End date must be a valid ISO 8601 date"),
  body("hypothesis")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Hypothesis must be max 1000 characters"),
  body("successMetric")
    .optional()
    .isIn(["click_rate", "conversion_rate", "engagement_rate"])
    .withMessage("Success metric must be click_rate, conversion_rate, or engagement_rate"),
  body("minimumSampleSize")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum sample size must be a positive integer"),
];

const validateAbTestId = [param("id").isUUID().withMessage("A/B test ID must be a valid UUID")];

const validateSiteId = [param("siteId").isUUID().withMessage("Site ID must be a valid UUID")];

const validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().withMessage("Search must be a string"),
  query("status")
    .optional()
    .isIn(["draft", "running", "paused", "completed"])
    .withMessage("Status filter must be draft, running, paused, or completed"),
];

// GET /api/notifications/ab-tests - Get all A/B tests for organization
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

      const abTests = await notificationService.getAbTests(req.user.organizationId, {
        page,
        limit,
        search,
        status,
        siteId,
      });

      res.json({
        success: true,
        data: abTests,
      });
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch A/B tests",
      });
    }
  }
);

// GET /api/notifications/ab-tests/site/:siteId - Get A/B tests for specific site
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

      const abTests = await notificationService.getAbTestsBySite(siteId, req.user.organizationId, {
        page,
        limit,
        search,
        status,
      });

      res.json({
        success: true,
        data: abTests,
      });
    } catch (error) {
      console.error("Error fetching A/B tests for site:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch A/B tests for site",
      });
    }
  }
);

// GET /api/notifications/ab-tests/:id - Get specific A/B test
router.get(
  "/:id",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const abTest = await notificationService.getAbTestById(id, req.user.organizationId);

      if (!abTest) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: abTest,
      });
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch A/B test",
      });
    }
  }
);

// POST /api/notifications/ab-tests - Create new A/B test
router.post(
  "/",
  authMiddleware.verifyToken,
  validateAbTest,
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

      // Verify control template belongs to organization
      const controlTemplate = await notificationService.getTemplateByIdForOrg(
        req.body.controlTemplateId,
        req.user.organizationId
      );
      if (!controlTemplate) {
        return res.status(404).json({
          success: false,
          error: "Control template not found",
        });
      }

      // Verify variant template belongs to organization
      const variantTemplate = await notificationService.getTemplateByIdForOrg(
        req.body.variantTemplateId,
        req.user.organizationId
      );
      if (!variantTemplate) {
        return res.status(404).json({
          success: false,
          error: "Variant template not found",
        });
      }

      const abTestData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      const abTest = await notificationService.createAbTest(abTestData);

      res.status(201).json({
        success: true,
        data: abTest,
      });
    } catch (error) {
      console.error("Error creating A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create A/B test",
      });
    }
  }
);

// PUT /api/notifications/ab-tests/:id - Update A/B test
router.put(
  "/:id",
  authMiddleware.verifyToken,
  validateAbTestUpdate,
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

      // If control template is being updated, verify it belongs to organization
      if (req.body.controlTemplateId) {
        const controlTemplate = await notificationService.getTemplateByIdForOrg(
          req.body.controlTemplateId,
          req.user.organizationId
        );
        if (!controlTemplate) {
          return res.status(404).json({
            success: false,
            error: "Control template not found",
          });
        }
      }

      // If variant template is being updated, verify it belongs to organization
      if (req.body.variantTemplateId) {
        const variantTemplate = await notificationService.getTemplateByIdForOrg(
          req.body.variantTemplateId,
          req.user.organizationId
        );
        if (!variantTemplate) {
          return res.status(404).json({
            success: false,
            error: "Variant template not found",
          });
        }
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
      };

      const abTest = await notificationService.updateAbTest(
        id,
        req.user.organizationId,
        updateData
      );

      if (!abTest) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: abTest,
      });
    } catch (error) {
      console.error("Error updating A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update A/B test",
      });
    }
  }
);

// DELETE /api/notifications/ab-tests/:id - Delete A/B test
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const deleted = await notificationService.deleteAbTest(id, req.user.organizationId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        message: "A/B test deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete A/B test",
      });
    }
  }
);

// POST /api/notifications/ab-tests/:id/start - Start A/B test
router.post(
  "/:id/start",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const abTest = await notificationService.startAbTest(
        id,
        req.user.organizationId,
        req.user.id
      );

      if (!abTest) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: abTest,
        message: "A/B test started successfully",
      });
    } catch (error) {
      console.error("Error starting A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start A/B test",
      });
    }
  }
);

// POST /api/notifications/ab-tests/:id/pause - Pause A/B test
router.post(
  "/:id/pause",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const abTest = await notificationService.pauseAbTest(
        id,
        req.user.organizationId,
        req.user.id
      );

      if (!abTest) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: abTest,
        message: "A/B test paused successfully",
      });
    } catch (error) {
      console.error("Error pausing A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to pause A/B test",
      });
    }
  }
);

// POST /api/notifications/ab-tests/:id/complete - Complete A/B test
router.post(
  "/:id/complete",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const abTest = await notificationService.completeAbTest(
        id,
        req.user.organizationId,
        req.user.id
      );

      if (!abTest) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: abTest,
        message: "A/B test completed successfully",
      });
    } catch (error) {
      console.error("Error completing A/B test:", error);
      res.status(500).json({
        success: false,
        error: "Failed to complete A/B test",
      });
    }
  }
);

// GET /api/notifications/ab-tests/:id/results - Get A/B test results
router.get(
  "/:id/results",
  authMiddleware.verifyToken,
  validateAbTestId,
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

      const results = await notificationService.getAbTestResults(id, req.user.organizationId);

      if (!results) {
        return res.status(404).json({
          success: false,
          error: "A/B test not found",
        });
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Error fetching A/B test results:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch A/B test results",
      });
    }
  }
);

export default router;
