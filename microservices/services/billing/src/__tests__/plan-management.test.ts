import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { BillingService } from "../services/billing-service";
import { Pool } from "pg";

// Mock the pg Pool
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

// Mock the stripe service
jest.mock("../services/stripe-service", () => ({
  StripeService: jest.fn().mockImplementation(() => ({
    prices: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
    },
    products: {
      create: jest.fn(),
      update: jest.fn(),
    },
    invoices: {
      create: jest.fn(),
      pay: jest.fn(),
      voidInvoice: jest.fn(),
      list: jest.fn(),
    },
  })),
}));

describe("BillingService - Plan Management", () => {
  let billingService: BillingService;
  let mockClient: any;
  let mockQuery: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    mockQuery = jest.fn();
    
    // Mock Pool instance
    const MockedPool = Pool as jest.MockedClass<typeof Pool>;
    const mockPool: any = {
      connect: jest.fn().mockResolvedValue(mockClient as never) as jest.MockedFunction<any>,
      query: mockQuery,
      end: jest.fn().mockResolvedValue(undefined as never) as jest.MockedFunction<any>,
    };
    
    MockedPool.mockImplementation(() => mockPool);
    
    billingService = new BillingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getPlans", () => {
    it("should fetch all active plans by default", async () => {
      const mockPlans = [
        {
          id: "plan_1",
          name: "Basic Plan",
          display_name: "Basic",
          description: "Basic social proof features",
          price_monthly: "9.99",
          price_yearly: "99.99",
          currency: "USD",
          features: JSON.stringify(["feature1", "feature2"]),
          limits: JSON.stringify({ notifications: 1000 }),
          is_active: true,
          stripe_product_id: "prod_123",
          stripe_monthly_price_id: "price_monthly_123",
          stripe_yearly_price_id: "price_yearly_123",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "plan_2",
          name: "Pro Plan", 
          display_name: "Professional",
          description: "Advanced social proof features",
          price_monthly: "29.99",
          price_yearly: "299.99",
          currency: "USD",
          features: JSON.stringify(["feature1", "feature2", "feature3"]),
          limits: JSON.stringify({ notifications: 10000 }),
          is_active: true,
          stripe_product_id: "prod_456",
          stripe_monthly_price_id: "price_monthly_456", 
          stripe_yearly_price_id: "price_yearly_456",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPlans });

      const result = await billingService.getPlans();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM plans"),
        [true]
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].price_monthly).toBe(9.99);
      expect(result[0].features).toEqual(JSON.stringify(["feature1", "feature2"]));
      expect(result[0].limits).toEqual(JSON.stringify({ notifications: 1000 }));
    });

    it("should include inactive plans when requested", async () => {
      const mockPlans = [
        {
          id: "plan_1",
          name: "Deprecated Plan",
          is_active: false,
          price_monthly: "5.99",
          price_yearly: "59.99",
          features: JSON.stringify([]),
          limits: JSON.stringify({}),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPlans });

      await billingService.getPlans({ is_public: false });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM plans"),
        [false]
      );
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      await expect(billingService.getPlans()).rejects.toThrow("Failed to fetch plans");
    });
  });

  describe("createPlan", () => {
    it("should create plan with Stripe integration", async () => {
      const planData = {
        name: "Enterprise Plan",
        display_name: "Enterprise",
        description: "Enterprise social proof solution",
        monthly_price: 99.99,
        yearly_price: 999.99,
        features: ["feature1", "feature2", "feature3", "feature4"],
        limits: { notifications: 100000, sites: 50 },
      };

      const mockStripePlan = {
        id: "plan_enterprise",
        name: "Enterprise Plan",
        price_monthly: 99.99,
        price_yearly: 999.99,
        currency: "USD",
        stripe_product_id: "prod_enterprise",
        stripe_monthly_price_id: "price_monthly_enterprise",
        stripe_yearly_price_id: "price_yearly_enterprise",
        features: JSON.stringify(planData.features),
        limits: JSON.stringify(planData.limits),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock Stripe service calls
      const mockStripeService = (billingService as any).stripe;
      mockStripeService.products.create.mockResolvedValueOnce({
        id: "prod_enterprise",
      });
      mockStripeService.prices.create
        .mockResolvedValueOnce({ id: "price_monthly_enterprise" })
        .mockResolvedValueOnce({ id: "price_yearly_enterprise" });

      // Mock transaction calls
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockStripePlan] }) // INSERT plan
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await billingService.createPlan(planData);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockStripeService.products.create).toHaveBeenCalledWith({
        name: planData.name,
        description: planData.description,
      });
      expect(mockStripeService.prices.create).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      
      expect(result.name).toBe("Enterprise Plan");
      expect(result.price_monthly).toBe(99.99);
    });

    it("should rollback transaction on Stripe error", async () => {
      const planData = {
        name: "Test Plan",
        monthly_price: 19.99,
        yearly_price: 199.99,
        features: [],
        limits: {},
      };

      const mockStripeService = (billingService as any).stripe;
      mockStripeService.products.create.mockRejectedValueOnce(
        new Error("Stripe API error")
      );

      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN

      await expect(billingService.createPlan(planData)).rejects.toThrow(
        "Failed to create plan"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should validate required plan data", async () => {
      const invalidPlanData = {
        // Missing required name
        monthly_price: 19.99,
        features: [],
        limits: {},
      };

      await expect(billingService.createPlan(invalidPlanData as any)).rejects.toThrow(
        "Plan name is required"
      );
    });
  });

  describe("updatePlan", () => {
    it("should update plan with new data", async () => {
      const planId = "plan_123";
      const updateData = {
        display_name: "Updated Plan Name",
        description: "Updated description",
        features: ["new_feature1", "new_feature2"],
        limits: { notifications: 5000 },
        is_active: false,
      };

      const mockUpdatedPlan = {
        id: planId,
        name: "Original Plan",
        display_name: "Updated Plan Name",
        description: "Updated description",
        price_monthly: "19.99",
        price_yearly: "199.99",
        features: JSON.stringify(updateData.features),
        limits: JSON.stringify(updateData.limits),
        is_active: false,
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedPlan] });

      const result = await billingService.updatePlan(planId, updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE plans SET"),
        expect.arrayContaining([
          updateData.display_name,
          updateData.description,
          JSON.stringify(updateData.features),
          JSON.stringify(updateData.limits),
          updateData.is_active,
          expect.any(Date),
          planId,
        ])
      );
      
      expect(result.display_name).toBe("Updated Plan Name");
      expect(result.features).toEqual(updateData.features);
      expect(result.is_active).toBe(false);
    });

    it("should handle non-existent plan", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(billingService.updatePlan("invalid_id", {}))
        .rejects.toThrow("Plan not found");
    });
  });

  describe("deletePlan", () => {
    it("should soft delete plan by setting inactive", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        name: "Test Plan",
        is_active: false,
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      const result = await billingService.deletePlan(planId, "user-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE plans SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *",
        [planId]
      );
      
      expect(result.is_active).toBe(false);
    });

    it("should handle non-existent plan", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(billingService.deletePlan("invalid_id", "user-123"))
        .rejects.toThrow("Plan not found");
    });
  });

  describe("getPlan", () => {
    it("should fetch plan by ID", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        name: "Test Plan",
        price_monthly: "19.99",
        features: JSON.stringify(["feature1"]),
        limits: JSON.stringify({ notifications: 1000 }),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      const result = await billingService.getPlan(planId);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM plans WHERE id = $1",
        [planId]
      );
      
      expect(result.id).toBe(planId);
      expect(result.features).toEqual(["feature1"]);
    });

    it("should return null for non-existent plan", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await billingService.getPlan("invalid_id");

      expect(result).toBeNull();
    });
  });

  describe("comparePlans", () => {
    it("should compare multiple plans", async () => {
      const planIds = ["plan_1", "plan_2"];
      const mockPlans = [
        {
          id: "plan_1",
          name: "Basic Plan",
          price_monthly: "9.99",
          features: JSON.stringify(["feature1", "feature2"]),
          limits: JSON.stringify({ notifications: 1000 }),
        },
        {
          id: "plan_2", 
          name: "Pro Plan",
          price_monthly: "29.99",
          features: JSON.stringify(["feature1", "feature2", "feature3"]),
          limits: JSON.stringify({ notifications: 10000 }),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPlans });

      const result = await billingService.comparePlans(planIds);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM plans WHERE id = ANY($1)"),
        [planIds]
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].price_monthly).toBe(9.99);
      expect(result[1].price_monthly).toBe(29.99);
    });

    it("should handle empty plan IDs array", async () => {
      const result = await billingService.comparePlans([]);
      expect(result).toEqual([]);
    });
  });

  describe("getPlanPricing", () => {
    it("should calculate plan pricing with discount", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        price_monthly: "29.99",
        price_yearly: "299.99",
        currency: "USD",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      const result = await billingService.getPlanPricing(planId);

      expect(result.original_price).toBe(29.99);
      expect(result.discount_amount).toBe(2.999);
      expect(result.final_price).toBe(26.991);
      expect(result.currency).toBe("USD");
      expect(result.billing_cycle).toBe("monthly");
    });

    it("should calculate yearly pricing with savings", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        price_monthly: "29.99",
        price_yearly: "299.99",
        currency: "USD",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      const result = await billingService.getPlanPricing(planId);

      expect(result.original_price).toBe(299.99);
      expect(result.yearly_savings).toBe(59.89); // (29.99 * 12) - 299.99
      expect(result.billing_cycle).toBe("yearly");
    });

    it("should handle invalid billing cycle", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        price_monthly: "29.99",
        price_yearly: "299.99",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      await expect(billingService.getPlanPricing(planId))
        .rejects.toThrow("Invalid billing cycle");
    });
  });

  describe("getPlanFeatures", () => {
    it("should return formatted plan features", async () => {
      const planId = "plan_123";
      const mockPlan = {
        id: planId,
        features: JSON.stringify([
          "unlimited_notifications",
          "custom_branding",
          "advanced_analytics",
          "priority_support"
        ]),
        limits: JSON.stringify({
          notifications: 10000,
          sites: 10,
          team_members: 5
        }),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPlan] });

      const result = await billingService.getPlanFeatures(planId);

      expect(result.features).toEqual([
        "unlimited_notifications",
        "custom_branding", 
        "advanced_analytics",
        "priority_support"
      ]);
      expect(result.limits).toEqual({
        notifications: 10000,
        sites: 10,
        team_members: 5
      });
      expect(result.feature_descriptions).toBeDefined();
      expect(result.feature_descriptions.unlimited_notifications).toBe(
        "Send unlimited social proof notifications"
      );
    });

    it("should handle plan not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(billingService.getPlanFeatures("invalid_id"))
        .rejects.toThrow("Plan not found");
    });
  });

  describe("getRecommendedPlan", () => {
    it("should recommend plan based on usage", async () => {
      const usage = {
        monthly_notifications: 5000,
        sites: 3,
        team_members: 2,
      };

      const mockPlans = [
        {
          id: "plan_basic",
          name: "Basic Plan",
          price_monthly: "9.99",
          limits: JSON.stringify({ notifications: 1000, sites: 1, team_members: 1 }),
        },
        {
          id: "plan_pro",
          name: "Pro Plan", 
          price_monthly: "29.99",
          limits: JSON.stringify({ notifications: 10000, sites: 5, team_members: 5 }),
        },
        {
          id: "plan_enterprise",
          name: "Enterprise Plan",
          price_monthly: "99.99", 
          limits: JSON.stringify({ notifications: 100000, sites: 50, team_members: 20 }),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPlans });

      const result = await billingService.getRecommendedPlan("user-123", { usage_data: usage });

      expect(result.recommended_plan.id).toBe("plan_pro");
      expect(result.reason).toContain("fits your usage requirements");
      expect(result.usage_analysis.notifications.recommended_limit).toBe(10000);
    });

    it("should recommend upgrade when usage exceeds all plans", async () => {
      const usage = {
        monthly_notifications: 200000,
        sites: 100,
        team_members: 50,
      };

      const mockPlans = [
        {
          id: "plan_enterprise",
          name: "Enterprise Plan",
          price_monthly: "99.99",
          limits: JSON.stringify({ notifications: 100000, sites: 50, team_members: 20 }),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPlans });

      const result = await billingService.getRecommendedPlan("user-123", { usage_data: usage });

      expect(result.recommended_plan.id).toBe("plan_enterprise");
      expect(result.reason).toContain("exceeds our highest tier");
      expect(result.needs_custom_plan).toBe(true);
    });
  });
});