#!/usr/bin/env node

// Comprehensive migration script for Social Proof App
// This script applies all database migrations for:
// 1. Supabase (main app database)
// 2. PostgreSQL microservices databases
//
// Usage: node scripts/run-all-migrations.js [--dry-run] [--service=<service-name>]

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");
require("dotenv").config();

// Configuration
const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_KEY,
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || "social_proof_mvp",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
  },
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const serviceFilter = args.find((arg) => arg.startsWith("--service="))?.split("=")[1];

console.log("🚀 Social Proof App - Database Migration Runner");
console.log("===============================================\n");

if (isDryRun) {
  console.log("🔍 DRY RUN MODE - No changes will be applied\n");
}

if (serviceFilter) {
  console.log(`🎯 Running migrations for service: ${serviceFilter}\n`);
}

// Migration definitions
const migrations = {
  supabase: [
    {
      name: "Init Migration",
      file: "supabase/migrations/20250125124435_init.sql",
      description: "Creates billing tables, requesting_user_id() function, and RLS policies",
    },
    {
      name: "Sites Service",
      file: "supabase/migrations/20250126000000_sites_service.sql",
      description: "Creates sites and site_verifications tables with RLS policies",
    },
  ],
  microservices: {
    billing: [
      {
        name: "Initial Schema",
        file: "microservices/services/billing/db/migrations/001_initial_schema.sql",
        description: "Creates billing service tables (plans, subscriptions, invoices, etc.)",
      },
      {
        name: "Main Schema",
        file: "microservices/services/billing/db/schema.sql",
        description: "Additional billing service schema and indexes",
      },
    ],
    integrations: [
      {
        name: "Integrations Schema",
        file: "microservices/services/integrations/db/schema.sql",
        description: "Creates integrations service tables and encryption functions",
      },
    ],
    analytics: [
      {
        name: "Analytics Schema",
        file: "microservices/services/analytics/db/schema.sql",
        description: "Creates analytics service tables with TimescaleDB support",
      },
    ],
    notifications: [
      {
        name: "Notifications Init",
        file: "microservices/services/notifications/db/init.sql",
        description: "Creates notification templates and basic tables",
      },
      {
        name: "Notifications Schema",
        file: "microservices/services/notifications/db/schema.sql",
        description: "Creates notification campaigns and delivery tables",
      },
    ],
    users: [
      {
        name: "Users Schema",
        file: "microservices/services/users/db/schema.sql",
        description: "Creates users and organizations tables with PII encryption",
      },
      {
        name: "Permissions Schema",
        file: "microservices/services/users/db/permissions-schema.sql",
        description: "Creates RBAC permissions and roles tables",
      },
      {
        name: "SCIM Schema",
        file: "microservices/services/users/db/scim-schema.sql",
        description: "Creates SCIM provisioning tables for enterprise SSO",
      },
      {
        name: "Session Schema",
        file: "microservices/services/users/db/session-schema.sql",
        description: "Creates user session management tables",
      },
    ],
  },
};

