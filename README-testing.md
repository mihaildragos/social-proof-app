# Social Proof Testing System

A comprehensive end-to-end testing framework for the social proof notification system. This testing infrastructure allows developers to simulate e-commerce events, monitor their processing through microservices, and verify notification delivery to client websites.

## 🚀 Quick Start

### Prerequisites

* Node.js 18+
* PostgreSQL with TimescaleDB
* Redis server
* All microservices running (integrations, notifications, notification-stream)

### 1. Start the System

```bash
# Start microservices
npm run services:start

# Start the Next.js app
npm run dev
```

### 2. Access the Control Panel

1. Navigate to `http://localhost:3000/test-control-panel`
2. Sign in with your Clerk account
3. System will automatically set up your test environment

### 3. Run Your First Test

1. __Settings Tab__: Verify your test site is created
2. __Event Simulator Tab__: Fill out the form and send a purchase event
3. __Test Page Tab__: Open the client test page
4. __Live Monitor Tab__: Watch events flow through the system in real-time

## 🔧 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Test Control   │    │   Webhook API   │    │  Integrations   │
│     Panel       │───▶│   /simulate     │───▶│    Service      │
│                 │    │                 │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │              ┌─────────────────┐             │
         └─────────────▶│  Live Monitor   │◀────────────┘
                        │   Dashboard     │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │ Notification    │
                        │ Stream Service  │
                        │  (Port 3003)    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │ Client Test     │
                        │     Page        │
                        │ (test-client.   │
                        │     html)       │
                        └─────────────────┘
```

## 📋 Features

### ✅ Automated Test Environment Setup

* __One-click test site creation__ with realistic configurations
* __Automatic Shopify integration__ setup with proper credentials
* __Database seeding__ with test data and notification preferences
* __Cleanup utilities__ for managing test environments

### ✅ Comprehensive Event Simulation

* __Realistic Shopify webhook__ payload generation
* __HMAC signature validation__ for security testing
* __Multi-currency support__ with proper formatting
* __Customer and product data__ with location information
* __Bulk event generation__ for load testing

### ✅ Real-Time Monitoring Dashboard

* __Live event streaming__ via Server-Sent Events (SSE)
* __Event analytics__ with statistics and trends
* __Connection status__ monitoring for all services
* __Event filtering__ and search capabilities
* __Export functionality__ for test results

### ✅ Client-Side Testing Tools

* __Standalone HTML test page__ simulating real e-commerce sites
* __Social proof script integration__ testing
* __Cross-browser compatibility__ verification
* __Performance monitoring__ for notification delivery
* __Visual testing__ for notification appearance

## 🧪 Testing Scenarios

### Basic Flow Testing

```bash
# 1. Create test site (automatic)
# 2. Simulate purchase event
POST /api/test-control-panel/simulate-webhook
{
  "shop_domain": "test-shop.myshopify.com",
  "order_data": { ... }
}

# 3. Monitor processing
GET /api/notifications/stream?siteId=123

# 4. Verify client display
# Open test-client.html?siteId=123
```

### Load Testing

```bash
# Generate multiple events rapidly
for i in {1..100}; do
  curl -X POST /api/test-control-panel/simulate-webhook \
    -H "Content-Type: application/json" \
    -d @test-event.json
done
```

### Error Handling Testing

```bash
# Test invalid webhook data
POST /api/test-control-panel/simulate-webhook
{
  "shop_domain": "invalid",
  "order_data": null
}

# Test network failures
# Stop microservices and verify graceful degradation
```

## 📱 User Interface

### Test Control Panel

The main dashboard provides four key sections:

#### 🎮 Event Simulator

* __Customer Information Form__: Name, email, location details
* __Product Configuration__: Multiple products with prices and quantities
* __Order Summary__: Currency selection and total calculation
* __Sample Data Generation__: One-click realistic data filling
* __Bulk Event Options__: Send multiple events for testing

#### 📊 Live Monitor

* __Real-Time Event Stream__: Live display of notifications as they flow
* __Statistics Dashboard__: Event counts, averages, and trends
* __Connection Status__: Health monitoring for all microservices
* __Event Details__: Full event payloads with timestamps and metadata
* __Filtering Options__: Search and filter events by type, customer, product

#### 🌐 Test Page Manager

* __Direct Access Links__: One-click access to client test pages
* __Configuration Display__: Site IDs, domains, and embed script status
* __Testing Instructions__: Step-by-step guidance for verification
* __Performance Metrics__: Load times and notification delivery stats

#### ⚙️ Settings & Management

* __Test Site Overview__: Current configuration and status
* __Environment Health__: Microservice connection verification
* __Cleanup Tools__: Reset or regenerate test environments
* __Debug Information__: Logs and troubleshooting data

### Client Test Page (`test-client.html`)

Standalone HTML page featuring:

* __Mock E-Commerce Layout__: Realistic product grid and shopping interface
* __Social Proof Integration__: Live notification display area
* __Status Indicators__: Script loading status and notification counters
* __Testing Instructions__: Clear guidance for verification workflow
* __Performance Monitoring__: Client-side metrics and debugging tools

## 🔧 Configuration

### Environment Variables

```env
# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_public_key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Services (optional - auto-discovered)
INTEGRATIONS_SERVICE_URL=http://localhost:3001
NOTIFICATIONS_SERVICE_URL=http://localhost:3002  
NOTIFICATION_STREAM_SERVICE_URL=http://localhost:3003

