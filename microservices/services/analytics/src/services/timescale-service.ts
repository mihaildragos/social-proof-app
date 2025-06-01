import { Pool, PoolClient } from 'pg';

export class TimescaleService {
  private pool: Pool;
  private logger: any;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL || process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.logger = console;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async insertEvent(event: {
    organization_id: string;
    site_id?: string;
    event_type: string;
    event_name: string;
    user_id?: string;
    session_id?: string;
    properties?: any;
    timestamp?: Date;
  }): Promise<void> {
    const query = `
      INSERT INTO analytics_events (
        organization_id, site_id, event_type, event_name, 
        user_id, session_id, properties, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await this.query(query, [
      event.organization_id,
      event.site_id || null,
      event.event_type,
      event.event_name,
      event.user_id || null,
      event.session_id || null,
      JSON.stringify(event.properties || {}),
      event.timestamp || new Date()
    ]);
  }

  async getEventStats(organizationId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    eventType?: string;
    interval?: 'hour' | 'day' | 'week' | 'month';
  } = {}): Promise<any[]> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId,
      eventType,
      interval = 'day'
    } = options;

    let query = `
      SELECT 
        time_bucket('1 ${interval}', timestamp) as time_bucket,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM analytics_events
      WHERE organization_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
    `;
    
    const params: any[] = [organizationId, startDate, endDate];
    let paramIndex = 4;

    if (siteId) {
      query += ` AND site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    if (eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    query += `
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;

    const result = await this.query(query, params);
    return result.rows.map(row => ({
      timestamp: row.time_bucket,
      event_count: parseInt(row.event_count),
      unique_users: parseInt(row.unique_users),
      unique_sessions: parseInt(row.unique_sessions)
    }));
  }

  async getTopEvents(organizationId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId,
      limit = 10
    } = options;

    let query = `
      SELECT 
        event_name,
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events
      WHERE organization_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
    `;
    
    const params: any[] = [organizationId, startDate, endDate];
    let paramIndex = 4;

    if (siteId) {
      query += ` AND site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    query += `
      GROUP BY event_name, event_type
      ORDER BY event_count DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows.map(row => ({
      event_name: row.event_name,
      event_type: row.event_type,
      event_count: parseInt(row.event_count),
      unique_users: parseInt(row.unique_users)
    }));
  }

  async getUserActivity(organizationId: string, userId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
  } = {}): Promise<any> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId
    } = options;

    let query = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT session_id) as total_sessions,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen,
        COUNT(DISTINCT event_name) as unique_events
      FROM analytics_events
      WHERE organization_id = $1 
        AND user_id = $2
        AND timestamp >= $3 
        AND timestamp <= $4
    `;
    
    const params: any[] = [organizationId, userId, startDate, endDate];
    let paramIndex = 5;

    if (siteId) {
      query += ` AND site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    const result = await this.query(query, params);
    const stats = result.rows[0];

    // Get event timeline
    let timelineQuery = `
      SELECT 
        timestamp,
        event_name,
        event_type,
        properties
      FROM analytics_events
      WHERE organization_id = $1 
        AND user_id = $2
        AND timestamp >= $3 
        AND timestamp <= $4
    `;
    
    const timelineParams: any[] = [organizationId, userId, startDate, endDate];
    let timelineParamIndex = 5;

    if (siteId) {
      timelineQuery += ` AND site_id = $${timelineParamIndex}`;
      timelineParams.push(siteId);
      timelineParamIndex++;
    }

    timelineQuery += ` ORDER BY timestamp DESC LIMIT 100`;

    const timelineResult = await this.query(timelineQuery, timelineParams);

    return {
      total_events: parseInt(stats.total_events),
      total_sessions: parseInt(stats.total_sessions),
      first_seen: stats.first_seen,
      last_seen: stats.last_seen,
      unique_events: parseInt(stats.unique_events),
      timeline: timelineResult.rows.map(row => ({
        timestamp: row.timestamp,
        event_name: row.event_name,
        event_type: row.event_type,
        properties: row.properties
      }))
    };
  }

  async getFunnelAnalysis(organizationId: string, steps: string[], options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
  } = {}): Promise<any> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId
    } = options;

    if (steps.length === 0) {
      return { steps: [], conversion_rate: 0, total_users: 0 };
    }

    // Build funnel analysis query using window functions
    const stepConditions = steps.map((step, index) => 
      `CASE WHEN event_name = '${step}' THEN ${index + 1} ELSE NULL END`
    ).join(', ');

    let query = `
      WITH user_events AS (
        SELECT 
          user_id,
          timestamp,
          event_name,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp) as event_order
        FROM analytics_events
        WHERE organization_id = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
          AND event_name = ANY($4)
    `;
    
    const params: any[] = [organizationId, startDate, endDate, steps];
    let paramIndex = 5;

    if (siteId) {
      query += ` AND site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    query += `
      ),
      funnel_progression AS (
        SELECT 
          user_id,
          ${steps.map((step, index) => 
            `MIN(CASE WHEN event_name = '${step}' THEN event_order END) as step_${index + 1}`
          ).join(', ')}
        FROM user_events
        GROUP BY user_id
      )
      SELECT 
        ${steps.map((_, index) => 
          `COUNT(CASE WHEN step_${index + 1} IS NOT NULL ${
            index > 0 ? steps.slice(0, index).map((_, prevIndex) => 
              `AND step_${prevIndex + 1} < step_${index + 1}`
            ).join(' ') : ''
          } THEN 1 END) as step_${index + 1}_users`
        ).join(', ')}
      FROM funnel_progression
    `;

    const result = await this.query(query, params);
    const funnelData = result.rows[0];

    const stepResults = steps.map((step, index) => {
      const users = parseInt(funnelData[`step_${index + 1}_users`] || 0);
      const prevUsers = index === 0 ? users : parseInt(funnelData[`step_${index}_users`] || 0);
      const conversionRate = prevUsers > 0 ? (users / prevUsers) * 100 : 0;

      return {
        step: step,
        step_number: index + 1,
        users: users,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        drop_off_rate: Math.round((100 - conversionRate) * 100) / 100
      };
    });

    const totalUsers = stepResults[0]?.users || 0;
    const finalUsers = stepResults[stepResults.length - 1]?.users || 0;
    const overallConversionRate = totalUsers > 0 ? (finalUsers / totalUsers) * 100 : 0;

    return {
      steps: stepResults,
      conversion_rate: Math.round(overallConversionRate * 100) / 100,
      total_users: totalUsers
    };
  }

  async getDeviceStats(organizationId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
  } = {}): Promise<any> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId
    } = options;

