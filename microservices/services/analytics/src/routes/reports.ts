import { Router, Request, Response } from "express";
import { AnalyticsService } from "../services/analytics-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const analyticsService = new AnalyticsService();

// Validation schemas
const createReportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  description: z.string().optional(),
  type: z.enum(["dashboard", "funnel", "cohort", "custom"]),
  config: z.object({
    metrics: z.array(z.string()).optional(),
    dimensions: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    timeRange: z.string().optional(),
    granularity: z.enum(["minute", "hour", "day", "week", "month"]).optional(),
    visualization: z.enum(["table", "line", "bar", "pie", "heatmap"]).optional(),
  }),
  schedule: z.object({
    enabled: z.boolean().default(false),
    frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
    time: z.string().optional(), // HH:MM format
    timezone: z.string().optional(),
    recipients: z.array(z.string().email()).optional(),
  }).optional(),
  isPublic: z.boolean().default(false),
});

const updateReportSchema = createReportSchema.partial();

const generateReportSchema = z.object({
  format: z.enum(["json", "csv", "pdf", "xlsx"]).default("json"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  filters: z.record(z.any()).optional(),
});

// Create report
router.post(
  "/",
  authMiddleware,
  validateRequest(createReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, type, config, schedule, isPublic } = req.body;
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const report = await analyticsService.createReport({
        organizationId,
        name,
        description,
        type,
        config,
        schedule,
        isPublic,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        report: {
          id: report.id,
          name: report.name,
          description: report.description,
          type: report.type,
          config: report.config,
          schedule: report.schedule,
          isPublic: report.isPublic,
          createdAt: report.createdAt,
        },
      });
    } catch (error) {
      console.error("Create report error:", error);
      res.status(500).json({
        error: "Failed to create report",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get all reports
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { type, limit = 50, offset = 0, includePublic = false } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const reports = await analyticsService.getReports(organizationId, {
      type: type as string,
      limit: Number(limit),
      offset: Number(offset),
      includePublic: includePublic === "true",
    });

    res.json({
      reports: reports.map((report: any) => ({
        id: report.id,
        name: report.name,
        description: report.description,
        type: report.type,
        isPublic: report.isPublic,
        schedule: report.schedule,
        lastGenerated: report.lastGenerated,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      total: reports.length,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({
      error: "Failed to get reports",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get report by ID
router.get("/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const report = await analyticsService.getReportById(organizationId, id);

    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json({
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        type: report.type,
        config: report.config,
        schedule: report.schedule,
        isPublic: report.isPublic,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        createdBy: report.createdBy,
      },
    });
  } catch (error) {
    console.error("Get report by ID error:", error);
    res.status(500).json({
      error: "Failed to get report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update report
router.put(
  "/:id",
  authMiddleware,
  validateRequest(updateReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const updatedReport = await analyticsService.updateReport(organizationId, id, {
        ...req.body,
        updatedBy: userId,
      });

      if (!updatedReport) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      res.json({
        success: true,
        report: {
          id: updatedReport.id,
          name: updatedReport.name,
          description: updatedReport.description,
          type: updatedReport.type,
          config: updatedReport.config,
          schedule: updatedReport.schedule,
          isPublic: updatedReport.isPublic,
          updatedAt: updatedReport.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update report error:", error);
      res.status(500).json({
        error: "Failed to update report",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Delete report
router.delete("/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const deleted = await analyticsService.deleteReport(organizationId, id);

    if (!deleted) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Delete report error:", error);
    res.status(500).json({
      error: "Failed to delete report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Generate report
router.post(
  "/:id/generate",
  authMiddleware,
  validateRequest(generateReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { format, startDate, endDate, filters } = req.body;
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      const reportData = await analyticsService.generateReport(organizationId, id, {
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        filters,
      });

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="report-${id}-${Date.now()}.csv"`);
        res.send(reportData);
      } else if (format === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="report-${id}-${Date.now()}.pdf"`);
        res.send(reportData);
      } else if (format === "xlsx") {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="report-${id}-${Date.now()}.xlsx"`);
        res.send(reportData);
      } else {
        res.json({
          success: true,
          data: reportData,
          format,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Generate report error:", error);
      res.status(500).json({
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get report history
router.get("/:id/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;
    const { limit = 20, offset = 0 } = req.query;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const history = await analyticsService.getReportHistory(organizationId, id, {
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      reportId: id,
      history: history.map((entry: any) => ({
        id: entry.id,
        generatedAt: entry.generatedAt,
        format: entry.format,
        status: entry.status,
        fileSize: entry.fileSize,
        downloadUrl: entry.downloadUrl,
        generatedBy: entry.generatedBy,
      })),
      total: history.length,
    });
  } catch (error) {
    console.error("Get report history error:", error);
    res.status(500).json({
      error: "Failed to get report history",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Download report file
router.get("/:id/download/:fileId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, fileId } = req.params;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const fileData = await analyticsService.downloadReportFile(organizationId, id, fileId);

    if (!fileData) {
      res.status(404).json({ error: "Report file not found" });
      return;
    }

    res.setHeader("Content-Type", fileData.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
    res.send(fileData.data);
  } catch (error) {
    console.error("Download report file error:", error);
    res.status(500).json({
      error: "Failed to download report file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Schedule report
router.post("/:id/schedule", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { enabled, frequency, time, timezone, recipients } = req.body;
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    const scheduledReport = await analyticsService.scheduleReport(organizationId, id, {
      enabled,
      frequency,
      time,
      timezone,
      recipients,
    });

    if (!scheduledReport) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json({
      success: true,
      schedule: {
        enabled: scheduledReport.schedule.enabled,
        frequency: scheduledReport.schedule.frequency,
        time: scheduledReport.schedule.time,
        timezone: scheduledReport.schedule.timezone,
        recipients: scheduledReport.schedule.recipients,
        nextRun: scheduledReport.schedule.nextRun,
      },
      message: enabled ? "Report scheduled successfully" : "Report schedule disabled",
    });
  } catch (error) {
    console.error("Schedule report error:", error);
    res.status(500).json({
      error: "Failed to schedule report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Clone report
router.post("/:id/clone", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const organizationId = (req as any).user?.organizationId;
    const userId = (req as any).user?.id;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "Name is required for cloned report" });
      return;
    }

    const clonedReport = await analyticsService.cloneReport(organizationId, id, {
      name,
      clonedBy: userId,
    });

    if (!clonedReport) {
      res.status(404).json({ error: "Original report not found" });
      return;
    }

    res.status(201).json({
      success: true,
      report: {
        id: clonedReport.id,
        name: clonedReport.name,
        description: clonedReport.description,
        type: clonedReport.type,
        config: clonedReport.config,
        createdAt: clonedReport.createdAt,
      },
      message: "Report cloned successfully",
    });
  } catch (error) {
    console.error("Clone report error:", error);
    res.status(500).json({
      error: "Failed to clone report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Share report
router.post("/:id/share", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { emails, message, expiresAt } = req.body;
    const organizationId = (req as any).user?.organizationId;
    const userId = (req as any).user?.id;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: "At least one email is required" });
      return;
    }

    const shareResult = await analyticsService.shareReport(organizationId, id, {
      emails,
      message,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      sharedBy: userId,
    });

    if (!shareResult) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json({
      success: true,
      shareId: shareResult.shareId,
      shareUrl: shareResult.shareUrl,
      recipients: shareResult.recipients,
      expiresAt: shareResult.expiresAt,
      message: "Report shared successfully",
    });
  } catch (error) {
    console.error("Share report error:", error);
    res.status(500).json({
      error: "Failed to share report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get shared report (public access)
router.get("/shared/:shareId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { shareId } = req.params;

    const sharedReport = await analyticsService.getSharedReport(shareId);

    if (!sharedReport) {
      res.status(404).json({ error: "Shared report not found or expired" });
      return;
    }

    res.json({
      success: true,
      report: {
        name: sharedReport.name,
        description: sharedReport.description,
        type: sharedReport.type,
        data: sharedReport.data,
        generatedAt: sharedReport.generatedAt,
        expiresAt: sharedReport.expiresAt,
      },
    });
  } catch (error) {
    console.error("Get shared report error:", error);
    res.status(500).json({
      error: "Failed to get shared report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get report templates
router.get("/templates", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    const templates = await analyticsService.getReportTemplates({
      category: category as string,
    });

    res.json({
      success: true,
      templates: templates.map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        type: template.type,
        config: template.config,
        preview: template.preview,
      })),
      total: templates.length,
    });
  } catch (error) {
    console.error("Get report templates error:", error);
    res.status(500).json({
      error: "Failed to get report templates",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create report from template
router.post("/templates/:templateId/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;
    const { name, customConfig } = req.body;
    const organizationId = (req as any).user?.organizationId;
    const userId = (req as any).user?.id;

    if (!organizationId) {
      res.status(401).json({ error: "Organization context required" });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "Report name is required" });
      return;
    }

    const report = await analyticsService.createReportFromTemplate(organizationId, templateId, {
      name,
      customConfig,
      createdBy: userId,
    });

    if (!report) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.status(201).json({
      success: true,
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        type: report.type,
        config: report.config,
        createdAt: report.createdAt,
      },
      message: "Report created from template successfully",
    });
  } catch (error) {
    console.error("Create report from template error:", error);
    res.status(500).json({
      error: "Failed to create report from template",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router; 