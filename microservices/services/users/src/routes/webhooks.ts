import { Router, Request, Response } from "express";
import { clerkSync } from "../utils/clerkSync";
import { logger } from "../utils/logger";
import crypto from "crypto";

const router = Router();

/**
 * Verify Clerk webhook signature
 */
function verifyClerkWebhook(payload: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    // Clerk sends signature in format "v1,<hash>"
    const receivedSignature = signature.replace("v1,", "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch (error) {
    logger.error("Error verifying Clerk webhook signature", { error });
    return false;
  }
}

/**
 * Middleware to parse and verify Clerk webhook
 */
async function validateClerkWebhook(req: Request, res: Response, next: any) {
  try {
    const signature = req.headers["svix-signature"] as string;
    const secret = process.env.CLERK_WEBHOOK_SECRET;

    if (!signature || !secret) {
      logger.error("Missing webhook signature or secret");
      return res.status(400).json({ error: "Missing webhook signature or secret" });
    }

    const payload = JSON.stringify(req.body);

    if (!verifyClerkWebhook(payload, signature, secret)) {
      logger.error("Invalid webhook signature");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    next();
  } catch (error) {
    logger.error("Error validating Clerk webhook", { error });
    return res.status(400).json({ error: "Invalid webhook" });
  }
}

/**
 * Handle Clerk webhook events
 * POST /api/webhooks/clerk
 */
router.post("/clerk", validateClerkWebhook, async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    logger.info("Received Clerk webhook", {
      type,
      userId: data?.id,
      timestamp: Date.now(),
    });

    // Process the webhook event
    await clerkSync.handleClerkWebhook(type, data);

    // Send success response
    res.status(200).json({
      message: "Webhook processed successfully",
      type,
      userId: data?.id,
    });
  } catch (error) {
    logger.error("Error processing Clerk webhook", {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    // Return error but don't let it affect the webhook delivery
    res.status(500).json({
      error: "Failed to process webhook",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Manual sync endpoint for data recovery
 * POST /api/webhooks/sync/:clerkUserId
 */
router.post("/sync/:clerkUserId", async (req: Request, res: Response) => {
  try {
    const { clerkUserId } = req.params;

    logger.info("Manual sync requested", { clerkUserId });

    await clerkSync.manualSync(clerkUserId);

    res.status(200).json({
      message: "Manual sync completed",
      clerkUserId,
    });
  } catch (error) {
    logger.error("Error in manual sync", {
      clerkUserId: req.params.clerkUserId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Manual sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get sync status for a user
 * GET /api/webhooks/sync/:clerkUserId/status
 */
router.get("/sync/:clerkUserId/status", async (req: Request, res: Response) => {
  try {
    const { clerkUserId } = req.params;

    const syncStatus = await clerkSync.getSyncStatus(clerkUserId);

    if (!syncStatus) {
      return res.status(404).json({
        error: "Sync record not found",
        clerkUserId,
      });
    }

    res.status(200).json({
      clerkUserId,
      ...syncStatus,
    });
  } catch (error) {
    logger.error("Error getting sync status", {
      clerkUserId: req.params.clerkUserId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to get sync status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Health check for sync service
 * GET /api/webhooks/sync/health
 */
router.get("/sync/health", async (req: Request, res: Response) => {
  try {
    const healthStatus = await clerkSync.healthCheck();

    const statusCode = healthStatus.status === "healthy" ? 200 : 503;

    res.status(statusCode).json({
      ...healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in sync health check", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(503).json({
      status: "unhealthy",
      error: "Health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * List recent sync activities (for monitoring)
 * GET /api/webhooks/sync/recent
 */
router.get("/sync/recent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get recent sync records (would be implemented in ClerkSyncService)
    // For now, just return empty array with success
    res.status(200).json({
      syncs: [],
      total: 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Error getting recent syncs", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to get recent syncs",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
