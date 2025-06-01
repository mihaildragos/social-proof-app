import { EventEmitter } from "events";
import { Pool } from "pg";
import { TimescaleService } from "./timescale-service";
import { ClickHouseService } from "./clickhouse-service";

export class AnalyticsService extends EventEmitter {
  private db: Pool;
  private timescaleService: TimescaleService;
  private clickhouseService: ClickHouseService;
  private logger: any;

  constructor() {
    super();
    this.db = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "analytics",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.timescaleService = new TimescaleService();
    this.clickhouseService = new ClickHouseService();
    this.logger = console;
  }

  // Event Collection Methods
  async recordEvent(organizationId: string, eventData: any): Promise<any> {
    try {
      const eventRecord = {
        organization_id: organizationId,
        site_id: eventData.siteId,
        event_type: eventData.eventType,
        event_name: eventData.eventName,
        user_id: eventData.userId,
        session_id: eventData.sessionId,
        properties: eventData.properties || {},
        timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
        country: eventData.country,
        region: eventData.region,
        city: eventData.city,
        device_type: eventData.deviceType,
        browser: eventData.browser,
        os: eventData.os
      };

      // Store in both TimescaleDB and ClickHouse in parallel for redundancy and different query patterns
      const [timescaleResult, clickhouseResult] = await Promise.allSettled([
        this.timescaleService.insertEvent(eventRecord),
        this.clickhouseService.insertEvents([eventRecord])
      ]);

      if (timescaleResult.status === 'rejected') {
        this.logger.warn('TimescaleDB insert failed:', timescaleResult.reason);
      }

      if (clickhouseResult.status === 'rejected') {
        this.logger.warn('ClickHouse insert failed:', clickhouseResult.reason);
      }

      // Also store in PostgreSQL for immediate consistency
      const client = await this.db.connect();
      try {
        const query = `
          INSERT INTO analytics_events (
            organization_id, site_id, event_type, event_name, user_id, session_id,
            properties, timestamp, source, campaign, medium, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING *
        `;
        
        const values = [
          organizationId,
          eventData.siteId,
          eventData.eventType,
          eventData.eventName,
          eventData.userId,
          eventData.sessionId,
          JSON.stringify(eventData.properties || {}),
          eventRecord.timestamp,
          eventData.source,
          eventData.campaign,
          eventData.medium,
        ];

        const result = await client.query(query, values);
        this.emit("event:recorded", result.rows[0]);
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Error recording event:', error);
      throw error;
    }
  }

  async recordBatchEvents(organizationId: string, events: any[]): Promise<any[]> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      
      const results = [];
      for (const eventData of events) {
        const query = `
          INSERT INTO analytics_events (
            organization_id, event_type, event_name, user_id, session_id,
            properties, timestamp, source, campaign, medium, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          RETURNING *
        `;
        
        const values = [
          organizationId,
          eventData.eventType,
          eventData.eventName,
          eventData.userId,
          eventData.sessionId,
          JSON.stringify(eventData.properties || {}),
          eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
          eventData.source,
          eventData.campaign,
          eventData.medium,
        ];

        const result = await client.query(query, values);
        results.push(result.rows[0]);
      }
      
      await client.query("COMMIT");
      this.emit("events:batch_recorded", { organizationId, count: results.length });
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Dashboard Methods
  async getDashboardData(organizationId: string, options: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const timeRange = this.parseTimeRange(options.timeRange || "24h");
      
      // Get basic metrics
      const metricsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as sessions,
          AVG(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as avg_page_views
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2
      `;
      
      const metricsResult = await client.query(metricsQuery, [organizationId, timeRange.start]);
      
      // Get time series data
      const timeSeriesQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as time_bucket,
          COUNT(*) as events,
          COUNT(DISTINCT user_id) as users
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;
      
      const timeSeriesResult = await client.query(timeSeriesQuery, [organizationId, timeRange.start]);
      
      return {
        metrics: metricsResult.rows[0],
        timeSeries: timeSeriesResult.rows,
        period: timeRange,
      };
    } finally {
      client.release();
    }
  }

  async getCustomDashboardData(organizationId: string, options: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, granularity = "hour" } = options;
      
      const query = `
        SELECT 
          DATE_TRUNC($3, created_at) as time_bucket,
          COUNT(*) as events,
          COUNT(DISTINCT user_id) as users,
          COUNT(DISTINCT session_id) as sessions
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2 
        AND created_at <= $4
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;
      
      const result = await client.query(query, [organizationId, startDate, granularity, endDate]);
      
      return {
        data: result.rows,
        period: { startDate, endDate },
        granularity,
      };
    } finally {
      client.release();
    }
  }

  async getRealtimeMetrics(organizationId: string, options: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as events_last_minute,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(DISTINCT session_id) as active_sessions
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= NOW() - INTERVAL '1 minute'
      `;
      
      const result = await client.query(query, [organizationId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Funnel Methods
  async createFunnel(funnelData: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO analytics_funnels (
          organization_id, name, description, steps, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const values = [
        funnelData.organizationId,
        funnelData.name,
        funnelData.description,
        JSON.stringify(funnelData.steps),
      ];

      const result = await client.query(query, values);
      this.emit("funnel:created", result.rows[0]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getFunnels(organizationId: string, options: any): Promise<any[]> {
    const client = await this.db.connect();
    try {
      let query = `
        SELECT * FROM analytics_funnels 
        WHERE organization_id = $1
      `;
      const values = [organizationId];
      
      if (options.isActive !== undefined) {
        query += ` AND is_active = $${values.length + 1}`;
        values.push(options.isActive);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(options.limit, options.offset);
      
      const result = await client.query(query, values);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getFunnelById(organizationId: string, funnelId: string): Promise<any> {
    const client = await this.db.connect();
    try {
      const query = `
        SELECT * FROM analytics_funnels 
        WHERE organization_id = $1 AND id = $2
      `;
      
      const result = await client.query(query, [organizationId, funnelId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Cohort Methods
  async getAcquisitionCohorts(organizationId: string, options: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const { cohortPeriod = "week", retentionPeriods = 12 } = options;
      
      const query = `
        WITH cohort_data AS (
          SELECT 
            user_id,
            DATE_TRUNC($2, MIN(created_at)) as cohort_date,
            MIN(created_at) as first_event
          FROM analytics_events 
          WHERE organization_id = $1
          GROUP BY user_id
        ),
        retention_data AS (
          SELECT 
            cd.cohort_date,
            cd.user_id,
            EXTRACT(EPOCH FROM (ae.created_at - cd.first_event)) / (24 * 3600) as days_since_first
          FROM cohort_data cd
          JOIN analytics_events ae ON cd.user_id = ae.user_id
          WHERE ae.organization_id = $1
        )
        SELECT 
          cohort_date,
          COUNT(DISTINCT user_id) as cohort_size,
          FLOOR(days_since_first / 7) as week_number,
          COUNT(DISTINCT user_id) as retained_users
        FROM retention_data
        WHERE FLOOR(days_since_first / 7) <= $3
        GROUP BY cohort_date, week_number
        ORDER BY cohort_date, week_number
      `;
      
      const result = await client.query(query, [organizationId, cohortPeriod, retentionPeriods]);
      
      return {
        cohorts: result.rows,
        summary: this.calculateCohortSummary(result.rows),
        retentionRates: this.calculateRetentionRates(result.rows),
      };
    } finally {
      client.release();
    }
  }

  // Report Methods
  async createReport(reportData: any): Promise<any> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO analytics_reports (
          organization_id, name, description, config, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const values = [
        reportData.organizationId,
        reportData.name,
        reportData.description,
        JSON.stringify(reportData.config),
      ];

      const result = await client.query(query, values);
      this.emit("report:created", result.rows[0]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getReports(organizationId: string, options: any): Promise<any[]> {
    const client = await this.db.connect();
    try {
      let query = `
        SELECT * FROM analytics_reports 
        WHERE organization_id = $1
      `;
      const values = [organizationId];
      
      if (options.type) {
        query += ` AND type = $${values.length + 1}`;
        values.push(options.type);
      }
      
      if (options.includePublic) {
        query += ` OR is_public = true`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(options.limit, options.offset);
      
      const result = await client.query(query, values);
      return result.rows;
    } finally {
      client.release();
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
      // Fallback to TimescaleDB
      return await this.timescaleService.getTopEvents(organizationId, options);
    }
  }

  async getUserActivity(organizationId: string, options: any = {}): Promise<any> {
    try {
      if (!options.userId) {
        throw new Error('userId is required for user activity analysis');
      }
      
      return await this.timescaleService.getUserActivity(organizationId, options.userId, {
        startDate: options.startDate,
        endDate: options.endDate,
        siteId: options.siteId
      });
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
      const query = `
        SELECT 
          event_name,
          COUNT(*) as conversion_count,
          COUNT(DISTINCT user_id) as unique_conversions,
          AVG(CAST(properties->>'value' AS FLOAT)) as avg_value
        FROM analytics_events
        WHERE organization_id = $1
          AND event_type = 'conversion'
          AND timestamp >= $2
          AND timestamp <= $3
        GROUP BY event_name
        ORDER BY conversion_count DESC
      `;
      
      const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();
      
      const result = await this.db.query(query, [organizationId, startDate, endDate]);
      
      return result.rows.map(row => ({
        event_name: row.event_name,
        conversion_count: parseInt(row.conversion_count),
        unique_conversions: parseInt(row.unique_conversions),
        avg_value: parseFloat(row.avg_value || 0)
      }));
    } catch (error) {
      this.logger.error('Error getting conversions:', error);
      return [];
    }
  }

  async getTrafficSources(organizationId: string, options: any = {}): Promise<any[]> {
    try {
      const query = `
        SELECT 
          source,
          medium,
          campaign,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(*) as total_events
        FROM analytics_events
        WHERE organization_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
          AND source IS NOT NULL
        GROUP BY source, medium, campaign
        ORDER BY unique_users DESC
        LIMIT $4
      `;
      
      const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();
      const limit = options.limit || 20;
      
      const result = await this.db.query(query, [organizationId, startDate, endDate, limit]);
      
      return result.rows.map(row => ({
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        unique_users: parseInt(row.unique_users),
        sessions: parseInt(row.sessions),
        total_events: parseInt(row.total_events)
      }));
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
      // Fallback to TimescaleDB
      return await this.timescaleService.getDeviceStats(organizationId, options);
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

  async updateFunnel(organizationId: string, funnelId: string, updateData: any): Promise<any> {
    try {
      const query = `
        UPDATE analytics_funnels 
        SET 
          name = COALESCE($1, name),
          steps = COALESCE($2, steps),
          description = COALESCE($3, description),
          updated_at = NOW()
        WHERE id = $4 AND organization_id = $5
        RETURNING *
      `;
      
      const result = await this.db.query(query, [
        updateData.name,
        updateData.steps ? JSON.stringify(updateData.steps) : null,
        updateData.description,
        funnelId,
        organizationId
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const updatedFunnel = result.rows[0];
      updatedFunnel.steps = JSON.parse(updatedFunnel.steps);
      
      this.emit('funnel:updated', { organizationId, funnelId, funnel: updatedFunnel });
      
      return updatedFunnel;
    } catch (error) {
      this.logger.error('Error updating funnel:', error);
      throw error;
    }
  }

  async deleteFunnel(organizationId: string, funnelId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM analytics_funnels 
        WHERE id = $1 AND organization_id = $2
      `;
      
      const result = await this.db.query(query, [funnelId, organizationId]);
      
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        this.emit('funnel:deleted', { organizationId, funnelId });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Error deleting funnel:', error);
      return false;
    }
  }

