# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## We are building PulseSocialProof.com

## What is PulseSocialProof.com?

__PulseSocialProof is a social proof marketing platform__ that helps businesses increase conversions by displaying real-time customer activity notifications on their websites.

## Core Functionality

The platform works by showing __live notifications__ of what other visitors are doing on a website, such as:

* Recent purchases ("John from New York just bought...")
* Sign-ups and registrations
* Product views
* Cart additions
* Live visitor counts
* Low stock alerts
* Customer reviews

## Key Features for Your Clone

1. __Real-time Notifications__: Small popups that appear in corners of the website showing recent customer activities

2. __Integration System__: PulseSocialProof connects seamlessly with 100s of your favorite apps, including:
   * E-commerce platforms (Shopify, WooCommerce, BigCommerce)
   * Email services
   * Payment processors
   * Analytics tools

3. __Customization Options__:
   * Notification appearance (colors, fonts, positioning)
   * Display rules (which pages, timing, frequency)
   * Custom branding capabilities
   * Different notification templates

4. __Analytics Dashboard__: Track metrics like:
   * Impressions
   * Clicks
   * Conversions
   * Engagement rates

5. __Targeting Features__:
   * Geo-targeting
   * Page-specific rules
   * Device-based display
   * User behavior triggers

## Technical Architecture

For your school project, you'd need to build:

1. __Backend System__:
   * API to receive events from integrated platforms
   * Database to store notification data
   * Real-time event processing
   * User account management

2. __Frontend Components__:
   * JavaScript widget that websites can embed
   * Notification display system
   * Admin dashboard for configuration

3. __Core Technologies__:
   * WebSockets or Server-Sent Events for real-time updates
   * RESTful API for integrations
   * JavaScript SDK for easy website installation

## Business Model

PulseSocialProof typically offers tiered pricing based on:

* Number of website visitors
* Number of notifications
* Advanced features access
* Branding removal options

## Architecture Overview

This is a social proof notification SaaS application with:

* __Frontend__: Next.js 14 app with Clerk auth, Supabase, and Stripe integration
* __Backend__: 6 microservices (Billing, Notifications, Notification Stream, Integrations, Users, Analytics)
* __Infrastructure__: PostgreSQL, Redis, Kafka, ClickHouse, deployed on Kubernetes/GKE
* __Widget__: Embeddable JavaScript widget for customer websites

## Essential Commands

### Frontend Development

```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build           # Build for production
npm run test            # Run all tests
npm run test:api        # Run API tests only
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
```

### Microservices Development

```bash
# Docker Compose commands (from root)
npm run dev:all         # Start all services + infrastructure
npm run dev:infra       # Start only infrastructure (DB, Redis, Kafka)
npm run dev:services    # Start only microservices
npm run dev:logs        # View all service logs
npm run dev:clean       # Stop and clean all containers

# Access service shells
npm run dev:shell:billing
npm run dev:shell:notifications
npm run dev:shell:users

# Database operations
npm run migrate         # Run all migrations
npm run migrate:billing # Run billing service migrations
```

### Testing

```bash
# Frontend tests
npm test                # Run all frontend tests
npm test -- --watch     # Watch mode
npm test -- path/to/file # Test specific file

# Microservice unit tests
cd microservices/services/notifications && npm test
cd microservices/services/integrations && npm test -
cd microservices/services/billing && npm test
cd microservices/services/analytics && npm test
cd microservices/services/users && npm test - 
cd microservices/services/notification-stream-service && npm test

# Run specific test patterns
npm test -- --testPathPattern="oauth-service"
npm test -- --testPathPattern="webhook-service"

# E2E tests
npm run test:e2e        # Run Playwright tests
node test-notification-flow.js  # Test notification flow
node test-webhook-debug.js      # Debug webhooks

# Test coverage
npm test -- --coverage # Run with coverage report
```

## Service Ports

