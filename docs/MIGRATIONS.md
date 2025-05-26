# Database Migrations

This document explains how to use the database migration system for the Social Proof App.

## Overview

The application uses two database systems:
- **Supabase**: Frontend data (sites, billing, user preferences), authentication
- **PostgreSQL**: Microservice-specific data (integrations, events, analytics)

## Available NPM Scripts

### Main Migration Commands

```bash
# Run all migrations (PostgreSQL microservices only)
npm run migrate

# Preview all migrations without applying them
npm run migrate:dry-run

# Show help and migration summary
npm run migrate:help
```

### Service-Specific Migrations

```bash
# Run migrations for specific microservices
npm run migrate:billing
npm run migrate:integrations
npm run migrate:analytics
npm run migrate:notifications
npm run migrate:users
```

### Supabase Migrations

```bash
# Get instructions for manual Supabase migration
npm run migrate:supabase
```

## Migration Process

### 1. PostgreSQL Microservices (Automated)

The script automatically applies migrations to PostgreSQL for all microservices:

- **Billing Service**: Plans, subscriptions, invoices
- **Integrations Service**: Third-party integrations and credentials
- **Analytics Service**: Events, metrics with TimescaleDB
- **Notifications Service**: Templates, campaigns, delivery
- **Users Service**: User management, RBAC, SCIM, sessions

### 2. Supabase (Manual)

Supabase migrations must be applied manually through the dashboard:

1. Run `npm run migrate:help` to see instructions
2. Copy the SQL from the migration files
3. Apply through Supabase Dashboard → SQL Editor

Required Supabase migrations:
- `supabase/migrations/20250125124435_init.sql` - Core functions and billing tables
- `supabase/migrations/20250126000000_sites_service.sql` - Sites and verifications

## Environment Variables

Ensure these environment variables are set:

### PostgreSQL (Microservices)
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=social_proof_mvp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

## Troubleshooting

### PostgreSQL Connection Issues
- Ensure PostgreSQL is running: `npm run dev:infra`
- Check credentials in `.env` file
- Verify database exists

### Supabase Issues
- Verify project URL and service key
- Apply migrations manually through dashboard
- Check RLS policies are enabled

### Migration Already Applied
The script detects existing tables and skips already applied migrations.

## Development Workflow

1. **Start infrastructure**: `npm run dev:infra`
2. **Run migrations**: `npm run migrate`
3. **Apply Supabase migrations manually** (first time only)
4. **Start services**: `npm run dev:services`
5. **Start frontend**: `npm run dev`

## Adding New Migrations

1. Create SQL file in appropriate directory:
   - Supabase: `supabase/migrations/`
   - Microservices: `microservices/services/{service}/db/`

2. Update `scripts/run-all-migrations.js` with new migration entry

3. Test with dry run: `npm run migrate:dry-run`

## Migration Files Structure

```
├── supabase/migrations/
│   ├── 20250125124435_init.sql
│   └── 20250126000000_sites_service.sql
└── microservices/services/
    ├── billing/db/
    │   ├── migrations/001_initial_schema.sql
    │   └── schema.sql
    ├── integrations/db/schema.sql
    ├── analytics/db/schema.sql
    ├── notifications/db/
    │   ├── init.sql
    │   └── schema.sql
    └── users/db/
        ├── schema.sql
        ├── permissions-schema.sql
        ├── scim-schema.sql
        └── session-schema.sql
``` 