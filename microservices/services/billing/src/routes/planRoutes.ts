import { Router, Request, Response } from "express";
import { PlanRepository } from "../repositories/PlanRepository";
import { logger } from "../utils/logger";
import { NotFoundError } from "../middleware/errorHandler";
import { ApiResponse } from "../types";

const router = Router();
const planRepo = new PlanRepository();

/**
 * GET /plans
 * Get all public plans with features and limits
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const plansWithDetails = await planRepo.getAllPlansWithDetails();

    const response: ApiResponse = {
      status: "success",
      data: plansWithDetails
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to get plans", { error });
    throw error;
  }
});

/**
 * GET /plans/:id
 * Get specific plan with features and limits
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const planDetails = await planRepo.getPlanWithDetails(id);

    if (!planDetails.plan) {
      throw new NotFoundError("Plan not found");
    }

    const response: ApiResponse = {
      status: "success",
      data: planDetails
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to get plan", { error, planId: req.params.id });
    throw error;
  }
});

/**
 * GET /plans/:id/features
 * Get plan features
 */
router.get("/:id/features", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify plan exists
    const plan = await planRepo.getById(id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const features = await planRepo.getPlanFeatures(id);

    const response: ApiResponse = {
      status: "success",
      data: features
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to get plan features", { error, planId: req.params.id });
    throw error;
  }
});

/**
 * GET /plans/:id/limits
 * Get plan limits
 */
router.get("/:id/limits", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify plan exists
    const plan = await planRepo.getById(id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const limits = await planRepo.getPlanLimits(id);

    const response: ApiResponse = {
      status: "success",
      data: limits
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to get plan limits", { error, planId: req.params.id });
    throw error;
  }
});

export default router; 