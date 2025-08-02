import { Logger } from "../utils/logger";
import { NotificationService } from "./notificationService";
import { createHash } from "crypto";

export interface AbTestConfig {
  dataService: NotificationService;
  logger: Logger;
  defaultTrafficSplit?: number;
  minSampleSize?: number;
  confidenceLevel?: number;
}

export interface AbTestAssignment {
  testId: string;
  variant: 'control' | 'variant';
  assignmentId: string;
  assignedAt: string;
  userId?: string;
  sessionId?: string;
}

export interface AbTestResult {
  testId: string;
  controlMetrics: VariantMetrics;
  variantMetrics: VariantMetrics;
  statisticalSignificance: StatisticalResult;
  recommendation: 'control' | 'variant' | 'inconclusive';
  confidence: number;
}

export interface VariantMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  conversionRate: number;
  revenue?: number;
  averageOrderValue?: number;
}

export interface StatisticalResult {
  isSignificant: boolean;
  pValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  effect: number;
  sampleSize: number;
}

export interface AbTestParticipant {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  metadata?: Record<string, any>;
}

/**
 * A/B Testing service for notification optimization
 * Handles test assignment, tracking, and statistical analysis
 */
export class AbTestService {
  private dataService: NotificationService;
  private logger: Logger;
  private defaultTrafficSplit: number;
  private minSampleSize: number;
  private confidenceLevel: number;

  // Assignment cache to ensure consistent assignments
  private assignmentCache: Map<string, AbTestAssignment>;

  constructor(config: AbTestConfig) {
    this.dataService = config.dataService;
    this.logger = config.logger;
    this.defaultTrafficSplit = config.defaultTrafficSplit ?? 50; // 50% split by default
    this.minSampleSize = config.minSampleSize ?? 100; // Minimum sample size per variant
    this.confidenceLevel = config.confidenceLevel ?? 0.95; // 95% confidence level
    
    this.assignmentCache = new Map();

    this.logger.info("A/B Testing service initialized", {
      defaultTrafficSplit: this.defaultTrafficSplit,
      minSampleSize: this.minSampleSize,
      confidenceLevel: this.confidenceLevel,
    });
  }