  async getFunnelAnalysis(organizationId: string, funnelId: string, options: any = {}): Promise<any> {
    try {
      // Get funnel configuration
      const funnelQuery = `
        SELECT steps, name FROM analytics_funnels 
        WHERE id = $1 AND organization_id = $2
      `;
      
      const funnelResult = await this.db.query(funnelQuery, [funnelId, organizationId]);
      
      if (funnelResult.rows.length === 0) {
        throw new Error('Funnel not found');
      }
      
      const funnel = funnelResult.rows[0];
      const steps = Array.isArray(funnel.steps) ? funnel.steps : JSON.parse(funnel.steps);
      
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
      // Fallback to TimescaleDB
      try {
        const funnelQuery = `
          SELECT steps FROM analytics_funnels 
          WHERE id = $1 AND organization_id = $2
        `;
        
        const funnelResult = await this.db.query(funnelQuery, [funnelId, organizationId]);
        
        if (funnelResult.rows.length === 0) {
          return { steps: [], conversion_rate: 0, total_users: 0 };
        }
        
        const steps = JSON.parse(funnelResult.rows[0].steps);
        return await this.timescaleService.getFunnelAnalysis(organizationId, steps, options);
      } catch (fallbackError) {
        this.logger.error('Fallback funnel analysis failed:', fallbackError);
        return { steps: [], conversion_rate: 0, total_users: 0 };
      }
    }
  }

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