* Frontend: 3000
* Integrations: 3001
* Notification Stream: 3002
* Notifications: 3003
* Users: 3004
* Analytics: 3005
* Billing: 3006
* PostgreSQL: 5432
* Redis: 6379
* Kafka: 9092
* ClickHouse: 8123

## Key Architectural Patterns

### Event-Driven Communication

Services communicate via Kafka. Common event patterns:

* `shopify.order.created` → triggers notification creation
* `notification.created` → triggers delivery via stream service
* `user.subscription.updated` → updates usage limits

### Database Structure

* Each microservice has its own PostgreSQL schema
* Supabase used for frontend-specific data (sites, configurations)
* ClickHouse for analytics/time-series data

### Authentication Flow

1. Frontend uses Clerk for user auth
2. Clerk webhook syncs to Users service
3. Services use JWT tokens for inter-service auth
4. Widget uses site-specific API keys

### Real-time Notifications

1. Events published to Kafka
2. Notification service creates notification
3. Stream service delivers via SSE/WebSocket
4. Widget receives and displays notification

## Test Suite Implementation

The application includes comprehensive unit tests for all microservices:

### Notifications Service Tests

* Notification creation and delivery logic
* A/B testing functionality
* Template rendering and validation
* Event processing pipeline

### Integrations Service Tests

* OAuth authentication flows (Google, Facebook, Shopify, Stripe, Zapier)
* Webhook processing and verification (Shopify, WooCommerce, Stripe)
* Data synchronization strategies
* Platform-specific service implementations

### Billing Service Tests

* Subscription management
* Payment processing with Stripe
* Usage tracking and limits
* Invoice generation

### Users Service Tests

* User authentication and authorization
* Organization and team management
* Role-based access control (RBAC)
* User profile management

### Analytics Service Tests

* Event aggregation and reporting
* Real-time metrics processing
* Dashboard data generation

### Shared Package Tests

* Event system validation
* Authentication middleware
* Error handling utilities
* Kafka producer/consumer logic

### Test Coverage Areas

* API endpoint validation
* Database operations
* Event-driven communication
* Error handling and recovery
* Authentication and authorization
* Data transformation and validation
* External service integrations
* Real-time processing

## Common Development Tasks

### Adding a New API Endpoint

1. Frontend API routes go in `app/api/`
2. Microservice routes go in `services/[service]/src/routes/`
3. Add validation middleware using Zod schemas
4. Update TypeScript types in `types/` directories

### Working with Databases

1. Migrations in `microservices/services/[service]/db/migrations/`
2. Use numbered migration files (e.g., `001_initial_schema.sql`)
3. Run migrations with `npm run migrate:[service]`

### Testing Webhook Integration

1. Use test control panel at `/test-control-panel`
2. Simulate webhooks with `test-webhook-debug.js`
3. Check webhook validation in Integrations service logs

### Debugging Services

1. Check logs: `npm run dev:logs`
2. Access service shell: `npm run dev:shell:[service]`
3. Health endpoints: `http://localhost:[port]/health`
4. Use structured logging with Winston

## Important Files to Know

* `app/api/` - Next.js API routes
* `microservices/services/*/src/index.ts` - Service entry points
* `microservices/shared/` - Shared utilities and middleware
* `public/widget/social-proof-widget.js` - Embeddable widget
* `database/init/01-init-database.sql` - Main DB schema
* `gcp/kubernetes/` - K8s deployment manifests

## Environment Configuration

Development uses `.env.dev` with these key variables:

* `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` - Supabase connection
* `CLERK_SECRET_KEY` - Clerk authentication
* `STRIPE_SECRET_KEY` - Stripe payments
* `DATABASE_URL` - PostgreSQL connection
* `REDIS_URL` - Redis connection
* `KAFKA_BROKERS` - Kafka connection

## Deployment Notes

* Staging deployment: `scripts/deploy-staging.sh`
* Production uses Kubernetes on GKE
* Database migrations run automatically on deploy
* Health checks required for all services
* Use ConfigMaps for non-sensitive config