  /**
   * Assign a participant to an A/B test variant
   */
  public async assignToTest(
    testId: string,
    participant: AbTestParticipant,
    organizationId: string
  ): Promise<AbTestAssignment> {
    try {
      // Generate unique identifier for the participant
      const participantId = this.generateParticipantId(participant);
      const cacheKey = `${testId}:${participantId}`;

      // Check if assignment already exists in cache
      const cachedAssignment = this.assignmentCache.get(cacheKey);
      if (cachedAssignment) {
        this.logger.debug("A/B test assignment cache hit", {
          testId,
          participantId,
          variant: cachedAssignment.variant,
        });
        return cachedAssignment;
      }

      // Get A/B test configuration
      const abTest = await this.dataService.getAbTestById(testId, organizationId);
      if (!abTest) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      // Check if test is active
      if (abTest.status !== 'active') {
        throw new Error(`A/B test is not active: ${testId}`);
      }

      // Determine variant assignment
      const variant = this.determineVariant(testId, participantId, abTest.traffic_split || this.defaultTrafficSplit);

      // Create assignment record
      const assignment: AbTestAssignment = {
        testId,
        variant,
        assignmentId: this.generateAssignmentId(),
        assignedAt: new Date().toISOString(),
        userId: participant.userId,
        sessionId: participant.sessionId,
      };

      // Store assignment in database
      await this.storeAssignment(assignment, participant, organizationId);

      // Cache assignment
      this.assignmentCache.set(cacheKey, assignment);

      this.logger.info("A/B test assignment created", {
        testId,
        variant,
        participantId,
        assignmentId: assignment.assignmentId,
      });

      return assignment;
    } catch (error) {
      this.logger.error("Error assigning to A/B test", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get existing assignment for a participant
   */
  public async getAssignment(
    testId: string,
    participant: AbTestParticipant,
    organizationId: string
  ): Promise<AbTestAssignment | null> {
    try {
      const participantId = this.generateParticipantId(participant);
      const cacheKey = `${testId}:${participantId}`;

      // Check cache first
      const cachedAssignment = this.assignmentCache.get(cacheKey);
      if (cachedAssignment) {
        return cachedAssignment;
      }

      // Query database for existing assignment
      const assignment = await this.queryAssignment(testId, participantId, organizationId);
      
      if (assignment) {
        // Cache the assignment
        this.assignmentCache.set(cacheKey, assignment);
      }

      return assignment;
    } catch (error) {
      this.logger.error("Error getting A/B test assignment", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Track an event for A/B test analysis
   */
  public async trackEvent(
    testId: string,
    assignmentId: string,
    eventType: 'impression' | 'click' | 'conversion',
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      const eventRecord = {
        test_id: testId,
        assignment_id: assignmentId,
        event_type: eventType,
        event_data: eventData || {},
        tracked_at: new Date().toISOString(),
      };

      await this.storeEvent(eventRecord);

      this.logger.debug("A/B test event tracked", {
        testId,
        assignmentId,
        eventType,
      });
    } catch (error) {
      this.logger.error("Error tracking A/B test event", {
        testId,
        assignmentId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw error for tracking failures
    }
  }

  /**
   * Calculate A/B test results and statistical significance
   */
  public async calculateResults(testId: string, organizationId: string): Promise<AbTestResult> {
    try {
      this.logger.info("Calculating A/B test results", { testId });

      // Get test data
      const abTest = await this.dataService.getAbTestById(testId, organizationId);
      if (!abTest) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      // Get metrics for both variants
      const controlMetrics = await this.calculateVariantMetrics(testId, 'control');
      const variantMetrics = await this.calculateVariantMetrics(testId, 'variant');

      // Calculate statistical significance
      const statisticalResult = this.calculateStatisticalSignificance(controlMetrics, variantMetrics);

      // Determine recommendation
      const recommendation = this.determineRecommendation(controlMetrics, variantMetrics, statisticalResult);

      const result: AbTestResult = {
        testId,
        controlMetrics,
        variantMetrics,
        statisticalSignificance: statisticalResult,
        recommendation,
        confidence: this.confidenceLevel,
      };

      this.logger.info("A/B test results calculated", {
        testId,
        recommendation,
        isSignificant: statisticalResult.isSignificant,
        controlCTR: controlMetrics.clickThroughRate,
        variantCTR: variantMetrics.clickThroughRate,
      });

      return result;
    } catch (error) {
      this.logger.error("Error calculating A/B test results", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Determine which variant to assign based on traffic split
   */
  private determineVariant(testId: string, participantId: string, trafficSplit: number): 'control' | 'variant' {
    // Use consistent hashing to ensure same participant always gets same variant
    const hash = this.hashParticipant(testId + participantId);
    const percentage = hash % 100;
    
    return percentage < trafficSplit ? 'variant' : 'control';
  }

  /**
   * Generate unique participant ID
   */
  private generateParticipantId(participant: AbTestParticipant): string {
    // Prefer userId, fallback to sessionId, then generate from other data
    if (participant.userId) {
      return `user:${participant.userId}`;
    }
    
    if (participant.sessionId) {
      return `session:${participant.sessionId}`;
    }

    // Generate ID from available data
    const data = [
      participant.userAgent || '',
      participant.ipAddress || '',
      participant.country || '',
    ].join('|');
    
    const hash = createHash('md5').update(data).digest('hex');
    return `anonymous:${hash}`;
  }

  /**
   * Generate unique assignment ID
   */
  private generateAssignmentId(): string {
    return createHash('md5')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex');
  }

  /**
   * Hash participant for consistent assignment
   */
  private hashParticipant(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Store assignment in database
   */
  private async storeAssignment(
    assignment: AbTestAssignment,
    participant: AbTestParticipant,
    organizationId: string
  ): Promise<void> {
    // TODO: Implement database storage for assignments
    // This would typically insert into an ab_test_assignments table
    this.logger.debug("Storing A/B test assignment", {
      assignmentId: assignment.assignmentId,
      testId: assignment.testId,
      variant: assignment.variant,
    });
  }

  /**
   * Query existing assignment from database
   */
  private async queryAssignment(
    testId: string,
    participantId: string,
    organizationId: string
  ): Promise<AbTestAssignment | null> {
    // TODO: Implement database query for existing assignments
    // This would typically query the ab_test_assignments table
    return null;
  }

  /**
   * Store event in database
   */
  private async storeEvent(eventRecord: Record<string, any>): Promise<void> {
    // TODO: Implement database storage for events
    // This would typically insert into an ab_test_events table
    this.logger.debug("Storing A/B test event", {
      testId: eventRecord.test_id,
      eventType: eventRecord.event_type,
    });
  }

  /**
   * Calculate metrics for a specific variant
   */
  private async calculateVariantMetrics(testId: string, variant: 'control' | 'variant'): Promise<VariantMetrics> {
    // TODO: Implement actual metrics calculation from database
    // This would typically aggregate data from ab_test_events table
    
    // Mock data for now
    const mockMetrics: VariantMetrics = {
      impressions: variant === 'control' ? 1000 : 950,
      clicks: variant === 'control' ? 50 : 60,
      conversions: variant === 'control' ? 10 : 15,
      clickThroughRate: variant === 'control' ? 0.05 : 0.063,
      conversionRate: variant === 'control' ? 0.01 : 0.016,
      revenue: variant === 'control' ? 1000 : 1500,
      averageOrderValue: variant === 'control' ? 100 : 100,
    };

    return mockMetrics;
  }

  /**
   * Calculate statistical significance using Z-test for proportions
   */
  private calculateStatisticalSignificance(
    controlMetrics: VariantMetrics,
    variantMetrics: VariantMetrics
  ): StatisticalResult {
    // Calculate conversion rates
    const p1 = controlMetrics.conversionRate;
    const p2 = variantMetrics.conversionRate;
    const n1 = controlMetrics.impressions;
    const n2 = variantMetrics.impressions;

    // Check minimum sample size
    if (n1 < this.minSampleSize || n2 < this.minSampleSize) {
      return {
        isSignificant: false,
        pValue: 1,
        confidenceInterval: { lower: 0, upper: 0 },
        effect: 0,
        sampleSize: n1 + n2,
      };
    }

    // Calculate pooled proportion
    const pooledP = ((p1 * n1) + (p2 * n2)) / (n1 + n2);
    
    // Calculate standard error
    const se = Math.sqrt(pooledP * (1 - pooledP) * ((1 / n1) + (1 / n2)));
    
    // Calculate Z-score
    const zScore = (p2 - p1) / se;
    
    // Calculate p-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    // Check significance
    const alpha = 1 - this.confidenceLevel;
    const isSignificant = pValue < alpha;
    
    // Calculate confidence interval for the difference
    const criticalValue = this.getZCritical(this.confidenceLevel);
    const marginOfError = criticalValue * se;
    const difference = p2 - p1;
    
    return {
      isSignificant,
      pValue,
      confidenceInterval: {
        lower: difference - marginOfError,
        upper: difference + marginOfError,
      },
      effect: difference,
      sampleSize: n1 + n2,
    };
  }

  /**
   * Determine recommendation based on results
   */
  private determineRecommendation(
    controlMetrics: VariantMetrics,
    variantMetrics: VariantMetrics,
    statisticalResult: StatisticalResult
  ): 'control' | 'variant' | 'inconclusive' {
    if (!statisticalResult.isSignificant) {
      return 'inconclusive';
    }

    // Compare conversion rates
    if (variantMetrics.conversionRate > controlMetrics.conversionRate) {
      return 'variant';
    } else {
      return 'control';
    }
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(x: number): number {
    // Approximation using error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Get critical Z-value for given confidence level
   */
  private getZCritical(confidenceLevel: number): number {
    const alpha = 1 - confidenceLevel;
    
    // Common critical values
    const criticalValues: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    return criticalValues[confidenceLevel] || 1.96;
  }

  /**
   * Get A/B test performance summary
   */
  public async getTestSummary(testId: string, organizationId: string): Promise<Record<string, any>> {
    try {
      const abTest = await this.dataService.getAbTestById(testId, organizationId);
      if (!abTest) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      const results = await this.calculateResults(testId, organizationId);
      
      return {
        test: {
          id: abTest.id,
          name: abTest.name,
          status: abTest.status,
          trafficSplit: abTest.traffic_split,
          startedAt: abTest.started_at,
          endedAt: abTest.ended_at,
        },
        results: {
          recommendation: results.recommendation,
          isSignificant: results.statisticalSignificance.isSignificant,
          pValue: results.statisticalSignificance.pValue,
          effect: results.statisticalSignificance.effect,
          sampleSize: results.statisticalSignificance.sampleSize,
        },
        metrics: {
          control: results.controlMetrics,
          variant: results.variantMetrics,
        },
      };
    } catch (error) {
      this.logger.error("Error getting A/B test summary", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if A/B test has reached statistical significance
   */
  public async hasReachedSignificance(testId: string, organizationId: string): Promise<boolean> {
    try {
      const results = await this.calculateResults(testId, organizationId);
      return results.statisticalSignificance.isSignificant;
    } catch (error) {
      this.logger.error("Error checking statistical significance", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get recommended sample size for desired effect and power
   */
  public calculateRequiredSampleSize(
    baselineConversionRate: number,
    minimumDetectableEffect: number,
    power: number = 0.8
  ): number {
    // Simplified sample size calculation for two-proportion test
    const alpha = 1 - this.confidenceLevel;
    const beta = 1 - power;
    
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);
    
    const p1 = baselineConversionRate;
    const p2 = baselineConversionRate * (1 + minimumDetectableEffect);
    
    const pooledP = (p1 + p2) / 2;
    const numerator = Math.pow(zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
    const denominator = Math.pow(p2 - p1, 2);
    
    return Math.ceil(numerator / denominator);
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.assignmentCache.clear();
    this.logger.info("A/B testing service cleanup completed");
  }
} 