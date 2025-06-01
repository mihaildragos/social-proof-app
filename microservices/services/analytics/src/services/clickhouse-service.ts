import { createClient, ClickHouseClient } from '@clickhouse/client';

export class ClickHouseService {
  private client: ClickHouseClient;
  private logger: any;

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'social_proof',
    });
    this.logger = console;
  }

  async query(sql: string, params?: any): Promise<any> {
    try {
      const result = await this.client.query({
        query: sql,
        query_params: params,
        format: 'JSONEachRow'
      });
      
      return await result.json();
    } catch (error) {
      this.logger.error('ClickHouse query error:', error);
      throw error;
    }
  }

  async insertEvents(events: Array<{
    organization_id: string;
    site_id?: string;
    event_type: string;
    event_name: string;
    user_id?: string;
    session_id?: string;
    properties?: any;
    timestamp?: Date;
    country?: string;
    region?: string;
    city?: string;
    device_type?: string;
    browser?: string;
    os?: string;
  }>): Promise<void> {
    if (events.length === 0) return;

    const values = events.map(event => ({
      organization_id: event.organization_id,
      site_id: event.site_id || '',
      event_type: event.event_type,
      event_name: event.event_name,
      user_id: event.user_id || '',
      session_id: event.session_id || '',
      properties: JSON.stringify(event.properties || {}),
      timestamp: event.timestamp || new Date(),
      country: event.country || '',
      region: event.region || '',
      city: event.city || '',
      device_type: event.device_type || '',
      browser: event.browser || '',
      os: event.os || ''
    }));

    await this.client.insert({
      table: 'analytics_events',
      values,
      format: 'JSONEachRow'
    });
  }

  async getEventAggregations(organizationId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
    metrics?: string[];
  } = {}): Promise<any[]> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId,
      groupBy = 'day',
      metrics = ['events', 'users', 'sessions']
    } = options;

    let dateFormat = 'toStartOfDay(timestamp)';
    switch (groupBy) {
      case 'hour':
        dateFormat = 'toStartOfHour(timestamp)';
        break;
      case 'week':
        dateFormat = 'toStartOfWeek(timestamp)';
        break;
      case 'month':
        dateFormat = 'toStartOfMonth(timestamp)';
        break;
    }

    const metricSelections = [];
    if (metrics.includes('events')) {
      metricSelections.push('count(*) as events');
    }
    if (metrics.includes('users')) {
      metricSelections.push('uniq(user_id) as unique_users');
    }
    if (metrics.includes('sessions')) {
      metricSelections.push('uniq(session_id) as unique_sessions');
    }

    let query = `
      SELECT 
        ${dateFormat} as date,
        ${metricSelections.join(', ')}
      FROM analytics_events
      WHERE organization_id = {organization_id:String}
        AND timestamp >= {start_date:DateTime}
        AND timestamp <= {end_date:DateTime}
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    query += ' GROUP BY date ORDER BY date';

    const result = await this.query(query, params);
    return result.map(row => ({
      date: row.date,
      events: parseInt(row.events || 0),
      unique_users: parseInt(row.unique_users || 0),
      unique_sessions: parseInt(row.unique_sessions || 0)
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
      limit = 20
    } = options;

    let query = `
      SELECT 
        event_name,
        event_type,
        count(*) as event_count,
        uniq(user_id) as unique_users,
        uniq(session_id) as unique_sessions
      FROM analytics_events
      WHERE organization_id = {organization_id:String}
        AND timestamp >= {start_date:DateTime}
        AND timestamp <= {end_date:DateTime}
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    query += `
      GROUP BY event_name, event_type
      ORDER BY event_count DESC
      LIMIT {limit:UInt32}
    `;
    params['limit'] = limit;

    const result = await this.query(query, params);
    return result.map(row => ({
      event_name: row.event_name,
      event_type: row.event_type,
      event_count: parseInt(row.event_count),
      unique_users: parseInt(row.unique_users),
      unique_sessions: parseInt(row.unique_sessions)
    }));
  }

  async getGeographicData(organizationId: string, options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    groupBy?: 'country' | 'region' | 'city';
  } = {}): Promise<any[]> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId,
      groupBy = 'country'
    } = options;

    let query = `
      SELECT 
        ${groupBy},
        count(*) as events,
        uniq(user_id) as unique_users
      FROM analytics_events
      WHERE organization_id = {organization_id:String}
        AND timestamp >= {start_date:DateTime}
        AND timestamp <= {end_date:DateTime}
        AND ${groupBy} != ''
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    query += `
      GROUP BY ${groupBy}
      ORDER BY unique_users DESC
      LIMIT 50
    `;

    const result = await this.query(query, params);
    return result.map(row => ({
      [groupBy]: row[groupBy],
      events: parseInt(row.events),
      unique_users: parseInt(row.unique_users)
    }));
  }

  async getDeviceAnalytics(organizationId: string, options: {
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
        device_type,
        browser,
        os,
        count(*) as events,
        uniq(user_id) as unique_users
      FROM analytics_events
      WHERE organization_id = {organization_id:String}
        AND timestamp >= {start_date:DateTime}
        AND timestamp <= {end_date:DateTime}
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    query += `
      GROUP BY device_type, browser, os
      ORDER BY unique_users DESC
    `;

    const result = await this.query(query, params);
    
    // Aggregate by categories
    const devices = new Map();
    const browsers = new Map();
    const operatingSystems = new Map();

    result.forEach(row => {
      const device = row.device_type || 'Unknown';
      const browser = row.browser || 'Unknown';
      const os = row.os || 'Unknown';
      const users = parseInt(row.unique_users);

      devices.set(device, (devices.get(device) || 0) + users);
      browsers.set(browser, (browsers.get(browser) || 0) + users);
      operatingSystems.set(os, (operatingSystems.get(os) || 0) + users);
    });

    return {
      devices: Array.from(devices.entries()).map(([device_type, users]) => ({
        device_type,
        users
      })).sort((a, b) => b.users - a.users),
      browsers: Array.from(browsers.entries()).map(([browser, users]) => ({
        browser,
        users
      })).sort((a, b) => b.users - a.users),
      operating_systems: Array.from(operatingSystems.entries()).map(([os, users]) => ({
        operating_system: os,
        users
      })).sort((a, b) => b.users - a.users)
    };
  }

  async getConversionFunnel(organizationId: string, steps: string[], options: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string;
    windowHours?: number;
  } = {}): Promise<any> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      siteId,
      windowHours = 24
    } = options;

    if (steps.length === 0) {
      return { steps: [], conversion_rate: 0, total_users: 0 };
    }

    // ClickHouse funnel analysis using window functions
    let query = `
      WITH step_events AS (
        SELECT 
          user_id,
          event_name,
          timestamp,
          ${steps.map((step, index) => 
            `if(event_name = '${step}', ${index + 1}, 0) as step_${index + 1}`
          ).join(', ')}
        FROM analytics_events
        WHERE organization_id = {organization_id:String}
          AND timestamp >= {start_date:DateTime}
          AND timestamp <= {end_date:DateTime}
          AND event_name IN (${steps.map((_, i) => `{step_${i}:String}`).join(', ')})
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    steps.forEach((step, index) => {
      params[`step_${index}`] = step;
    });

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    query += `
      ),
      user_progression AS (
        SELECT 
          user_id,
          ${steps.map((_, index) => 
            `min(if(step_${index + 1} > 0, timestamp, null)) as step_${index + 1}_time`
          ).join(', ')}
        FROM step_events
        GROUP BY user_id
      )
      SELECT 
        ${steps.map((_, index) => 
          `countIf(step_${index + 1}_time IS NOT NULL ${
            index > 0 ? `AND step_${index + 1}_time >= step_${index}_time AND step_${index + 1}_time <= step_${index}_time + INTERVAL ${windowHours} HOUR` : ''
          }) as step_${index + 1}_users`
        ).join(', ')}
      FROM user_progression
    `;

    const result = await this.query(query, params);
    const funnelData = result[0];

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
      total_users: totalUsers,
      window_hours: windowHours
    };
  }

  async getPerformanceMetrics(organizationId: string, options: {
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
        avg(if(JSONExtractFloat(properties, 'page_load_time') > 0, JSONExtractFloat(properties, 'page_load_time'), null)) as avg_page_load_time,
        quantile(0.95)(if(JSONExtractFloat(properties, 'page_load_time') > 0, JSONExtractFloat(properties, 'page_load_time'), null)) as p95_page_load_time,
        avg(if(JSONExtractFloat(properties, 'ttfb') > 0, JSONExtractFloat(properties, 'ttfb'), null)) as avg_ttfb,
        avg(if(JSONExtractFloat(properties, 'dom_ready') > 0, JSONExtractFloat(properties, 'dom_ready'), null)) as avg_dom_ready,
        countIf(event_name = 'page_view') as page_views,
        countIf(event_name = 'error') as errors,
        uniq(user_id) as unique_users
      FROM analytics_events
      WHERE organization_id = {organization_id:String}
        AND timestamp >= {start_date:DateTime}
        AND timestamp <= {end_date:DateTime}
    `;

    const params = {
      organization_id: organizationId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    if (siteId) {
      query += ' AND site_id = {site_id:String}';
      params['site_id'] = siteId;
    }

    const result = await this.query(query, params);
    const metrics = result[0];

    return {
      avg_page_load_time: parseFloat(metrics.avg_page_load_time || 0),
      p95_page_load_time: parseFloat(metrics.p95_page_load_time || 0),
      avg_ttfb: parseFloat(metrics.avg_ttfb || 0),
      avg_dom_ready: parseFloat(metrics.avg_dom_ready || 0),
      page_views: parseInt(metrics.page_views || 0),
      errors: parseInt(metrics.errors || 0),
      unique_users: parseInt(metrics.unique_users || 0),
      error_rate: metrics.page_views > 0 ? (metrics.errors / metrics.page_views) * 100 : 0
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}