    let query = `
      SELECT 
        properties->>'device_type' as device_type,
        properties->>'browser' as browser,
        properties->>'os' as operating_system,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_events
      FROM analytics_events
      WHERE organization_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
        AND properties->>'device_type' IS NOT NULL
    `;
    
    const params: any[] = [organizationId, startDate, endDate];
    let paramIndex = 4;

    if (siteId) {
      query += ` AND site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    query += `
      GROUP BY properties->>'device_type', properties->>'browser', properties->>'os'
      ORDER BY unique_users DESC
    `;

    const result = await this.query(query, params);
    
    // Aggregate by device type
    const deviceTypes = new Map();
    const browsers = new Map();
    const operatingSystems = new Map();

    result.rows.forEach(row => {
      const deviceType = row.device_type || 'Unknown';
      const browser = row.browser || 'Unknown';
      const os = row.operating_system || 'Unknown';
      const users = parseInt(row.unique_users);

      // Aggregate device types
      deviceTypes.set(deviceType, (deviceTypes.get(deviceType) || 0) + users);
      browsers.set(browser, (browsers.get(browser) || 0) + users);
      operatingSystems.set(os, (operatingSystems.get(os) || 0) + users);
    });

    return {
      device_types: Array.from(deviceTypes.entries()).map(([type, users]) => ({
        device_type: type,
        users
      })),
      browsers: Array.from(browsers.entries()).map(([browser, users]) => ({
        browser,
        users
      })),
      operating_systems: Array.from(operatingSystems.entries()).map(([os, users]) => ({
        operating_system: os,
        users
      }))
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}