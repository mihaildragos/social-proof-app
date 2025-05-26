import { EventEmitter } from "events";
import { Pool } from "pg";

export class AggregationService extends EventEmitter {
  private db: Pool;

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
  }

  /**
   * Aggregate events by time periods
   */
  async aggregateByTimePeriod(
    organizationId: string,
    options: {
      startDate: Date;
      endDate: Date;
      granularity: "minute" | "hour" | "day" | "week" | "month";
      eventTypes?: string[];
      metrics?: string[];
    }
  ): Promise<any[]> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, granularity, eventTypes, metrics } = options;
      
      let eventTypeFilter = "";
      const values = [organizationId, startDate, endDate, granularity];
      
      if (eventTypes && eventTypes.length > 0) {
        eventTypeFilter = ` AND event_type = ANY($${values.length + 1})`;
        values.push(eventTypes);
      }

      const query = `
        SELECT 
          DATE_TRUNC($4, created_at) as time_bucket,
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT event_type) as event_types_count,
          ARRAY_AGG(DISTINCT event_type) as event_types,
          AVG(CASE WHEN properties->>'duration' IS NOT NULL 
              THEN (properties->>'duration')::numeric ELSE NULL END) as avg_duration
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        ${eventTypeFilter}
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;

      const result = await client.query(query, values);
      
      this.emit("aggregation:completed", {
        organizationId,
        type: "time_period",
        granularity,
        recordCount: result.rows.length,
      });

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate events by user segments
   */
  async aggregateByUserSegments(
    organizationId: string,
    options: {
      startDate: Date;
      endDate: Date;
      segmentBy: string[];
      eventTypes?: string[];
    }
  ): Promise<any[]> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, segmentBy, eventTypes } = options;
      
      let eventTypeFilter = "";
      let segmentFields = "";
      const values = [organizationId, startDate, endDate];
      
      if (eventTypes && eventTypes.length > 0) {
        eventTypeFilter = ` AND event_type = ANY($${values.length + 1})`;
        values.push(eventTypes);
      }

      // Build segment fields dynamically
      segmentBy.forEach((segment, index) => {
        if (index > 0) segmentFields += ", ";
        segmentFields += `properties->>'${segment}' as ${segment}`;
      });

      const query = `
        SELECT 
          ${segmentFields},
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          AVG(CASE WHEN properties->>'value' IS NOT NULL 
              THEN (properties->>'value')::numeric ELSE NULL END) as avg_value
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        ${eventTypeFilter}
        GROUP BY ${segmentBy.map(s => `properties->>'${s}'`).join(", ")}
        ORDER BY total_events DESC
      `;

      const result = await client.query(query, values);
      
      this.emit("aggregation:completed", {
        organizationId,
        type: "user_segments",
        segmentBy,
        recordCount: result.rows.length,
      });

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate conversion funnels
   */
  async aggregateConversionFunnels(
    organizationId: string,
    funnelId: string,
    options: {
      startDate: Date;
      endDate: Date;
      granularity?: "day" | "week" | "month";
    }
  ): Promise<any> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, granularity = "day" } = options;

      // Get funnel configuration
      const funnelQuery = `
        SELECT steps FROM analytics_funnels 
        WHERE id = $1 AND organization_id = $2
      `;
      const funnelResult = await client.query(funnelQuery, [funnelId, organizationId]);
      
      if (funnelResult.rows.length === 0) {
        throw new Error("Funnel not found");
      }

      const steps = funnelResult.rows[0].steps;
      
      // Build conversion analysis query
      const conversionQuery = `
        WITH funnel_events AS (
          SELECT 
            user_id,
            session_id,
            event_type,
            event_name,
            created_at,
            DATE_TRUNC($4, created_at) as time_bucket
          FROM analytics_events 
          WHERE organization_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
          AND (event_type, event_name) IN (${steps.map((_: any, i: number) => `($${5 + i * 2}, $${6 + i * 2})`).join(", ")})
        ),
        step_completions AS (
          SELECT 
            time_bucket,
            user_id,
            session_id,
            ARRAY_AGG(DISTINCT event_type || '::' || event_name ORDER BY created_at) as completed_steps
          FROM funnel_events
          GROUP BY time_bucket, user_id, session_id
        )
        SELECT 
          time_bucket,
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT CASE WHEN array_length(completed_steps, 1) >= 1 THEN user_id END) as step_1_users,
          COUNT(DISTINCT CASE WHEN array_length(completed_steps, 1) >= 2 THEN user_id END) as step_2_users,
          COUNT(DISTINCT CASE WHEN array_length(completed_steps, 1) >= 3 THEN user_id END) as step_3_users,
          COUNT(DISTINCT CASE WHEN array_length(completed_steps, 1) = ${steps.length} THEN user_id END) as converted_users
        FROM step_completions
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;

      const values = [organizationId, startDate, endDate, granularity];
      steps.forEach((step: any) => {
        values.push(step.eventType, step.eventName);
      });

      const result = await client.query(conversionQuery, values);
      
      this.emit("aggregation:completed", {
        organizationId,
        type: "conversion_funnel",
        funnelId,
        recordCount: result.rows.length,
      });

      return {
        funnelId,
        steps,
        conversions: result.rows,
        summary: this.calculateFunnelSummary(result.rows),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate user cohorts
   */
  async aggregateUserCohorts(
    organizationId: string,
    options: {
      cohortType: "acquisition" | "behavioral";
      cohortPeriod: "day" | "week" | "month";
      startDate: Date;
      endDate: Date;
      retentionPeriods: number;
    }
  ): Promise<any> {
    const client = await this.db.connect();
    try {
      const { cohortType, cohortPeriod, startDate, endDate, retentionPeriods } = options;

      let cohortQuery = "";
      
      if (cohortType === "acquisition") {
        cohortQuery = `
          WITH user_cohorts AS (
            SELECT 
              user_id,
              DATE_TRUNC($4, MIN(created_at)) as cohort_date
            FROM analytics_events 
            WHERE organization_id = $1 
            AND created_at >= $2 
            AND created_at <= $3
            GROUP BY user_id
          ),
          cohort_activity AS (
            SELECT 
              uc.cohort_date,
              uc.user_id,
              DATE_TRUNC($4, ae.created_at) as activity_period,
              EXTRACT(EPOCH FROM (DATE_TRUNC($4, ae.created_at) - uc.cohort_date)) / 
                CASE $4 
                  WHEN 'day' THEN 86400 
                  WHEN 'week' THEN 604800 
                  WHEN 'month' THEN 2592000 
                END as period_number
            FROM user_cohorts uc
            JOIN analytics_events ae ON uc.user_id = ae.user_id
            WHERE ae.organization_id = $1
            AND ae.created_at >= $2
            AND ae.created_at <= $3
          )
          SELECT 
            cohort_date,
            period_number,
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT CASE WHEN period_number = 0 THEN user_id END) as cohort_size
          FROM cohort_activity
          WHERE period_number <= $5
          GROUP BY cohort_date, period_number
          ORDER BY cohort_date, period_number
        `;
      }

      const result = await client.query(cohortQuery, [
        organizationId,
        startDate,
        endDate,
        cohortPeriod,
        retentionPeriods,
      ]);

      this.emit("aggregation:completed", {
        organizationId,
        type: "user_cohorts",
        cohortType,
        recordCount: result.rows.length,
      });

      return {
        cohortType,
        cohortPeriod,
        cohorts: result.rows,
        retentionRates: this.calculateRetentionRates(result.rows),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate revenue metrics
   */
  async aggregateRevenueMetrics(
    organizationId: string,
    options: {
      startDate: Date;
      endDate: Date;
      granularity: "day" | "week" | "month";
      currency?: string;
    }
  ): Promise<any[]> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, granularity, currency = "USD" } = options;

      const query = `
        SELECT 
          DATE_TRUNC($4, created_at) as time_bucket,
          COUNT(*) as total_transactions,
          COUNT(DISTINCT user_id) as unique_customers,
          SUM(CASE WHEN properties->>'revenue' IS NOT NULL 
              THEN (properties->>'revenue')::numeric ELSE 0 END) as total_revenue,
          AVG(CASE WHEN properties->>'revenue' IS NOT NULL 
              THEN (properties->>'revenue')::numeric ELSE NULL END) as avg_revenue,
          MAX(CASE WHEN properties->>'revenue' IS NOT NULL 
              THEN (properties->>'revenue')::numeric ELSE 0 END) as max_revenue,
          COUNT(CASE WHEN properties->>'currency' = $5 THEN 1 END) as currency_transactions
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND event_type = 'purchase'
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;

      const result = await client.query(query, [
        organizationId,
        startDate,
        endDate,
        granularity,
        currency,
      ]);

      this.emit("aggregation:completed", {
        organizationId,
        type: "revenue_metrics",
        granularity,
        recordCount: result.rows.length,
      });

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate performance metrics
   */
  async aggregatePerformanceMetrics(
    organizationId: string,
    options: {
      startDate: Date;
      endDate: Date;
      granularity: "hour" | "day";
    }
  ): Promise<any[]> {
    const client = await this.db.connect();
    try {
      const { startDate, endDate, granularity } = options;

      const query = `
        SELECT 
          DATE_TRUNC($4, created_at) as time_bucket,
          COUNT(*) as total_events,
          AVG(CASE WHEN properties->>'load_time' IS NOT NULL 
              THEN (properties->>'load_time')::numeric ELSE NULL END) as avg_load_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (
            ORDER BY CASE WHEN properties->>'load_time' IS NOT NULL 
                     THEN (properties->>'load_time')::numeric ELSE NULL END
          ) as p95_load_time,
          COUNT(CASE WHEN event_type = 'error' THEN 1 END) as error_count,
          COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as page_views,
          AVG(CASE WHEN properties->>'bounce_rate' IS NOT NULL 
              THEN (properties->>'bounce_rate')::numeric ELSE NULL END) as avg_bounce_rate
        FROM analytics_events 
        WHERE organization_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        GROUP BY time_bucket
        ORDER BY time_bucket
      `;

      const result = await client.query(query, [
        organizationId,
        startDate,
        endDate,
        granularity,
      ]);

      this.emit("aggregation:completed", {
        organizationId,
        type: "performance_metrics",
        granularity,
        recordCount: result.rows.length,
      });

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Create materialized aggregations for faster queries
   */
  async createMaterializedAggregations(organizationId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      // Create daily aggregations
      const dailyAggQuery = `
        INSERT INTO analytics_daily_aggregations (
          organization_id, date, total_events, unique_users, unique_sessions,
          top_events, avg_session_duration, created_at
        )
        SELECT 
          organization_id,
          DATE(created_at) as date,
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          ARRAY_AGG(DISTINCT event_type ORDER BY COUNT(*) DESC LIMIT 10) as top_events,
          AVG(CASE WHEN properties->>'session_duration' IS NOT NULL 
              THEN (properties->>'session_duration')::numeric ELSE NULL END) as avg_session_duration,
          NOW() as created_at
        FROM analytics_events 
        WHERE organization_id = $1 
        AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
        GROUP BY organization_id, DATE(created_at)
        ON CONFLICT (organization_id, date) DO UPDATE SET
          total_events = EXCLUDED.total_events,
          unique_users = EXCLUDED.unique_users,
          unique_sessions = EXCLUDED.unique_sessions,
          top_events = EXCLUDED.top_events,
          avg_session_duration = EXCLUDED.avg_session_duration,
          updated_at = NOW()
      `;

      await client.query(dailyAggQuery, [organizationId]);

      // Create weekly aggregations
      const weeklyAggQuery = `
        INSERT INTO analytics_weekly_aggregations (
          organization_id, week_start, total_events, unique_users, unique_sessions,
          growth_rate, retention_rate, created_at
        )
        SELECT 
          organization_id,
          DATE_TRUNC('week', created_at) as week_start,
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          0.0 as growth_rate, -- Calculate separately
          0.0 as retention_rate, -- Calculate separately
          NOW() as created_at
        FROM analytics_events 
        WHERE organization_id = $1 
        AND DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')
        GROUP BY organization_id, DATE_TRUNC('week', created_at)
        ON CONFLICT (organization_id, week_start) DO UPDATE SET
          total_events = EXCLUDED.total_events,
          unique_users = EXCLUDED.unique_users,
          unique_sessions = EXCLUDED.unique_sessions,
          updated_at = NOW()
      `;

      await client.query(weeklyAggQuery, [organizationId]);

      await client.query("COMMIT");

      this.emit("materialized_aggregations:created", {
        organizationId,
        timestamp: new Date(),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Schedule aggregation jobs
   */
  async scheduleAggregationJob(
    organizationId: string,
    jobType: string,
    schedule: string,
    options: any
  ): Promise<any> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO analytics_aggregation_jobs (
          organization_id, job_type, schedule, options, is_active, created_at
        ) VALUES ($1, $2, $3, $4, true, NOW())
        RETURNING *
      `;

      const result = await client.query(query, [
        organizationId,
        jobType,
        schedule,
        JSON.stringify(options),
      ]);

      this.emit("aggregation_job:scheduled", result.rows[0]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Helper methods
  private calculateFunnelSummary(conversions: any[]): any {
    if (conversions.length === 0) return {};

    const totalUsers = conversions.reduce((sum, row) => sum + parseInt(row.total_users), 0);
    const convertedUsers = conversions.reduce((sum, row) => sum + parseInt(row.converted_users), 0);

    return {
      totalUsers,
      convertedUsers,
      conversionRate: totalUsers > 0 ? (convertedUsers / totalUsers) * 100 : 0,
      averageTimeToConvert: 0, // Placeholder
    };
  }

  private calculateRetentionRates(cohortData: any[]): any[] {
    return cohortData.map((cohort) => ({
      ...cohort,
      retentionRate: cohort.cohort_size > 0 ? 
        (cohort.active_users / cohort.cohort_size) * 100 : 0,
    }));
  }
} 