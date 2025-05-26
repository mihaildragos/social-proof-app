import { Router, Request, Response } from "express";
import { BillingService } from "../services/billing-service";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();
const billingService = new BillingService();

// Validation schemas
const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  receiptEmail: z.string().email().optional(),
});

const createPaymentMethodSchema = z.object({
  type: z.enum(["card", "bank_account", "paypal"]),
  card: z
    .object({
      number: z.string().optional(),
      expMonth: z.number().min(1).max(12).optional(),
      expYear: z.number().min(new Date().getFullYear()).optional(),
      cvc: z.string().optional(),
    })
    .optional(),
  bankAccount: z
    .object({
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
      accountType: z.enum(["checking", "savings"]).optional(),
    })
    .optional(),
  billingDetails: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z
        .object({
          line1: z.string().optional(),
          line2: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
  metadata: z.record(z.string()).optional(),
});

// Create one-time payment
router.post(
  "/",
  authMiddleware,
  validateRequest(createPaymentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, currency, paymentMethodId, description, metadata, receiptEmail } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const payment = await billingService.createPayment({
        userId,
        amount,
        currency,
        paymentMethodId,
        description,
        metadata,
        receiptEmail,
      });

      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          description: payment.description,
          receiptUrl: payment.receiptUrl,
          createdAt: payment.createdAt,
        },
      });
    } catch (error) {
      console.error("Create payment error:", error);
      res.status(500).json({
        error: "Failed to create payment",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get user's payments
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { status, limit = 20, offset = 0, startDate, endDate } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const paymentOptions: {
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {
      limit: Number(limit),
      offset: Number(offset),
    };

    if (status) paymentOptions.status = status as string;
    if (startDate) paymentOptions.startDate = new Date(startDate as string);
    if (endDate) paymentOptions.endDate = new Date(endDate as string);

    const payments = await billingService.getUserPayments(userId, paymentOptions);

    res.json({
      payments: payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receiptUrl,
        createdAt: payment.createdAt,
      })),
      total: payments.length,
    });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({
      error: "Failed to get payments",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get specific payment
router.get("/:paymentId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!paymentId) {
      res.status(400).json({ error: "Payment ID is required" });
      return;
    }

    const payment = await billingService.getPayment(paymentId, userId);

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    res.json({
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        paymentMethodId: payment.paymentMethodId,
        receiptUrl: payment.receiptUrl,
        failureReason: payment.failureReason,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({
      error: "Failed to get payment",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Refund payment
router.post(
  "/:paymentId/refund",
  authMiddleware,
  validateRequest(refundPaymentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.params;
      const { amount, reason, metadata } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!paymentId) {
        res.status(400).json({ error: "Payment ID is required" });
        return;
      }

      const refund = await billingService.refundPayment(paymentId, userId, {
        amount,
        reason,
        metadata,
      });

      res.json({
        success: true,
        refund: {
          id: refund.id,
          paymentId: refund.paymentId,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          createdAt: refund.createdAt,
        },
      });
    } catch (error) {
      console.error("Refund payment error:", error);
      res.status(500).json({
        error: "Failed to refund payment",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Create payment method
router.post(
  "/methods",
  authMiddleware,
  validateRequest(createPaymentMethodSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, card, bankAccount, billingDetails } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const paymentMethod = await billingService.createPaymentMethod({
        userId,
        type,
        card,
        bankAccount,
        billingDetails,
      });

      res.status(201).json({
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card,
          bankAccount: paymentMethod.bankAccount,
          billingDetails: paymentMethod.billingDetails,
          createdAt: paymentMethod.createdAt,
        },
      });
    } catch (error) {
      console.error("Create payment method error:", error);
      res.status(500).json({
        error: "Failed to create payment method",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get user's payment methods
router.get("/methods", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { type } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const paymentMethods = await billingService.getUserPaymentMethods(userId, {
      type: type as string,
    });

    res.json({
      paymentMethods: paymentMethods.map((method: any) => ({
        id: method.id,
        type: method.type,
        card: method.card,
        bankAccount: method.bankAccount,
        billingDetails: method.billingDetails,
        isDefault: method.isDefault,
        createdAt: method.createdAt,
      })),
      total: paymentMethods.length,
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({
      error: "Failed to get payment methods",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update payment method
router.put(
  "/methods/:paymentMethodId",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentMethodId } = req.params;
      const { billingDetails, isDefault } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!paymentMethodId) {
        res.status(400).json({ error: "Payment method ID is required" });
        return;
      }

      const paymentMethod = await billingService.updatePaymentMethod(paymentMethodId, userId, {
        billingDetails,
        isDefault,
      });

      res.json({
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          billingDetails: paymentMethod.billingDetails,
          isDefault: paymentMethod.isDefault,
          updatedAt: paymentMethod.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update payment method error:", error);
      res.status(500).json({
        error: "Failed to update payment method",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Delete payment method
router.delete(
  "/methods/:paymentMethodId",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentMethodId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!paymentMethodId) {
        res.status(400).json({ error: "Payment method ID is required" });
        return;
      }

      await billingService.deletePaymentMethod(paymentMethodId, userId);

      res.json({
        success: true,
        message: "Payment method deleted successfully",
      });
    } catch (error) {
      console.error("Delete payment method error:", error);
      res.status(500).json({
        error: "Failed to delete payment method",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get payment statistics
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { period = "month" } = req.query;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const stats = await billingService.getPaymentStats(userId, period as string);

    res.json(stats);
  } catch (error) {
    console.error("Get payment stats error:", error);
    res.status(500).json({
      error: "Failed to get payment statistics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
