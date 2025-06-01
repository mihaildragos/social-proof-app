import { EventEmitter } from "events";
import { ClickHouseService } from "./clickhouse-service";
import { prisma } from "../lib/prisma";
import type { AnalyticsEvent, AnalyticsFunnel, AnalyticsReport } from "../generated/client";

export interface EventData {
  siteId?: string;
  eventType: string;
  eventName?: string;
  userId?: string;
  sessionId?: string;
  properties?: any;
  timestamp?: Date;
  source?: string;
  campaign?: string;
  medium?: string;
}

export interface FunnelData {
  organizationId: string;
  name: string;
  description?: string;
  steps: any[];
}

export interface ReportData {
  organizationId: string;
  name: string;
  description?: string;
  config: any;
  type?: string;
  isPublic?: boolean;
}

export interface DashboardOptions {
  timeRange?: string;
  startDate?: Date;
  endDate?: Date;
  granularity?: string;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  type?: string;
  includePublic?: boolean;
}

export class AnalyticsService extends EventEmitter {
  private clickhouseService: ClickHouseService;
  private logger: any;

  constructor() {
    super();
    this.clickhouseService = new ClickHouseService();
    this.logger = console;
  }

  // Event Collection Methods
  async recordEvent(organizationId: string, eventData: EventData): Promise<AnalyticsEvent> {
    try {
      const event = await prisma.analyticsEvent.create({
        data: {
          organizationId,
          siteId: eventData.siteId,
          eventType: eventData.eventType,
          eventName: eventData.eventName,
          userId: eventData.userId,
          sessionId: eventData.sessionId,
          properties: eventData.properties || {},
          source: eventData.source,
          campaign: eventData.campaign,
          medium: eventData.medium,
          timestamp: eventData.timestamp || new Date(),
        },
      });

      this.emit("event:recorded", event);
      return event;
    } catch (error) {
      this.logger.error('Error recording event:', error);
      throw error;
    }
  }

  async recordBatchEvents(organizationId: string, events: EventData[]): Promise<AnalyticsEvent[]> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const createdEvents: AnalyticsEvent[] = [];
        
        for (const eventData of events) {
          const event = await tx.analyticsEvent.create({
            data: {
              organizationId,
              siteId: eventData.siteId,
              eventType: eventData.eventType,
              eventName: eventData.eventName,
              userId: eventData.userId,
              sessionId: eventData.sessionId,
              properties: eventData.properties || {},
              source: eventData.source,
              campaign: eventData.campaign,
              medium: eventData.medium,
              timestamp: eventData.timestamp || new Date(),
            },
          });
          createdEvents.push(event);
        }
        
