import { Router, Request, Response } from "express";
import { BillingService } from "../services/billing-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const billingService = new BillingService();

// Validation schemas
const getInvoicesSchema = z.object({
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("20"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().optional(),
  subscriptionId: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        amount: z.number().positive("Amount must be positive"),
        quantity: z.number().positive("Quantity must be positive").default(1),
        metadata: z.record(z.string()).optional(),
      })
    )
    .min(1, "At least one item is required"),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.string()).optional(),
  autoAdvance: z.boolean().default(true),
});

const updateInvoiceSchema = z.object({
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  dueDate: z.string().datetime().optional(),
});

// Get user's invoices
router.get(
  "/",
  authMiddleware,
  validateRequest(getInvoicesSchema, "query"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, limit, offset, startDate, endDate } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const invoices = await billingService.getUserInvoices(userId, {
        status: status as string,
        limit: Number(limit),
        offset: Number(offset),
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        invoices: invoices.map((invoice: any) => ({
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amountDue: invoice.amountDue,
          amountPaid: invoice.amountPaid,
          currency: invoice.currency,
          description: invoice.description,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          invoicePdf: invoice.invoicePdf,
          createdAt: invoice.createdAt,
        })),
        total: invoices.length,
      });
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({
        error: "Failed to get invoices",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get specific invoice
router.get("/:invoiceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!invoiceId) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const invoice = await billingService.getInvoice(invoiceId, userId);

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    res.json({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountDue: invoice.amountDue,
        amountPaid: invoice.amountPaid,
        amountRemaining: invoice.amountRemaining,
        currency: invoice.currency,
        description: invoice.description,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        invoicePdf: invoice.invoicePdf,
        subscriptionId: invoice.subscriptionId,
        customerId: invoice.customerId,
        lines: invoice.lines,
        metadata: invoice.metadata,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({
      error: "Failed to get invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create invoice
router.post(
  "/",
  authMiddleware,
  validateRequest(createInvoiceSchema),
  async (req: Request, res: Response): Promise<void>     => {
    try {
      const { customerId, subscriptionId, items, dueDate, metadata, autoAdvance } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const invoice = await billingService.createInvoice({
        userId,
        customerId,
        subscriptionId,
        items,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        metadata,
        autoAdvance,
      });

      res.status(201).json({
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amountDue: invoice.amountDue,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          createdAt: invoice.createdAt,
        },
      });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({
        error: "Failed to create invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Update invoice
router.put(
  "/:invoiceId",
  authMiddleware,
  validateRequest(updateInvoiceSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;
      const { description, metadata, dueDate } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }

      const invoice = await billingService.updateInvoice(invoiceId, userId, {
        description,
        metadata,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      });

      res.json({
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          description: invoice.description,
          dueDate: invoice.dueDate,
          metadata: invoice.metadata,
          updatedAt: invoice.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update invoice error:", error);
      res.status(500).json({
        error: "Failed to update invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Finalize invoice
router.post("/:invoiceId/finalize", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!invoiceId) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const invoice = await billingService.finalizeInvoice(invoiceId, userId);

    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountDue: invoice.amountDue,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        invoicePdf: invoice.invoicePdf,
      },
      message: "Invoice has been finalized and sent",
    });
  } catch (error) {
    console.error("Finalize invoice error:", error);
    res.status(500).json({
      error: "Failed to finalize invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Pay invoice
router.post("/:invoiceId/pay", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const { paymentMethodId, offSession } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!invoiceId) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const payment = await billingService.payInvoice(invoiceId, userId, {
      paymentMethodId,
      offSession: offSession || false,
    });

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
      },
      message: "Invoice payment processed",
    });
  } catch (error) {
    console.error("Pay invoice error:", error);
    res.status(500).json({
      error: "Failed to pay invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Void invoice
router.post(
  "/:invoiceId/void",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }

      const invoice = await billingService.voidInvoice(invoiceId, userId);

      res.json({
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
        },
        message: "Invoice has been voided",
      });
    } catch (error) {
      console.error("Void invoice error:", error);
      res.status(500).json({
        error: "Failed to void invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Mark invoice as uncollectible
router.post(
  "/:invoiceId/mark-uncollectible",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }

      const invoice = await billingService.markInvoiceUncollectible(invoiceId, userId);

      res.json({
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
        },
        message: "Invoice has been marked as uncollectible",
      });
    } catch (error) {
      console.error("Mark invoice uncollectible error:", error);
      res.status(500).json({
        error: "Failed to mark invoice as uncollectible",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Send invoice
router.post(
  "/:invoiceId/send",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }

      await billingService.sendInvoice(invoiceId, userId);

      res.json({
        success: true,
        message: "Invoice has been sent",
      });
    } catch (error) {
      console.error("Send invoice error:", error);
      res.status(500).json({
        error: "Failed to send invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Download invoice PDF
router.get(
  "/:invoiceId/pdf",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!invoiceId) {
        res.status(400).json({ error: "Invoice ID is required" });
        return;
      }

      const pdfBuffer = await billingService.getInvoicePdf(invoiceId, userId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download invoice PDF error:", error);
      res.status(500).json({
        error: "Failed to download invoice PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get invoice statistics
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { period = "month" } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const stats = await billingService.getInvoiceStats(userId, period as string);

    res.json(stats);
  } catch (error) {
    console.error("Get invoice stats error:", error);
    res.status(500).json({
      error: "Failed to get invoice statistics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