  async getBehavioralCohorts(organizationId: string, options: any = {}): Promise<any> {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        cohortEvent = 'user_signup',
        returnEvent = 'login',
        periods = [1, 7, 14, 30] // days
      } = options;
      
      const query = `
        WITH cohort_users AS (
          SELECT 
            user_id,
            DATE_TRUNC('week', MIN(timestamp)) as cohort_week
          FROM analytics_events
          WHERE organization_id = $1
            AND event_name = $2
            AND timestamp >= $3
            AND timestamp <= $4
            AND user_id IS NOT NULL
          GROUP BY user_id
        ),
        user_returns AS (
          SELECT 
            e.user_id,
            c.cohort_week,
            e.timestamp as return_time
          FROM analytics_events e
          JOIN cohort_users c ON e.user_id = c.user_id
          WHERE e.organization_id = $1
            AND e.event_name = $5
            AND e.timestamp >= c.cohort_week
        )
        SELECT 
          cohort_week,
          COUNT(DISTINCT cu.user_id) as cohort_size,
          ${periods.map((period, index) => 
            `COUNT(DISTINCT CASE WHEN ur.return_time >= cu.cohort_week + INTERVAL '${period} days' 
             AND ur.return_time < cu.cohort_week + INTERVAL '${period + 1} days' THEN ur.user_id END) as period_${period}_returns`
          ).join(', ')}
        FROM cohort_users cu
        LEFT JOIN user_returns ur ON cu.user_id = ur.user_id AND cu.cohort_week = ur.cohort_week
        GROUP BY cohort_week
        ORDER BY cohort_week
      `;
      
