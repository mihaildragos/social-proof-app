# Supabase Setup Guide

This document outlines the steps to set up Supabase for the Social Proof App.

## Database Architecture

The application uses a split database architecture:

- **Supabase**: Frontend data (sites, billing, user preferences), shared reference data, real-time features, authentication
- **PostgreSQL Microservices**: Microservice-specific data (integrations, events, analytics), high-throughput operations, complex business logic

## Initial Setup

1. Create a new Supabase project at https://supabase.com
2. Copy the API URL and anon/service keys to your `.env` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_KEY=your-service-role-key
   ```

## Required Migrations

The following migrations must be applied to the Supabase database:

1. **Init (20250125124435_init.sql)**
   - Authentication integration
   - Subscription management
   - Base database policies and permissions

2. **Sites Service (20250126000000_sites_service.sql)**
   - Sites table for merchant websites
   - Site verification table and process
   - Row Level Security policies
   - Triggers and indexes

3. **Integrations (20250127000000_integrations.sql)**
   - Reference data for integrations

## Applying Migrations

### Option 1: Using Supabase Dashboard (Manual)

1. Go to Supabase Dashboard: https://supabase.com/dashboard/
2. Select your project
3. Navigate to SQL Editor
4. Create a new query
5. Copy and paste each migration SQL from `supabase/migrations/` in order
6. Run each SQL file

### Option 2: Using Supabase CLI (Automated)

Requires Docker to be running locally.

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your remote project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

## Verification

After setup, verify that:

1. Required tables exist:
   - `customers`
   - `products`
   - `prices`
   - `subscriptions`
   - `sites`
   - `site_verifications`

2. RLS policies are enabled
3. Authentication works properly
4. Test control panel can create test sites

## Development Workflow

For local development:

1. Make sure Docker is running
2. Start the local Supabase instance: `npx supabase start`
3. Add migrations to `supabase/migrations/` with timestamp-prefixed names
4. Test migrations locally
5. Push to remote: `npx supabase db push`

## Common Issues

### "Relation does not exist" errors

This indicates that a required migration hasn't been applied. Check that all migrations in `supabase/migrations/` have been executed on the database.

### "Could not find a relationship between tables" errors

This happens when trying to join tables that are in different databases (e.g., Supabase and PostgreSQL microservices). Make sure your queries respect the database architecture split. 