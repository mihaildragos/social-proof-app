import { Router } from "express";
import subscriptionRoutes from "./subscriptionRoutes";
import planRoutes from "./planRoutes";
import webhookRoutes from "./webhookRoutes";

const router = Router();

// Mount route modules
router.use("/subscriptions", subscriptionRoutes);
router.use("/plans", planRoutes);
router.use("/webhooks", webhookRoutes);

export default router; 