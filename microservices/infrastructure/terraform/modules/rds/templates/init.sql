-- Create extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Set up Supabase auth tables and RLS
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  encrypted_password TEXT NOT NULL,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

-- Create application tables
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.notification_templates(id) ON DELETE CASCADE,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, date)
);

-- Convert notification_stats to a TimescaleDB hypertable
SELECT create_hypertable('public.notification_stats', 'date', chunk_time_interval => INTERVAL '1 day');

-- Create notification events table for raw event storage
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  visitor_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert notification_events to a TimescaleDB hypertable
SELECT create_hypertable('public.notification_events', 'created_at', chunk_time_interval => INTERVAL '1 hour');

-- Enable Row-Level Security on all tables
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Create security policies for auth tables
CREATE POLICY user_self_access ON auth.users
  FOR ALL USING (id = current_user_id());

CREATE POLICY org_member_select ON auth.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
  );

CREATE POLICY org_admin_all ON auth.organizations
  FOR ALL USING (
    id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id() AND role = 'admin')
  );

CREATE POLICY membership_self_select ON auth.memberships
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY membership_org_admin ON auth.memberships
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id() AND role = 'admin')
  );

-- Create security policies for application tables
CREATE POLICY site_org_member_select ON public.sites
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
  );

CREATE POLICY site_org_admin_all ON public.sites
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id() AND role = 'admin')
  );

CREATE POLICY template_site_member_select ON public.notification_templates
  FOR SELECT USING (
    site_id IN (SELECT id FROM public.sites WHERE organization_id IN
      (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
    )
  );

CREATE POLICY template_site_admin_all ON public.notification_templates
  FOR ALL USING (
    site_id IN (SELECT id FROM public.sites WHERE organization_id IN
      (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id() AND role = 'admin')
    )
  );

CREATE POLICY stats_site_member_select ON public.notification_stats
  FOR SELECT USING (
    template_id IN (SELECT id FROM public.notification_templates WHERE site_id IN
      (SELECT id FROM public.sites WHERE organization_id IN
        (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
      )
    )
  );

CREATE POLICY events_site_member_select ON public.notification_events
  FOR SELECT USING (
    site_id IN (SELECT id FROM public.sites WHERE organization_id IN
      (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
    )
  );

-- Helper function to get current user ID (would be implemented by Supabase auth in production)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
  RETURN (SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 