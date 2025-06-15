import { Pool } from 'pg';
import { prisma } from '../src/lib/prisma';

interface LegacyAnalyticsEvent {
  id: string;
  organization_id: string;
  site_id?: string;
  event_type: string;
  event_name?: string;
  user_id?: string;
  session_id?: string;
  properties: any;
  source?: string;
  campaign?: string;
  medium?: string;
  timestamp: Date;
  created_at: Date;
}

interface LegacyAnalyticsFunnel {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  steps: any;
  is_active?: boolean;
  created_at: Date;
  updated_at?: Date;
}

interface LegacyAnalyticsReport {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  config: any;
  type?: string;
  is_public?: boolean;
  created_at: Date;
  updated_at?: Date;
}

class PrismaMigrationService {
  private legacyDb: Pool;

  constructor() {
    this.legacyDb = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "social_proof_mvp",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async migrateAnalyticsEvents(batchSize: number = 1000): Promise<void> {
    console.log('🔄 Starting migration of analytics_events...');
    
    let offset = 0;
    let totalMigrated = 0;

    try {
      while (true) {
        const query = `
          SELECT 
            id, organization_id, site_id, event_type, event_name, user_id, 
            session_id, properties, source, campaign, medium, timestamp, created_at
          FROM analytics_events 
          ORDER BY created_at 
          LIMIT $1 OFFSET $2
        `;
        
        const result = await this.legacyDb.query(query, [batchSize, offset]);
        
        if (result.rows.length === 0) {
          break;
        }

        const events: LegacyAnalyticsEvent[] = result.rows;
        
        // Transform and insert into Prisma
        const prismaEvents = events.map(event => ({
          id: event.id,
          organizationId: event.organization_id,
          siteId: event.site_id,
          eventType: event.event_type,
          eventName: event.event_name,
          userId: event.user_id,
          sessionId: event.session_id,
          properties: typeof event.properties === 'string' 
            ? JSON.parse(event.properties) 
            : event.properties || {},
          source: event.source,
          campaign: event.campaign,
          medium: event.medium,
          timestamp: event.timestamp,
          createdAt: event.created_at,
        }));

        await prisma.$transaction(async (tx) => {
          for (const eventData of prismaEvents) {
            await tx.analyticsEvent.upsert({
              where: { id: eventData.id },
              update: eventData,
              create: eventData,
            });
          }
        });

        totalMigrated += events.length;
        offset += batchSize;
        
        console.log(`📊 Migrated ${totalMigrated} analytics events...`);
      }

      console.log(`✅ Successfully migrated ${totalMigrated} analytics events`);
    } catch (error) {
      console.error('❌ Error migrating analytics events:', error);
      throw error;
    }
  }

  async migrateAnalyticsFunnels(): Promise<void> {
    console.log('🔄 Starting migration of analytics_funnels...');
    
    try {
      const query = `
        SELECT 
          id, organization_id, name, description, steps, is_active, created_at, updated_at
        FROM analytics_funnels 
        ORDER BY created_at
      `;
      
      const result = await this.legacyDb.query(query);
      const funnels: LegacyAnalyticsFunnel[] = result.rows;

      if (funnels.length === 0) {
        console.log('ℹ️  No analytics funnels found to migrate');
        return;
      }

      const prismaFunnels = funnels.map(funnel => ({
        id: funnel.id,
        organizationId: funnel.organization_id,
        name: funnel.name,
        description: funnel.description,
        steps: typeof funnel.steps === 'string' 
          ? JSON.parse(funnel.steps) 
          : funnel.steps || [],
        isActive: funnel.is_active ?? true,
        createdAt: funnel.created_at,
        updatedAt: funnel.updated_at || funnel.created_at,
      }));

      await prisma.$transaction(async (tx) => {
        for (const funnelData of prismaFunnels) {
          await tx.analyticsFunnel.upsert({
            where: { id: funnelData.id },
            update: funnelData,
            create: funnelData,
          });
        }
      });

      console.log(`✅ Successfully migrated ${funnels.length} analytics funnels`);
    } catch (error) {
      console.error('❌ Error migrating analytics funnels:', error);
      throw error;
    }
  }

  async migrateAnalyticsReports(): Promise<void> {
    console.log('🔄 Starting migration of analytics_reports...');
    
    try {
      const query = `
        SELECT 
          id, organization_id, name, description, config, type, is_public, created_at, updated_at
        FROM analytics_reports 
        ORDER BY created_at
      `;
      
      const result = await this.legacyDb.query(query);
      const reports: LegacyAnalyticsReport[] = result.rows;

      if (reports.length === 0) {
        console.log('ℹ️  No analytics reports found to migrate');
        return;
      }

      const prismaReports = reports.map(report => ({
        id: report.id,
        organizationId: report.organization_id,
        name: report.name,
        description: report.description,
        config: typeof report.config === 'string' 
          ? JSON.parse(report.config) 
          : report.config || {},
        type: report.type,
        isPublic: report.is_public ?? false,
        createdAt: report.created_at,
        updatedAt: report.updated_at || report.created_at,
      }));

      await prisma.$transaction(async (tx) => {
        for (const reportData of prismaReports) {
          await tx.analyticsReport.upsert({
            where: { id: reportData.id },
            update: reportData,
            create: reportData,
          });
        }
      });

      console.log(`✅ Successfully migrated ${reports.length} analytics reports`);
    } catch (error) {
      console.error('❌ Error migrating analytics reports:', error);
      throw error;
    }
  }

  async validateMigration(): Promise<void> {
    console.log('🔍 Validating migration...');
    
    try {
      // Count records in legacy database
      const [eventsCount, funnelsCount, reportsCount] = await Promise.all([
        this.legacyDb.query('SELECT COUNT(*) FROM analytics_events'),
        this.legacyDb.query('SELECT COUNT(*) FROM analytics_funnels'),
        this.legacyDb.query('SELECT COUNT(*) FROM analytics_reports'),
      ]);

      // Count records in Prisma database
      const [prismaEventsCount, prismaFunnelsCount, prismaReportsCount] = await Promise.all([
        prisma.analyticsEvent.count(),
        prisma.analyticsFunnel.count(),
        prisma.analyticsReport.count(),
      ]);

      console.log('\n📊 Migration Validation Results:');
      console.log(`Events: ${eventsCount.rows[0].count} legacy → ${prismaEventsCount} prisma`);
      console.log(`Funnels: ${funnelsCount.rows[0].count} legacy → ${prismaFunnelsCount} prisma`);
      console.log(`Reports: ${reportsCount.rows[0].count} legacy → ${prismaReportsCount} prisma`);

      const eventsMatch = parseInt(eventsCount.rows[0].count) === prismaEventsCount;
      const funnelsMatch = parseInt(funnelsCount.rows[0].count) === prismaFunnelsCount;
      const reportsMatch = parseInt(reportsCount.rows[0].count) === prismaReportsCount;

      if (eventsMatch && funnelsMatch && reportsMatch) {
        console.log('✅ Migration validation successful - all counts match!');
      } else {
        console.log('⚠️  Migration validation warning - counts do not match exactly');
        if (!eventsMatch) console.log('❌ Events count mismatch');
        if (!funnelsMatch) console.log('❌ Funnels count mismatch');
        if (!reportsMatch) console.log('❌ Reports count mismatch');
      }
    } catch (error) {
      console.error('❌ Error validating migration:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.legacyDb.end();
    await prisma.$disconnect();
  }
}

async function main() {
  const migrationService = new PrismaMigrationService();
  
  try {
    console.log('🚀 Starting Prisma migration for Analytics Service');
    console.log('=' .repeat(60));
    
    // Run migrations in order
    await migrationService.migrateAnalyticsFunnels();
    await migrationService.migrateAnalyticsReports();
    await migrationService.migrateAnalyticsEvents();
    
    // Validate migration
    await migrationService.validateMigration();
    
    console.log('\n🎉 Prisma migration completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationService.close();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main();
}

export { PrismaMigrationService };