        return createdEvents;
      });

      this.emit("events:batch_recorded", { organizationId, count: result.length });
      return result;
    } catch (error) {
      this.logger.error('Error recording batch events:', error);
      throw error;
    }
  }

  // Dashboard Methods
  async getDashboardData(organizationId: string, options: DashboardOptions = {}): Promise<any> {
    try {
      const timeRange = this.parseTimeRange(options.timeRange || "24h");
      
      // Get basic metrics
      const [totalEvents, uniqueUsers, sessions] = await Promise.all([
        prisma.analyticsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
            },
          },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
            },
            userId: {
              not: null,
            },
          },
          select: {
            userId: true,
          },
          distinct: ['userId'],
        }),
        prisma.analyticsEvent.findMany({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
            },
            sessionId: {
              not: null,
            },
          },
          select: {
            sessionId: true,
          },
          distinct: ['sessionId'],
        }),
      ]);

      // Get time series data using raw query for better performance
      const timeSeriesResult = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('hour', "createdAt") as time_bucket,
          COUNT(*) as events,
          COUNT(DISTINCT "userId") as users
        FROM "analytics_events" 
        WHERE "organizationId" = ${organizationId}
        AND "createdAt" >= ${timeRange.start}
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;

      return {
        metrics: {
          total_events: totalEvents,
          unique_users: uniqueUsers.length,
          sessions: sessions.length,
          avg_page_views: 0, // Placeholder for page view calculation
        },
        timeSeries: timeSeriesResult,
        period: timeRange,
      };
    } catch (error) {
      this.logger.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  async getCustomDashboardData(organizationId: string, options: DashboardOptions): Promise<any> {
    try {
      return await this.getDashboardData(organizationId, options);
    } catch (error) {
      this.logger.error('Error getting custom dashboard data:', error);
      throw error;
    }
  }

  async getRealtimeMetrics(organizationId: string, options?: any): Promise<any> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

      const [eventsLastMinute, activeUsers, activeSessions] = await Promise.all([
        prisma.analyticsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: oneMinuteAgo,
            },
          },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            organizationId,
            createdAt: {
              gte: oneMinuteAgo,
            },
            userId: {
              not: null,
            },
          },
          select: {
            userId: true,
          },
          distinct: ['userId'],
        }),
        prisma.analyticsEvent.findMany({
          where: {
            organizationId,
            createdAt: {
              gte: oneMinuteAgo,
            },
            sessionId: {
              not: null,
            },
          },
          select: {
            sessionId: true,
          },
          distinct: ['sessionId'],
        }),
      ]);

      return {
        events_last_minute: eventsLastMinute,
        active_users: activeUsers.length,
        active_sessions: activeSessions.length,
      };
    } catch (error) {
      this.logger.error('Error getting realtime metrics:', error);
      throw error;
    }
  }

  // Funnel Methods
  async createFunnel(funnelData: FunnelData): Promise<AnalyticsFunnel> {
    try {
      const funnel = await prisma.analyticsFunnel.create({
        data: {
          organizationId: funnelData.organizationId,
          name: funnelData.name,
          description: funnelData.description,
          steps: funnelData.steps,
        },
      });

      this.emit("funnel:created", funnel);
      return funnel;
    } catch (error) {
      this.logger.error('Error creating funnel:', error);
      throw error;
    }
  }

  async getFunnels(organizationId: string, options: ListOptions = {}): Promise<AnalyticsFunnel[]> {
    try {
      const where: any = { organizationId };
      
      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const funnels = await prisma.analyticsFunnel.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return funnels;
    } catch (error) {
      this.logger.error('Error getting funnels:', error);
      throw error;
    }
  }

  async getFunnelById(organizationId: string, funnelId: string): Promise<AnalyticsFunnel | null> {
    try {
      const funnel = await prisma.analyticsFunnel.findFirst({
        where: {
          id: funnelId,
          organizationId,
        },
      });

      return funnel;
    } catch (error) {
      this.logger.error('Error getting funnel by id:', error);
      throw error;
    }
  }

  async updateFunnel(organizationId: string, funnelId: string, updateData: Partial<FunnelData>): Promise<AnalyticsFunnel | null> {
    try {
      const funnel = await prisma.analyticsFunnel.update({
        where: {
          id: funnelId,
          organizationId,
        },
        data: {
          name: updateData.name,
          description: updateData.description,
          steps: updateData.steps,
        },
      });

      this.emit('funnel:updated', { organizationId, funnelId, funnel });
      return funnel;
    } catch (error) {
      this.logger.error('Error updating funnel:', error);
      return null;
    }
  }

  async deleteFunnel(organizationId: string, funnelId: string): Promise<boolean> {
    try {
      await prisma.analyticsFunnel.delete({
        where: {
          id: funnelId,
          organizationId,
        },
      });

      this.emit('funnel:deleted', { organizationId, funnelId });
      return true;
    } catch (error) {
      this.logger.error('Error deleting funnel:', error);
      return false;
    }
  }

  async getFunnelAnalysis(organizationId: string, funnelId: string, options: any = {}): Promise<any> {
    try {
      // Get funnel configuration
      const funnel = await this.getFunnelById(organizationId, funnelId);
      
      if (!funnel) {
        throw new Error('Funnel not found');
      }
      
      const steps = Array.isArray(funnel.steps) ? funnel.steps : JSON.parse(funnel.steps as any);
      
      // Use ClickHouse for funnel analysis
      const funnelAnalysis = await this.clickhouseService.getConversionFunnel(organizationId, steps, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId,
        windowHours: options.windowHours || 24
      });
      
      return {
        funnel_id: funnelId,
        funnel_name: funnel.name,
        ...funnelAnalysis
      };
    } catch (error) {
      this.logger.error('Error getting funnel analysis:', error);
      return { steps: [], conversion_rate: 0, total_users: 0 };
    }
  }

  // Report Methods
  async createReport(reportData: ReportData): Promise<AnalyticsReport> {
    try {
      const report = await prisma.analyticsReport.create({
        data: {
          organizationId: reportData.organizationId,
          name: reportData.name,
          description: reportData.description,
          config: reportData.config,
          type: reportData.type,
          isPublic: reportData.isPublic || false,
        },
      });

      this.emit("report:created", report);
      return report;
    } catch (error) {
      this.logger.error('Error creating report:', error);
      throw error;
    }
  }

  async getReports(organizationId: string, options: ListOptions = {}): Promise<AnalyticsReport[]> {
    try {
      const where: any = { organizationId };
      
      if (options.type) {
        where.type = options.type;
      }

      const reports = await prisma.analyticsReport.findMany({
        where,
        include: {
          schedules: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return reports;
    } catch (error) {
      this.logger.error('Error getting reports:', error);
      throw error;
    }
  }

  async getReportById(organizationId: string, reportId: string): Promise<AnalyticsReport | null> {
    try {
      const report = await prisma.analyticsReport.findFirst({
        where: {
          id: reportId,
          organizationId,
        },
        include: {
          schedules: true,
        },
      });

      return report;
    } catch (error) {
      this.logger.error('Error getting report by id:', error);
      throw error;
    }
  }

  // Cohort Methods
  async getAcquisitionCohorts(organizationId: string, options: any): Promise<any> {
    try {
      // Method not yet implemented - placeholder
      return {
        cohorts: [],
        summary: this.calculateCohortSummary([]),
        retentionRates: this.calculateRetentionRates([]),
      };
    } catch (error) {
      this.logger.error('Error getting acquisition cohorts:', error);
      throw error;
    }
  }

  async getBehavioralCohorts(organizationId: string, options: any = {}): Promise<any> {
    try {
      // Method not yet implemented - placeholder
      return { cohorts: [], periods: [] };
    } catch (error) {
      this.logger.error('Error getting behavioral cohorts:', error);
      return { cohorts: [], periods: [] };
    }
  }

  async getRevenueCohorts(organizationId: string, options: any = {}): Promise<any> {
    try {
      // Method not yet implemented - placeholder
      return { cohorts: [], periods: [] };
    } catch (error) {
      this.logger.error('Error getting revenue cohorts:', error);
      return { cohorts: [], periods: [] };
    }
  }

  // Analytics Methods using ClickHouse for performance
  async getTopEvents(organizationId: string, options: any = {}): Promise<any[]> {
    try {
      // Use ClickHouse for fast aggregation queries
      return await this.clickhouseService.getTopEvents(organizationId, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId,
        limit: options.limit || 20
      });
    } catch (error) {
      this.logger.error('Error getting top events:', error);
      // Return empty array as fallback
      return [];
    }
  }

  async getUserActivity(organizationId: string, options: any = {}): Promise<any> {
    try {
      if (!options.userId) {
        throw new Error('userId is required for user activity analysis');
      }
      
      // Method not yet implemented - placeholder
      return {
        total_events: 0,
        total_sessions: 0,
        first_seen: null,
        last_seen: null,
        unique_events: 0,
        timeline: []
      };
    } catch (error) {
      this.logger.error('Error getting user activity:', error);
      return {
        total_events: 0,
        total_sessions: 0,
        first_seen: null,
        last_seen: null,
        unique_events: 0,
        timeline: []
      };
    }
  }

  async getConversions(organizationId: string, options: any = {}): Promise<any[]> {
    try {
      // Get conversion events (events marked as conversions)
      // Method not yet implemented - placeholder
      return [];
    } catch (error) {
      this.logger.error('Error getting conversions:', error);
      return [];
    }
  }

  async getTrafficSources(organizationId: string, options: any = {}): Promise<any[]> {
    try {
      // Method not yet implemented - placeholder
      return [];
    } catch (error) {
      this.logger.error('Error getting traffic sources:', error);
      return [];
    }
  }

  async getDeviceStats(organizationId: string, options: any = {}): Promise<any> {
    try {
      // Use ClickHouse for fast device analytics
      return await this.clickhouseService.getDeviceAnalytics(organizationId, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId
      });
    } catch (error) {
      this.logger.error('Error getting device stats:', error);
      // Return empty stats as fallback
      return {
        desktop: 0,
        mobile: 0,
        tablet: 0,
        browsers: [],
        operating_systems: []
      };
    }
  }

  async getGeographicData(organizationId: string, options: any = {}): Promise<any[]> {
    try {
      // Use ClickHouse for geographic analytics
      return await this.clickhouseService.getGeographicData(organizationId, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId,
        groupBy: options.groupBy || 'country'
      });
    } catch (error) {
      this.logger.error('Error getting geographic data:', error);
      return [];
    }
  }

  async getPerformanceMetrics(organizationId: string, options: any = {}): Promise<any> {
    try {
      // Use ClickHouse for performance analytics
      return await this.clickhouseService.getPerformanceMetrics(organizationId, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId
      });
    } catch (error) {
      this.logger.error('Error getting performance metrics:', error);
      return {
        avg_page_load_time: 0,
        p95_page_load_time: 0,
        avg_ttfb: 0,
        avg_dom_ready: 0,
        page_views: 0,
        errors: 0,
        unique_users: 0,
        error_rate: 0
      };
    }
  }

  // Helper Methods
  private parseTimeRange(timeRange: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    switch (timeRange) {
      case "1h":
        start.setHours(start.getHours() - 1);
        break;
      case "24h":
        start.setDate(start.getDate() - 1);
        break;
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }
    
    return { start, end };
  }

  private calculateCohortSummary(cohortData: any[]): any {
    // Implementation for cohort summary calculation
    return {
      totalCohorts: cohortData.length,
      averageRetention: 0.75, // Placeholder
      bestPerformingCohort: cohortData[0],
    };
  }

  private calculateRetentionRates(cohortData: any[]): any[] {
    // Implementation for retention rate calculation
    return cohortData.map(cohort => ({
      ...cohort,
      retentionRate: Math.random() * 0.5 + 0.25, // Placeholder
    }));
  }

  // Placeholder methods for remaining functionality
  async getFunnelTrends(organizationId: string, funnelId: string, options: any): Promise<any[]> {
    return [];
  }

  async getFunnelSegments(organizationId: string, funnelId: string, options: any): Promise<any[]> {
    return [];
  }

  async getFunnelUserPaths(organizationId: string, funnelId: string, options: any): Promise<any[]> {
    return [];
  }

  async cloneFunnel(organizationId: string, funnelId: string, options: any): Promise<any> {
    return null;
  }

  async getRetentionCurves(organizationId: string, options: any): Promise<any> {
    return {};
  }

  async getCohortSizeTrends(organizationId: string, options: any): Promise<any> {
    return {};
  }

  async compareCohorts(organizationId: string, options: any): Promise<any> {
    return {};
  }

  async getCohortSegments(organizationId: string, options: any): Promise<any[]> {
    return [];
  }

  async getCohortUsers(organizationId: string, cohortId: string, options: any): Promise<any[]> {
    return [];
  }

  async exportCohortData(organizationId: string, options: any): Promise<any> {
    return "";
  }

  async updateReport(organizationId: string, reportId: string, updateData: any): Promise<any> {
    return null;
  }

  async deleteReport(organizationId: string, reportId: string): Promise<boolean> {
    return false;
  }

  async generateReport(organizationId: string, reportId: string, options: any): Promise<any> {
    return {};
  }

  async getReportHistory(organizationId: string, reportId: string, options: any): Promise<any[]> {
    return [];
  }

  async downloadReportFile(organizationId: string, reportId: string, fileId: string): Promise<any> {
    return null;
  }

  async scheduleReport(organizationId: string, reportId: string, scheduleData: any): Promise<any> {
    try {
      // Method not yet implemented - placeholder
      return {
        id: 'schedule-123',
        organizationId,
        reportId,
        frequency: scheduleData.frequency || 'weekly',
        recipients: scheduleData.recipients || [],
        format: scheduleData.format || 'pdf',
        enabled: scheduleData.enabled !== false,
        timezone: scheduleData.timezone || 'UTC',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Error scheduling report:', error);
      throw error;
    }
  }

  async cloneReport(organizationId: string, reportId: string, options: any): Promise<any> {
    return null;
  }

  async shareReport(organizationId: string, reportId: string, shareData: any): Promise<any> {
    return null;
  }

  async getSharedReport(shareId: string): Promise<any> {
    return null;
  }

  async getReportTemplates(options: any): Promise<any[]> {
    return [];
  }

  async createReportFromTemplate(organizationId: string, templateId: string, options: any): Promise<any> {
    return null;
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
    await this.clickhouseService.close();
  }
}