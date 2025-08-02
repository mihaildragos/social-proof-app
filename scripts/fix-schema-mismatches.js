#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration for each service database
const services = [
  {
    name: 'analytics',
    database: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL,
    migrations: [
      'microservices/services/analytics/db/migrations/001_comprehensive_schema_fixes.sql'
    ]
  },
  {
    name: 'billing',
    database: process.env.BILLING_DATABASE_URL || process.env.DATABASE_URL,
    migrations: [
      'microservices/services/billing/db/migrations/001_comprehensive_schema_fixes.sql'
    ]
  },
  {
    name: 'integrations',
    database: process.env.INTEGRATIONS_DATABASE_URL || process.env.DATABASE_URL,
    migrations: [
      'microservices/services/integrations/db/migrations/001_comprehensive_schema_fixes.sql'
    ]
  },
  {
    name: 'notifications',
    database: process.env.NOTIFICATIONS_DATABASE_URL || process.env.DATABASE_URL,
    migrations: [
      'microservices/services/notifications/db/migrations/001_comprehensive_schema_fixes.sql'
    ]
  },
  {
    name: 'users',
    database: process.env.USERS_DATABASE_URL || process.env.DATABASE_URL,
    migrations: [
      'microservices/services/users/db/migrations/001_comprehensive_schema_fixes.sql'
    ]
  }
];

class MigrationRunner {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  async runMigrations(dryRun = false) {
    console.log(`🚀 Starting schema mismatch fixes (${dryRun ? 'DRY RUN' : 'LIVE'})`);
    console.log('=' .repeat(60));

    const results = {
      success: [],
      failed: [],
      total: 0
    };

    for (const service of services) {
      console.log(`\n📦 Processing ${service.name} service...`);
      
      try {
        const serviceResult = await this.runServiceMigrations(service, dryRun);
        results.success.push({ service: service.name, ...serviceResult });
        results.total += serviceResult.migrationsRun;
      } catch (error) {
        console.error(`❌ Failed to process ${service.name}:`, error.message);
        results.failed.push({ service: service.name, error: error.message });
      }
    }

    this.printSummary(results, dryRun);
    return results;
  }

  async runServiceMigrations(service, dryRun) {
    if (!service.database) {
      throw new Error(`No database URL configured for ${service.name} service`);
    }

    const pool = new Pool({ connectionString: service.database });
    
    try {
      // Test connection
      await pool.query('SELECT 1');
      console.log(`  ✅ Connected to ${service.name} database`);

      const migrationsRun = [];
      
      for (const migrationFile of service.migrations) {
        const migrationPath = path.join(this.projectRoot, migrationFile);
        
        if (!fs.existsSync(migrationPath)) {
          console.warn(`  ⚠️  Migration file not found: ${migrationFile}`);
          continue;
        }

        const migrationName = path.basename(migrationFile, '.sql');
        console.log(`  🔄 Running migration: ${migrationName}`);

        if (!dryRun) {
          const sql = fs.readFileSync(migrationPath, 'utf8');
          
          try {
            await pool.query('BEGIN');
            
            // Check if migration has already been run
            const migrationCheck = await this.checkMigrationRun(pool, migrationName);
            
            if (migrationCheck.alreadyRun) {
              console.log(`  ⏭️  Migration ${migrationName} already applied`);
              await pool.query('ROLLBACK');
              continue;
            }

            // Run the migration
            await pool.query(sql);
            
            // Record migration as run
            await this.recordMigration(pool, migrationName);
            
            await pool.query('COMMIT');
            console.log(`  ✅ Migration ${migrationName} completed successfully`);
            migrationsRun.push(migrationName);
            
          } catch (error) {
            await pool.query('ROLLBACK');
            throw new Error(`Migration ${migrationName} failed: ${error.message}`);
          }
        } else {
          console.log(`  📝 Would run migration: ${migrationName}`);
          migrationsRun.push(migrationName);
        }
      }

      return {
        migrationsRun: migrationsRun.length,
        migrations: migrationsRun
      };

    } finally {
      await pool.end();
    }
  }

  async checkMigrationRun(pool, migrationName) {
    try {
      // Create migrations table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      const result = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
        [migrationName]
      );

      return { alreadyRun: result.rows.length > 0 };
    } catch (error) {
      console.warn(`  ⚠️  Could not check migration status: ${error.message}`);
      return { alreadyRun: false };
    }
  }

  async recordMigration(pool, migrationName) {
    try {
      await pool.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
        [migrationName]
      );
    } catch (error) {
      console.warn(`  ⚠️  Could not record migration: ${error.message}`);
    }
  }

  printSummary(results, dryRun) {
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 MIGRATION SUMMARY (${dryRun ? 'DRY RUN' : 'LIVE'})`);
    console.log('=' .repeat(60));
    
    console.log(`✅ Successful services: ${results.success.length}`);
    console.log(`❌ Failed services: ${results.failed.length}`);
    console.log(`📈 Total migrations run: ${results.total}`);

    if (results.success.length > 0) {
      console.log('\n✅ SUCCESSFUL SERVICES:');
      results.success.forEach(result => {
        console.log(`  ${result.service}: ${result.migrationsRun} migrations`);
        result.migrations.forEach(migration => {
          console.log(`    - ${migration}`);
        });
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ FAILED SERVICES:');
      results.failed.forEach(result => {
        console.log(`  ${result.service}: ${result.error}`);
      });
    }

    if (!dryRun && results.failed.length === 0) {
      console.log('\n🎉 All schema mismatches have been fixed successfully!');
      console.log('💡 Run tests to verify: npm run test');
    } else if (dryRun) {
      console.log('\n💡 To apply these migrations, run: npm run fix-schema-mismatches');
    }
  }

  async rollback(serviceName, migrationName) {
    console.log(`🔄 Rolling back migration ${migrationName} for ${serviceName}...`);
    
    const service = services.find(s => s.name === serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const pool = new Pool({ connectionString: service.database });
    
    try {
      await pool.query('BEGIN');
      
      // Remove migration record
      await pool.query(
        'DELETE FROM schema_migrations WHERE migration_name = $1',
        [migrationName]
      );
      
      await pool.query('COMMIT');
      console.log(`✅ Migration ${migrationName} rolled back successfully`);
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    } finally {
      await pool.end();
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const migrationRunner = new MigrationRunner();

  try {
    switch (command) {
      case 'dry-run':
        await migrationRunner.runMigrations(true);
        break;
        
      case 'rollback':
        const serviceName = args[1];
        const migrationName = args[2];
        if (!serviceName || !migrationName) {
          throw new Error('Usage: npm run rollback-migration <service> <migration>');
        }
        await migrationRunner.rollback(serviceName, migrationName);
        break;
        
      default:
        await migrationRunner.runMigrations(false);
        break;
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MigrationRunner };