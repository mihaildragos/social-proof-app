import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthenticatedRequest, authMiddleware } from '@social-proof/shared';
import { NotificationService } from '../services/notificationService';
import { config } from '../config';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger({
  serviceName: "notifications-service",
  level: config.logLevel,
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
});
const notificationService = new NotificationService(config.database, logger);

// Validation middleware
const validateTemplate = [
  body('name').isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
  body('siteId').isUUID().withMessage('Site ID must be a valid UUID'),
  body('channels').isArray().withMessage('Channels must be an array'),
  body('content').isObject().withMessage('Content must be an object'),
  body('eventTypes').isArray().withMessage('Event types must be an array'),
  body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Status must be active, inactive, or draft'),
];

const validateTemplateUpdate = [
  param('id').isUUID().withMessage('Template ID must be a valid UUID'),
  body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  body('content').optional().isObject().withMessage('Content must be an object'),
  body('eventTypes').optional().isArray().withMessage('Event types must be an array'),
  body('status').optional().isIn(['active', 'inactive', 'draft']).withMessage('Status must be active, inactive, or draft'),
];

const validateTemplateId = [
  param('id').isUUID().withMessage('Template ID must be a valid UUID'),
];

const validateSiteId = [
  param('siteId').isUUID().withMessage('Site ID must be a valid UUID'),
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
];

// GET /api/notifications/templates - Get all templates for organization
router.get('/', authMiddleware.verifyToken, validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user?.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization context required',
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const siteId = req.query.siteId as string;

    const templates = await notificationService.getTemplates(req.user.organizationId, { page, limit, search, siteId });
    
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

// GET /api/notifications/templates/site/:siteId - Get templates for specific site
router.get('/site/:siteId', authMiddleware.verifyToken, validateSiteId, validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { siteId } = req.params;
    
    if (!req.user?.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization context required',
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const templates = await notificationService.getTemplatesBySite(siteId, req.user.organizationId, { page, limit, search });
    
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching templates for site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates for site',
    });
  }
});

// GET /api/notifications/templates/:id - Get specific template
router.get('/:id', authMiddleware.verifyToken, validateTemplateId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    if (!req.user?.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization context required',
      });
    }

    const template = await notificationService.getTemplateByIdForOrg(id, req.user.organizationId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
    });
  }
});

// POST /api/notifications/templates - Create new template
router.post('/', authMiddleware.verifyToken, validateTemplate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user?.organizationId || !req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify site belongs to organization
    const site = await notificationService.getSiteById(req.body.siteId, req.user.organizationId);
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found',
      });
    }

    const templateData = {
      ...req.body,
      organizationId: req.user.organizationId,
      createdBy: req.user.id,
    };

    const template = await notificationService.createTemplate(templateData);
    
    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
    });
  }
});

// PUT /api/notifications/templates/:id - Update template
router.put('/:id', authMiddleware.verifyToken, validateTemplateUpdate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    if (!req.user?.organizationId || !req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id,
    };

    const template = await notificationService.updateTemplate(id, req.user.organizationId, updateData);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
    });
  }
});

// DELETE /api/notifications/templates/:id - Delete template
router.delete('/:id', authMiddleware.verifyToken, validateTemplateId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    if (!req.user?.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization context required',
      });
    }

    const deleted = await notificationService.deleteTemplate(id, req.user.organizationId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    });
  }
});

// POST /api/notifications/templates/:id/duplicate - Duplicate template
router.post('/:id/duplicate', authMiddleware.verifyToken, validateTemplateId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    if (!req.user?.organizationId || !req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const template = await notificationService.duplicateTemplate(id, req.user.organizationId, req.user.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate template',
    });
  }
});

// POST /api/notifications/templates/create-default - Create default template (legacy endpoint)
router.post('/create-default', async (req: Request, res: Response) => {
  try {
    const { site_id, site_name, site_domain, owner_id } = req.body;

    if (!site_id) {
      return res.status(400).json({
        error: "site_id is required",
      });
    }

    console.log(`Creating default template for site: ${site_id}`);

    const template = await notificationService.createDefaultTemplate(site_id, {
      site_name,
      site_domain,
      owner_id,
    });

    res.json({
      success: true,
      template_id: template.id,
      message: "Default template created successfully",
    });
  } catch (error: any) {
    console.error("Error creating default template:", error);
    res.status(500).json({
      error: "Failed to create default template",
      details: error.message,
    });
  }
});

export default router;
