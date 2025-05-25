import { query, queryOne } from "../utils/database";
import { Plan, PlanFeature, PlanLimit } from "../types";

export class PlanRepository {
  /**
   * Get all public plans
   */
  async getPublicPlans(): Promise<Plan[]> {
    const results = await query<Plan>(
      "SELECT * FROM plans WHERE is_public = true ORDER BY sort_order ASC"
    );
    return results;
  }

  /**
   * Get plan by ID
   */
  async getById(id: string): Promise<Plan | null> {
    const result = await queryOne<Plan>(
      "SELECT * FROM plans WHERE id = $1",
      [id]
    );
    return result;
  }

  /**
   * Get plan by name
   */
  async getByName(name: string): Promise<Plan | null> {
    const result = await queryOne<Plan>(
      "SELECT * FROM plans WHERE name = $1",
      [name]
    );
    return result;
  }

  /**
   * Get plan features
   */
  async getPlanFeatures(planId: string): Promise<PlanFeature[]> {
    const results = await query<PlanFeature>(
      "SELECT * FROM plan_features WHERE plan_id = $1 ORDER BY created_at ASC",
      [planId]
    );
    return results;
  }

  /**
   * Get plan limits
   */
  async getPlanLimits(planId: string): Promise<PlanLimit[]> {
    const results = await query<PlanLimit>(
      "SELECT * FROM plan_limits WHERE plan_id = $1",
      [planId]
    );
    return results;
  }

  /**
   * Get plan limit for specific resource
   */
  async getPlanLimit(planId: string, resourceType: string): Promise<PlanLimit | null> {
    const result = await queryOne<PlanLimit>(
      "SELECT * FROM plan_limits WHERE plan_id = $1 AND resource_type = $2",
      [planId, resourceType]
    );
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