// Utility functions
function readMigrationFile(filePath) {
  const fullPath = path.join(__dirname, "..", filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migration file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

async function runSupabaseMigrations() {
  console.log("📊 Running Supabase Migrations");
  console.log("------------------------------");

  if (!config.supabase.url || !config.supabase.serviceKey) {
    console.log("⚠️  Supabase credentials not found. Skipping Supabase migrations.");
    console.log("   Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_KEY in your .env file\n");
    return;
  }

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  for (const migration of migrations.supabase) {
    console.log(`🔄 Applying: ${migration.name}`);
    console.log(`   Description: ${migration.description}`);

    if (isDryRun) {
      console.log(`   📁 File: ${migration.file}`);
      console.log("   ✅ DRY RUN - Migration would be applied\n");
      continue;
    }

    try {
      // Check if migration is needed by testing a key table
      if (migration.name === "Sites Service") {
        const { data, error } = await supabase.from("sites").select("id").limit(1);
        if (!error) {
          console.log("   ✅ Already applied - sites table exists\n");
          continue;
        }
      }

      const sql = readMigrationFile(migration.file);

      // Note: Supabase doesn't support direct SQL execution via API
      // This would need to be applied manually through the dashboard
      console.log("   ⚠️  Manual application required");
      console.log("   📋 Please apply this migration manually in Supabase Dashboard:");
      console.log(
        `   🔗 https://supabase.com/dashboard/project/${config.supabase.url.split(".")[0].split("//")[1]}/sql`
      );
      console.log(`   📁 File: ${migration.file}\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }
}

async function runPostgresMigrations() {
  console.log("🐘 Running PostgreSQL Microservice Migrations");
  console.log("---------------------------------------------");

  const client = new Client(config.postgres);

  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL\n");

    for (const [serviceName, serviceMigrations] of Object.entries(migrations.microservices)) {
      if (serviceFilter && serviceName !== serviceFilter) {
        continue;
      }

      console.log(`📦 Service: ${serviceName}`);
      console.log(`${"=".repeat(serviceName.length + 10)}`);

      for (const migration of serviceMigrations) {
        console.log(`🔄 Applying: ${migration.name}`);
        console.log(`   Description: ${migration.description}`);

        if (isDryRun) {
          console.log(`   📁 File: ${migration.file}`);
          console.log("   ✅ DRY RUN - Migration would be applied\n");
          continue;
        }

        try {
          const sql = readMigrationFile(migration.file);

          // Execute the migration
          await client.query(sql);
          console.log("   ✅ Applied successfully\n");
        } catch (error) {
          // Check if error is due to objects already existing
          if (
            error.message.includes("already exists") ||
            (error.message.includes("relation") && error.message.includes("already exists"))
          ) {
            console.log("   ✅ Already applied - objects exist\n");
          } else {
            console.error(`   ❌ Error: ${error.message}\n`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ PostgreSQL connection error: ${error.message}`);
    console.log("\n💡 Make sure PostgreSQL is running and credentials are correct:");
    console.log("   - POSTGRES_HOST (default: localhost)");
    console.log("   - POSTGRES_PORT (default: 5432)");
    console.log("   - POSTGRES_DB (default: social_proof_mvp)");
    console.log("   - POSTGRES_USER (default: postgres)");
    console.log("   - POSTGRES_PASSWORD (default: postgres)\n");
  } finally {
    await client.end();
  }
}

async function createMigrationSummary() {
  console.log("📋 Migration Summary");
  console.log("==================");

  console.log("\n🔹 Supabase Migrations:");
  migrations.supabase.forEach((migration, index) => {
    console.log(`   ${index + 1}. ${migration.name}`);
    console.log(`      ${migration.description}`);
  });

  console.log("\n🔹 PostgreSQL Microservice Migrations:");
  Object.entries(migrations.microservices).forEach(([serviceName, serviceMigrations]) => {
    console.log(`\n   📦 ${serviceName.toUpperCase()} Service:`);
    serviceMigrations.forEach((migration, index) => {
      console.log(`      ${index + 1}. ${migration.name}`);
      console.log(`         ${migration.description}`);
    });
  });

  console.log("\n💡 Usage Examples:");
  console.log("   node scripts/run-all-migrations.js                    # Run all migrations");
  console.log("   node scripts/run-all-migrations.js --dry-run          # Preview migrations");
  console.log("   node scripts/run-all-migrations.js --service=billing  # Run specific service");
  console.log("");
}

// Main execution
async function main() {
  try {
    if (args.includes("--help") || args.includes("-h")) {
      await createMigrationSummary();
      return;
    }

    // Run Supabase migrations (manual instructions)
    if (!serviceFilter) {
      await runSupabaseMigrations();
    }

    // Run PostgreSQL migrations
    await runPostgresMigrations();

    console.log("🎉 Migration process completed!");
    console.log("\n📝 Next Steps:");
    console.log("1. Apply Supabase migrations manually through the dashboard");
    console.log("2. Verify all services can connect to their databases");
    console.log("3. Run application tests to ensure everything works");
    console.log("4. Check logs for any remaining issues\n");
  } catch (error) {
    console.error("❌ Migration process failed:", error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = {
  migrations,
  runSupabaseMigrations,
  runPostgresMigrations,
  createMigrationSummary,
};
