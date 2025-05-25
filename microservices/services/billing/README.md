# Billing Service

A comprehensive billing and subscription management service for the Social Proof application. This service handles subscription management, payment processing, usage tracking, and billing operations using Stripe and Clerk authentication.

## Features

### Core Functionality

* __Subscription Management__: Create, update, and cancel subscriptions
* __Plan Management__: Flexible plan configuration with features and limits
* __Payment Processing__: Secure payment handling via Stripe
* __Usage Tracking__: Monitor resource usage and overage billing
* __Invoice Management__: Automated invoice generation and management
* __Promo Codes__: Discount and promotional code system

### Security & Authentication

* __Clerk Integration__: Secure authentication and authorization
* __Organization-based Access__: Multi-tenant security model
* __Role-based Permissions__: Admin, billing, and user role support
* __Webhook Security__: HMAC signature verification for Stripe webhooks

### Enterprise Features

* __Multi-tenant Architecture__: Organization-based data isolation
* __Audit Logging__: Comprehensive activity tracking
* __Error Handling__: Robust error management with retry logic
* __Health Monitoring__: Health check and readiness endpoints
* __Graceful Shutdown__: Proper resource cleanup on termination

## Architecture

### Technology Stack

* __Runtime__: Node.js 18+ with TypeScript
* __Framework__: Express.js with security middleware
* __Database__: PostgreSQL with UUID primary keys
* __Payment Processing__: Stripe API v2023-10
* __Authentication__: Clerk SDK for Node.js
* __Logging__: Winston structured logging
* __Validation__: Zod schema validation

### Database Schema

* __plans__: Subscription plan definitions
* __plan\_features__: Feature flags and configurations
* __plan\_limits__: Resource limits and overage pricing
* __subscriptions__: Active subscription records
* __invoices__: Billing history and invoice data
* __payment\_methods__: Stored payment method information
* __usage\_records__: Resource usage tracking
* __promo\_codes__: Discount and promotional codes

## Getting Started

### Prerequisites

* Node.js 18 or higher
* PostgreSQL 13 or higher
* Redis (for caching and rate limiting)
* Stripe account with API keys
* Clerk account with authentication setup

### Installation

1. __Clone and navigate to the billing service__:
   ```bash
   cd microservices/services/billing
   ```

2. __Install dependencies__:
   ```bash
   npm install
   ```

3. __Set up environment variables__:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. __Run database migrations__:
   ```bash
   psql -h localhost -U postgres -d social_proof_mvp -f db/migrations/001_initial_schema.sql
   ```

5. __Seed sample data__ (optional):
   ```bash
   psql -h localhost -U postgres -d social_proof_mvp -f db/seeds/001_sample_plans.sql
   ```

6. __Start the service__:
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

### Docker Deployment

1. __Build the Docker image__:
   ```bash
   docker build -t billing-service .
   ```

2. __Run with Docker Compose__:
   ```bash
   docker-compose up billing-service
   ```

## API Documentation

### Authentication

All API endpoints require authentication via Clerk JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <clerk_jwt_token>
```

### Endpoints

#### Subscriptions

* `GET /api/subscriptions/:organizationId` - Get subscription details
* `POST /api/subscriptions` - Create new subscription
* `PUT /api/subscriptions/:id` - Update subscription
* `DELETE /api/subscriptions/:id` - Cancel subscription

#### Plans

* `GET /api/plans` - List all available plans
* `GET /api/plans/:id` - Get specific plan details
* `GET /api/plans/:id/features` - Get plan features
* `GET /api/plans/:id/limits` - Get plan limits

#### Webhooks

* `POST /api/webhooks/stripe` - Stripe webhook endpoint

#### Health Checks

* `GET /health` - Basic health check
* `GET /ready` - Readiness check with dependencies

### Request/Response Examples

#### Create Subscription

```bash
POST /api/subscriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "organization_id": "org_123",
  "plan_id": "550e8400-e29b-41d4-a716-446655440002",
  "billing_cycle": "monthly",
  "payment_method_id": "pm_1234567890"
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "id": "sub_123",
    "organization_id": "org_123",
    "plan_id": "550e8400-e29b-41d4-a716-446655440002",
    "billing_cycle": "monthly",
    "status": "active",
    "current_period_start": "2024-01-01T00:00:00Z",
    "current_period_end": "2024-02-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Configuration

### Environment Variables

#### Required