      const result = await this.db.query(query, [
        organizationId, cohortEvent, startDate, endDate, returnEvent
      ]);
      
      const cohorts = result.rows.map(row => {
        const cohort = {
          cohort_week: row.cohort_week,
          cohort_size: parseInt(row.cohort_size),
          periods: {}
        };
        
        periods.forEach(period => {
          const returns = parseInt(row[`period_${period}_returns`] || 0);
          cohort.periods[`day_${period}`] = {
            returns,
            retention_rate: cohort.cohort_size > 0 ? (returns / cohort.cohort_size) * 100 : 0
          };
        });
        
        return cohort;
      });
      
      return {
        cohort_event: cohortEvent,
        return_event: returnEvent,
        periods,
        cohorts
      };
    } catch (error) {
      this.logger.error('Error getting behavioral cohorts:', error);
      return { cohorts: [], periods: [] };
    }
  }

  async getRevenueCohorts(organizationId: string, options: any = {}): Promise<any> {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        cohortEvent = 'user_signup',
        revenueEvent = 'purchase',
        periods = [1, 7, 14, 30] // days
      } = options;
      
      const query = `
        WITH cohort_users AS (
          SELECT 
            user_id,
            DATE_TRUNC('week', MIN(timestamp)) as cohort_week
          FROM analytics_events
          WHERE organization_id = $1
            AND event_name = $2
            AND timestamp >= $3
            AND timestamp <= $4
            AND user_id IS NOT NULL
          GROUP BY user_id
        ),
        user_revenue AS (
          SELECT 
            e.user_id,
            c.cohort_week,
            e.timestamp as purchase_time,
            CAST(e.properties->>'value' AS FLOAT) as revenue
          FROM analytics_events e
          JOIN cohort_users c ON e.user_id = c.user_id
          WHERE e.organization_id = $1
            AND e.event_name = $5
            AND e.timestamp >= c.cohort_week
            AND e.properties->>'value' IS NOT NULL
        )
        SELECT 
          cohort_week,
          COUNT(DISTINCT cu.user_id) as cohort_size,
          ${periods.map((period, index) => 
            `SUM(CASE WHEN ur.purchase_time >= cu.cohort_week + INTERVAL '${period} days' 
             AND ur.purchase_time < cu.cohort_week + INTERVAL '${period + 1} days' THEN ur.revenue ELSE 0 END) as period_${period}_revenue,
             COUNT(DISTINCT CASE WHEN ur.purchase_time >= cu.cohort_week + INTERVAL '${period} days' 
             AND ur.purchase_time < cu.cohort_week + INTERVAL '${period + 1} days' THEN ur.user_id END) as period_${period}_buyers`
          ).join(', ')}
        FROM cohort_users cu
        LEFT JOIN user_revenue ur ON cu.user_id = ur.user_id AND cu.cohort_week = ur.cohort_week
        GROUP BY cohort_week
        ORDER BY cohort_week
      `;
      
      const result = await this.db.query(query, [
        organizationId, cohortEvent, startDate, endDate, revenueEvent
      ]);
      
      const cohorts = result.rows.map(row => {
        const cohort = {
          cohort_week: row.cohort_week,
          cohort_size: parseInt(row.cohort_size),
          periods: {}
        };
        
        periods.forEach(period => {
          const revenue = parseFloat(row[`period_${period}_revenue`] || 0);
          const buyers = parseInt(row[`period_${period}_buyers`] || 0);
          
          cohort.periods[`day_${period}`] = {
            revenue,
            buyers,
            conversion_rate: cohort.cohort_size > 0 ? (buyers / cohort.cohort_size) * 100 : 0,
            revenue_per_user: cohort.cohort_size > 0 ? revenue / cohort.cohort_size : 0,
            avg_order_value: buyers > 0 ? revenue / buyers : 0
          };
        });
        
        return cohort;
      });
      
      return {
        cohort_event: cohortEvent,
        revenue_event: revenueEvent,
        periods,
        cohorts
      };
    } catch (error) {
      this.logger.error('Error getting revenue cohorts:', error);
      return { cohorts: [], periods: [] };
    }
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

  async getReportById(organizationId: string, reportId: string): Promise<any> {
    return null;
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
      const {
        frequency = 'weekly',
        recipients = [],
        format = 'pdf',
        enabled = true,
        timezone = 'UTC'
      } = scheduleData;
      
      const query = `
        INSERT INTO analytics_report_schedules (
          organization_id, report_id, frequency, recipients, format,
          enabled, timezone, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await this.db.query(query, [
        organizationId,
        reportId,
        frequency,
        JSON.stringify(recipients),
        format,
        enabled,
        timezone
      ]);
      
      const schedule = result.rows[0];
      schedule.recipients = JSON.parse(schedule.recipients);
      
      this.emit('report:scheduled', { organizationId, reportId, schedule });
      
      return schedule;
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
    await this.db.end();
    await this.timescaleService.close();
    await this.clickhouseService.close();
  }
} 