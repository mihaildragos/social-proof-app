import { prisma } from "../lib/prisma";
import { Plan, PlanFeature, PlanLimit } from "../types";

export class PlanRepository {
  /**
   * Get all public plans
   */
  async getPublicPlans(): Promise<Plan[]> {
    const results = await prisma.plan.findMany({
      where: {
        isPublic: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });
    return results;
  }

  /**
   * Get plan by ID
   */
  async getById(id: string): Promise<Plan | null> {
    const result = await prisma.plan.findUnique({
      where: {
        id
      }
    });
    return result;
  }

  /**
   * Get plan by name
   */
  async getByName(name: string): Promise<Plan | null> {
    const result = await prisma.plan.findUnique({
      where: {
        name
      }
    });
    return result;
  }

  /**
   * Get plan features
   */
  async getPlanFeatures(planId: string): Promise<PlanFeature[]> {
    const results = await prisma.planFeature.findMany({
      where: {
        planId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    return results;
  }

  /**
   * Get plan limits
   */
  async getPlanLimits(planId: string): Promise<PlanLimit[]> {
    const results = await prisma.planLimit.findMany({
      where: {
        planId
      }
    });
    return results;
  }

  /**
   * Get plan limit for specific resource
   */
  async getPlanLimit(planId: string, resourceType: string): Promise<PlanLimit | null> {
    const result = await prisma.planLimit.findUnique({
      where: {
        unique_plan_resource: {
          planId,
          resourceType
        }
      }
    });
    return result;
  }

  /**
   * Get plan with features and limits
   */
  async getPlanWithDetails(planId: string): Promise<{
    plan: Plan | null;
    features: PlanFeature[];
    limits: PlanLimit[];
  }> {
    const plan = await this.getById(planId);
    
    if (!plan) {
      return {
        plan: null,
        features: [],
        limits: []
      };
    }

    const [features, limits] = await Promise.all([
      this.getPlanFeatures(planId),
      this.getPlanLimits(planId)
    ]);

    return {
      plan,
      features,
      limits
    };
  }

  /**
   * Get all plans with their features and limits
   */
  async getAllPlansWithDetails(): Promise<Array<{
    plan: Plan;
    features: PlanFeature[];
    limits: PlanLimit[];
  }>> {
    const plans = await this.getPublicPlans();
    
    const plansWithDetails = await Promise.all(
      plans.map(async (plan) => {
        const [features, limits] = await Promise.all([
          this.getPlanFeatures(plan.id),
          this.getPlanLimits(plan.id)
        ]);

        return {
          plan,
          features,
          limits
        };
      })
    );

    return plansWithDetails;
  }
} 