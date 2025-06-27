import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock A/B test data
const mockAbTest = {
  id: "ab-test-123",
  name: "Purchase Template Test",
  organizationId: "org-123",
  type: "template",
  status: "running",
  trafficSplit: 50,
  variants: [
    {
      id: "variant-a",
      name: "Control",
      templateId: "template-1",
      weight: 50,
    },
    {
      id: "variant-b",
      name: "Treatment",
      templateId: "template-2",
      weight: 50,
    },
  ],
  metrics: {
    conversions: { variantA: 45, variantB: 67 },
    impressions: { variantA: 1000, variantB: 1000 },
  },
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-31"),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// Mock database operations
const mockPrisma: any = {
  abTest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  abTestVariant: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  abTestMetric: {
    create: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
};

// Mock Redis cache
const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
};

// Mock event publisher
const mockEventPublisher: any = {
  publish: jest.fn(),
};

describe("Notifications Service - A/B Test Management (PostgreSQL + Prisma Architecture)", () => {
  // Mock AbTestService class
  class AbTestService {
    constructor(
      private prisma = mockPrisma,
      private redis = mockRedis,
      private eventPublisher = mockEventPublisher
    ) {}

    async createAbTest(testData: {
      name: string;
      organizationId: string;
      type: string;
      variants: Array<{
        name: string;
        templateId?: string;
        weight: number;
      }>;
      trafficSplit: number;
      startDate?: Date;
      endDate?: Date;
    }) {
      // Validate required fields
      if (!testData.name) {
        throw new Error("A/B test name is required");
      }
      if (!testData.organizationId) {
        throw new Error("Organization ID is required");
      }
      if (!testData.variants || testData.variants.length < 2) {
        throw new Error("At least 2 variants are required");
      }

      // Validate weights sum to 100
      const totalWeight = testData.variants.reduce((sum, v) => sum + v.weight, 0);
      if (totalWeight !== 100) {
        throw new Error("Variant weights must sum to 100");
      }

      // Validate organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: testData.organizationId },
      });

      if (!organization) {
        throw new Error("Organization not found");
      }

      // Create A/B test
      const abTest = await this.prisma.abTest.create({
        data: {
          name: testData.name,
          organizationId: testData.organizationId,
          type: testData.type,
          status: "draft",
          trafficSplit: testData.trafficSplit,
          startDate: testData.startDate,
          endDate: testData.endDate,
        },
      });

      // Create variants
      const variants = await Promise.all(
        testData.variants.map((variant, index) =>
          this.prisma.abTestVariant.create({
            data: {
              abTestId: abTest.id,
              name: variant.name,
              templateId: variant.templateId,
              weight: variant.weight,
              isControl: index === 0,
            },
          })
        )
      );

      // Publish event
      await this.eventPublisher.publish("ab_test.created", {
        abTestId: abTest.id,
        organizationId: testData.organizationId,
        variants: variants.length,
      });

      return { ...abTest, variants };
    }

    async getAbTestById(id: string) {
      if (!id) {
        throw new Error("A/B test ID is required");
      }

      const abTest = await this.prisma.abTest.findUnique({
        where: { id },
        include: {
          variants: true,
          metrics: true,
        },
      });

      if (!abTest) {
        throw new Error("A/B test not found");
      }

      return abTest;
    }

    async startAbTest(id: string) {
      if (!id) {
        throw new Error("A/B test ID is required");
      }

      const abTest = await this.prisma.abTest.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!abTest) {
        throw new Error("A/B test not found");
      }

      if (abTest.status !== "draft") {
        throw new Error("Only draft A/B tests can be started");
      }

      const updatedTest = await this.prisma.abTest.update({
        where: { id },
        data: {
          status: "running",
          startDate: abTest.startDate || new Date(),
        },
      });

      // Clear any cached results
      await this.redis.del(`ab_test:${id}:*`);

      // Publish event
      await this.eventPublisher.publish("ab_test.started", {
        abTestId: id,
        organizationId: abTest.organizationId,
      });

      return updatedTest;
    }

    async stopAbTest(id: string) {
      if (!id) {
        throw new Error("A/B test ID is required");
      }

      const abTest = await this.prisma.abTest.findUnique({
        where: { id },
      });

      if (!abTest) {
        throw new Error("A/B test not found");
      }

      if (abTest.status !== "running") {
        throw new Error("Only running A/B tests can be stopped");
      }

      const updatedTest = await this.prisma.abTest.update({
        where: { id },
        data: {
          status: "completed",
          endDate: new Date(),
        },
      });

      // Publish event
      await this.eventPublisher.publish("ab_test.stopped", {
        abTestId: id,
        organizationId: abTest.organizationId,
      });

      return updatedTest;
    }

    async getVariantForUser(abTestId: string, userId: string) {
      if (!abTestId || !userId) {
        throw new Error("A/B test ID and user ID are required");
      }

      // Check cache first
      const cached = await this.redis.get(`ab_test:${abTestId}:user:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const abTest = await this.prisma.abTest.findUnique({
        where: { id: abTestId },
        include: { variants: true },
      });

      if (!abTest || abTest.status !== "running") {
        return null;
      }

      // Simple hash-based assignment
      const hash = this.hashUserId(userId);
      const bucket = hash % 100;

      // Check if user falls within traffic split
      if (bucket >= abTest.trafficSplit) {
        return null; // User not in test
      }

      // Assign to variant based on weights
      let cumulativeWeight = 0;
      for (const variant of abTest.variants) {
        cumulativeWeight += variant.weight;
        if (bucket < (cumulativeWeight * abTest.trafficSplit) / 100) {
          // Cache assignment
          await this.redis.set(
            `ab_test:${abTestId}:user:${userId}`,
            JSON.stringify(variant),
            "EX",
            86400 // 24 hours
          );

          return variant;
        }
      }

      return abTest.variants[0]; // Fallback to control
    }

    async recordConversion(abTestId: string, variantId: string, userId: string) {
      if (!abTestId || !variantId || !userId) {
        throw new Error("A/B test ID, variant ID, and user ID are required");
      }

      // Record the conversion
      await this.prisma.abTestMetric.create({
        data: {
          abTestId,
          variantId,
          userId,
          metricType: "conversion",
          value: 1,
          timestamp: new Date(),
        },
      });

      // Increment Redis counter for real-time stats
      await this.redis.incr(`ab_test:${abTestId}:variant:${variantId}:conversions`);

      // Publish event for real-time updates
      await this.eventPublisher.publish("ab_test.conversion", {
        abTestId,
        variantId,
        userId,
      });
    }

    async getAbTestResults(abTestId: string) {
      if (!abTestId) {
        throw new Error("A/B test ID is required");
      }

      // Check cache first
      const cached = await this.redis.get(`ab_test:${abTestId}:results`);
      if (cached) {
        return JSON.parse(cached);
      }

      const abTest = await this.prisma.abTest.findUnique({
        where: { id: abTestId },
        include: { variants: true },
      });

      if (!abTest) {
        throw new Error("A/B test not found");
      }

      // Get metrics for each variant
      const variantResults = await Promise.all(
        abTest.variants.map(async (variant) => {
          const metrics = await this.prisma.abTestMetric.groupBy({
            by: ["metricType"],
            where: {
              abTestId,
              variantId: variant.id,
            },
            _count: true,
            _sum: {
              value: true,
            },
          });

          const conversions = metrics.find((m) => m.metricType === "conversion")?._sum?.value || 0;
          const impressions = metrics.find((m) => m.metricType === "impression")?._count || 0;

          return {
            variantId: variant.id,
            variantName: variant.name,
            isControl: variant.isControl,
            conversions,
            impressions,
            conversionRate: impressions > 0 ? (conversions / impressions) * 100 : 0,
          };
        })
      );

      // Calculate statistical significance
      const controlVariant = variantResults.find((v) => v.isControl);
      const treatmentVariants = variantResults.filter((v) => !v.isControl);

      const results = {
        abTestId,
        status: abTest.status,
        startDate: abTest.startDate,
        endDate: abTest.endDate,
        variants: variantResults,
        statisticalSignificance: this.calculateSignificance(controlVariant, treatmentVariants),
      };

      // Cache results for 5 minutes
      await this.redis.set(`ab_test:${abTestId}:results`, JSON.stringify(results), "EX", 300);

      return results;
    }

    private hashUserId(userId: string): number {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }

    private calculateSignificance(control: any, treatments: any[]): any {
      if (!control || treatments.length === 0) {
        return { isSignificant: false, confidence: 0 };
      }

      // Simplified significance calculation
      // In production, you'd use proper statistical tests
      const controlRate = control.conversionRate;
      const treatmentRate = treatments[0].conversionRate;
      const difference = Math.abs(treatmentRate - controlRate);

      return {
        isSignificant: difference > 5, // 5% difference threshold
        confidence:
          difference > 10 ? 95
          : difference > 5 ? 85
          : 50,
        difference: difference,
      };
    }
  }

  let abTestService: AbTestService;

  beforeEach(() => {
    abTestService = new AbTestService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createAbTest", () => {
    it("should create A/B test successfully", async () => {
      const testData = {
        name: "Purchase Template Test",
        organizationId: "org-123",
        type: "template",
        variants: [
          { name: "Control", templateId: "template-1", weight: 50 },
          { name: "Treatment", templateId: "template-2", weight: 50 },
        ],
        trafficSplit: 100,
      };

      mockPrisma.organization.findUnique.mockResolvedValueOnce({ id: "org-123" });
      mockPrisma.abTest.create.mockResolvedValueOnce(mockAbTest);
      mockPrisma.abTestVariant.create
        .mockResolvedValueOnce({ id: "variant-a", name: "Control" })
        .mockResolvedValueOnce({ id: "variant-b", name: "Treatment" });
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      const result = await abTestService.createAbTest(testData);

      expect(result.name).toBe("Purchase Template Test");
      expect(result.variants).toHaveLength(2);
      expect(mockPrisma.abTest.create).toHaveBeenCalledWith({
        data: {
          name: "Purchase Template Test",
          organizationId: "org-123",
          type: "template",
          status: "draft",
          trafficSplit: 100,
          startDate: undefined,
          endDate: undefined,
        },
      });
    });

    it("should throw error for invalid variant weights", async () => {
      const testData = {
        name: "Test",
        organizationId: "org-123",
        type: "template",
        variants: [
          { name: "Control", weight: 40 },
          { name: "Treatment", weight: 50 }, // Total: 90, should be 100
        ],
        trafficSplit: 100,
      };

      await expect(abTestService.createAbTest(testData)).rejects.toThrow(
        "Variant weights must sum to 100"
      );
    });

    it("should throw error for insufficient variants", async () => {
      const testData = {
        name: "Test",
        organizationId: "org-123",
        type: "template",
        variants: [{ name: "Control", weight: 100 }], // Only 1 variant
        trafficSplit: 100,
      };

      await expect(abTestService.createAbTest(testData)).rejects.toThrow(
        "At least 2 variants are required"
      );
    });
  });

  describe("startAbTest", () => {
    it("should start draft A/B test successfully", async () => {
      const draftTest = { ...mockAbTest, status: "draft" };

      mockPrisma.abTest.findUnique.mockResolvedValueOnce(draftTest);
      mockPrisma.abTest.update.mockResolvedValueOnce({ ...draftTest, status: "running" });
      mockRedis.del.mockResolvedValueOnce("OK");
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      const result = await abTestService.startAbTest("ab-test-123");

      expect(result.status).toBe("running");
      expect(mockPrisma.abTest.update).toHaveBeenCalledWith({
        where: { id: "ab-test-123" },
        data: {
          status: "running",
          startDate: expect.any(Date),
        },
      });
    });

    it("should not start non-draft A/B test", async () => {
      const runningTest = { ...mockAbTest, status: "running" };

      mockPrisma.abTest.findUnique.mockResolvedValueOnce(runningTest);

      await expect(abTestService.startAbTest("ab-test-123")).rejects.toThrow(
        "Only draft A/B tests can be started"
      );
    });
  });

  describe("getVariantForUser", () => {
    it("should return cached variant if available", async () => {
      const cachedVariant = { id: "variant-a", name: "Control" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedVariant));

      const result = await abTestService.getVariantForUser("ab-test-123", "user-456");

      expect(result).toEqual(cachedVariant);
      expect(mockRedis.get).toHaveBeenCalledWith("ab_test:ab-test-123:user:user-456");
    });

    it("should assign variant based on hash and cache result", async () => {
      const runningTest = { ...mockAbTest, status: "running", trafficSplit: 100 };

      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.abTest.findUnique.mockResolvedValueOnce(runningTest);
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await abTestService.getVariantForUser("ab-test-123", "user-456");

      expect(result).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it("should return null for inactive A/B test", async () => {
      const stoppedTest = { ...mockAbTest, status: "completed" };

      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.abTest.findUnique.mockResolvedValueOnce(stoppedTest);

      const result = await abTestService.getVariantForUser("ab-test-123", "user-456");

      expect(result).toBeNull();
    });
  });

  describe("recordConversion", () => {
    it("should record conversion successfully", async () => {
      mockPrisma.abTestMetric.create.mockResolvedValueOnce({ id: "metric-123" });
      mockRedis.incr.mockResolvedValueOnce(1);
      mockEventPublisher.publish.mockResolvedValueOnce(undefined);

      await abTestService.recordConversion("ab-test-123", "variant-a", "user-456");

      expect(mockPrisma.abTestMetric.create).toHaveBeenCalledWith({
        data: {
          abTestId: "ab-test-123",
          variantId: "variant-a",
          userId: "user-456",
          metricType: "conversion",
          value: 1,
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe("getAbTestResults", () => {
    it("should return cached results if available", async () => {
      const cachedResults = { abTestId: "ab-test-123", variants: [] };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResults));

      const result = await abTestService.getAbTestResults("ab-test-123");

      expect(result).toEqual(cachedResults);
      expect(mockRedis.get).toHaveBeenCalledWith("ab_test:ab-test-123:results");
    });

    it("should calculate and cache results if not cached", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.abTest.findUnique.mockResolvedValueOnce(mockAbTest);
      mockPrisma.abTestMetric.groupBy.mockResolvedValue([
        { metricType: "conversion", _count: 10, _sum: { value: 10 } },
        { metricType: "impression", _count: 100 },
      ]);
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await abTestService.getAbTestResults("ab-test-123");

      expect(result.abTestId).toBe("ab-test-123");
      expect(result.variants).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });
});