* `DATABASE_URL`: PostgreSQL connection string
* `STRIPE_SECRET_KEY`: Stripe secret API key
* `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
* `CLERK_SECRET_KEY`: Clerk secret key
* `CLERK_JWT_KEY`: Clerk JWT verification key

#### Optional

* `PORT`: Server port (default: 3006)
* `NODE_ENV`: Environment (development/production)
* `LOG_LEVEL`: Logging level (debug/info/warn/error)
* `CORS_ORIGIN`: Allowed CORS origins
* `REDIS_URL`: Redis connection string for caching

### Stripe Configuration

1. __Create Products and Prices__ in Stripe Dashboard
2. __Set up Webhooks__ pointing to `/api/webhooks/stripe`
3. __Configure Webhook Events__:
   * `invoice.payment_succeeded`
   * `invoice.payment_failed`
   * `customer.subscription.updated`
   * `customer.subscription.deleted`

### Clerk Configuration

1. __Set up Organization-based Authentication__
2. __Configure JWT Template__ with organization claims
3. __Set up Role-based Permissions__:
   * `admin`: Full billing access
   * `billing`: Billing management access
   * `member`: Read-only access

## Development

### Project Structure

```
src/
├── index.ts                 # Main application entry
├── routes/                  # API route handlers
│   ├── index.ts
│   ├── subscriptionRoutes.ts
│   ├── planRoutes.ts
│   └── webhookRoutes.ts
├── services/                # Business logic services
│   └── StripeService.ts
├── repositories/            # Data access layer
│   ├── SubscriptionRepository.ts
│   └── PlanRepository.ts
├── middleware/              # Express middleware
│   ├── authMiddleware.ts
│   └── errorHandler.ts
├── utils/                   # Utility functions
│   ├── database.ts
│   └── logger.ts
└── types/                   # TypeScript type definitions
    └── index.ts
```

### Scripts

* `npm run dev`: Start development server with hot reload
* `npm run build`: Build TypeScript to JavaScript
* `npm start`: Start production server
* `npm test`: Run test suite
* `npm run lint`: Run ESLint
* `npm run lint:fix`: Fix ESLint issues

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Monitoring & Observability

### Health Checks

* __Health Endpoint__: `/health` - Basic service health
* __Readiness Endpoint__: `/ready` - Service and dependency health

### Logging

Structured JSON logging with Winston:

* Request/response logging
* Error tracking with stack traces
* Business event logging
* Performance metrics

### Metrics

* Request duration and count
* Error rates by endpoint
* Database query performance
* Stripe API response times

## Security

### Authentication & Authorization

* JWT token validation via Clerk
* Organization-based access control
* Role-based permissions
* Request rate limiting

### Data Protection

* Sensitive data encryption at rest
* PCI DSS compliance for payment data
* GDPR compliance for user data
* Audit logging for compliance

### Security Headers

* Helmet.js security middleware
* CORS configuration
* Content Security Policy
* HSTS headers

## Deployment

### Production Checklist

* [ ] Environment variables configured
* [ ] Database migrations applied
* [ ] Stripe webhooks configured
* [ ] Clerk authentication setup
* [ ] SSL certificates installed
* [ ] Monitoring and alerting configured
* [ ] Backup strategy implemented

### Scaling Considerations

* Horizontal scaling with load balancer
* Database read replicas for performance
* Redis clustering for high availability
* CDN for static assets
* Container orchestration with Kubernetes

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check database connectivity
npm run db:test

# Verify environment variables
echo $DATABASE_URL
```

#### Stripe Webhook Failures

```bash
# Verify webhook signature
curl -X POST http://localhost:3006/api/webhooks/stripe \
  -H "Stripe-Signature: t=..." \
  -d @webhook_payload.json
```

#### Authentication Issues

```bash
# Verify Clerk configuration
curl -H "Authorization: Bearer <token>" \
  http://localhost:3006/api/subscriptions/org_123
```

### Logs and Debugging

* Check application logs: `docker logs billing-service`
* Enable debug logging: `LOG_LEVEL=debug`
* Monitor health endpoints: `/health` and `/ready`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

* TypeScript strict mode
* ESLint configuration
* Prettier code formatting
* Conventional commit messages
* 100% test coverage for new features

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

* Create an issue in the repository
* Check the troubleshooting guide
* Review the API documentation
* Contact the development team

---

__Version__: 1.0.0\
__Last Updated__: January 2024\
__Maintainer__: Social Proof Development Team