# Testing
TEST_WEBHOOK_SECRET=your_test_webhook_secret
ENABLE_TEST_MODE=true
```

### Database Schema

The testing system requires these tables:

```sql
-- Sites table for test site management
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  shop_domain VARCHAR(255),
  user_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Integrations table for webhook configurations  
CREATE TABLE integrations (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id),
  platform VARCHAR(50) NOT NULL,
  api_key VARCHAR(255),
  webhook_secret VARCHAR(255),
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚨 Troubleshooting

### Common Issues

#### Test Site Creation Fails

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Verify user authentication
echo $CLERK_SECRET_KEY | cut -c1-10

# Review error logs
tail -f logs/app.log
```

#### Events Not Processing

```bash
# Check microservice health
curl http://localhost:3001/health
curl http://localhost:3002/health  
curl http://localhost:3003/health

# Verify Redis connectivity
redis-cli ping

# Check webhook signatures
# Review HMAC validation in logs
```

#### Notifications Not Displaying

```bash
# Verify embed script loading
curl http://localhost:3000/api/embed/SITE_ID.js

# Check browser console for errors
# Confirm SSE connection in Network tab

# Test notification endpoint directly
curl http://localhost:3000/api/notifications/stream?siteId=SITE_ID
```

#### SSE Connection Issues

```bash
# Check browser support
# EventSource should be available in all modern browsers

# Verify CORS configuration
# Check preflight OPTIONS requests

# Review server logs
grep "SSE" logs/app.log
```

### Debug Mode

Enable detailed logging:

```env
DEBUG=social-proof:*
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Monitoring

Built-in health checks available at:

* `GET /api/health` - Main application
* `GET /api/test-control-panel/health` - Testing system
* `GET /api/notifications/health` - Notification system

## 🔐 Security Features

### Webhook Security

* __HMAC Signature Validation__: All webhooks verified with SHA256 signatures
* __Timestamp Verification__: Prevents replay attacks with time-based validation
* __Rate Limiting__: Protects against abuse with configurable limits
* __Input Sanitization__: All user inputs validated and sanitized

### Authentication & Authorization

* __Clerk Integration__: Secure user authentication and session management
* __Protected Routes__: All testing endpoints require authentication
* __User Isolation__: Test sites isolated per user account
* __API Key Management__: Secure handling of integration credentials

### Data Privacy

* __Test Data Only__: No real customer data in testing environment
* __Automatic Cleanup__: Test data automatically purged after use
* __Encryption__: Sensitive data encrypted at rest and in transit
* __Audit Logging__: All testing activities logged for security

## 📈 Performance & Scalability

### Optimization Features

* __Redis Caching__: Frequently accessed data cached for speed
* __Connection Pooling__: Efficient database connection management
* __Event Batching__: Multiple events processed efficiently
* __Lazy Loading__: UI components loaded on demand

### Monitoring & Metrics

* __Real-Time Metrics__: Live performance monitoring dashboard
* __Event Latency Tracking__: End-to-end timing measurements
* __Error Rate Monitoring__: Automatic error detection and alerting
* __Resource Usage__: Memory and CPU utilization tracking

### Scalability Considerations

* __Horizontal Scaling__: Support for multiple testing instances
* __Load Balancing__: Even distribution of testing load
* __Auto-Scaling__: Dynamic resource allocation based on demand
* __Circuit Breakers__: Graceful degradation during high load

## 🤝 Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/social-proof-app
cd social-proof-app

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development environment
npm run dev
```

### Testing the Testing System

```bash
# Run unit tests
npm run test

# Run integration tests  
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run specific test suites
npm run test:testing-system
```

### Code Quality

* __TypeScript__: Strict type checking enforced
* __ESLint__: Code linting with recommended rules
* __Prettier__: Consistent code formatting
* __Husky__: Pre-commit hooks for quality checks

## 📚 Additional Resources

* __[API Documentation](./docs/testing-system.md)__ - Comprehensive API reference
* __[Architecture Guide](./docs/architecture.md)__ - System design and architecture
* __[Deployment Guide](./docs/deployment.md)__ - Production deployment instructions
* __[Contributing Guide](./CONTRIBUTING.md)__ - Guidelines for contributors

## 📧 Support

* __GitHub Issues__: [Report bugs or request features](https://github.com/your-org/social-proof-app/issues)
* __Documentation__: [Full documentation](./docs/)
* __Discord__: [Join our community](https://discord.gg/your-server)

---

Built with ❤️ for comprehensive social proof testing
