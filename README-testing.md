# Social Proof Testing System

A comprehensive end-to-end testing framework for the social proof notification system. This testing infrastructure allows developers to simulate e-commerce events, monitor their processing through microservices, and verify notification delivery to client websites.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL with TimescaleDB
- Redis server
- All microservices running (integrations, notifications, notification-stream)

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

1. **Settings Tab**: Verify your test site is created
2. **Event Simulator Tab**: Fill out the form and send a purchase event
3. **Test Page Tab**: Open the client test page
4. **Live Monitor Tab**: Watch events flow through the system in real-time

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
- **One-click test site creation** with realistic configurations
- **Automatic Shopify integration** setup with proper credentials
- **Database seeding** with test data and notification preferences
- **Cleanup utilities** for managing test environments

### ✅ Comprehensive Event Simulation
- **Realistic Shopify webhook** payload generation
- **HMAC signature validation** for security testing
- **Multi-currency support** with proper formatting
- **Customer and product data** with location information
- **Bulk event generation** for load testing

### ✅ Real-Time Monitoring Dashboard
- **Live event streaming** via Server-Sent Events (SSE)
- **Event analytics** with statistics and trends
- **Connection status** monitoring for all services
- **Event filtering** and search capabilities
- **Export functionality** for test results

### ✅ Client-Side Testing Tools
- **Standalone HTML test page** simulating real e-commerce sites
- **Social proof script integration** testing
- **Cross-browser compatibility** verification
- **Performance monitoring** for notification delivery
- **Visual testing** for notification appearance

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
- **Customer Information Form**: Name, email, location details
- **Product Configuration**: Multiple products with prices and quantities  
- **Order Summary**: Currency selection and total calculation
- **Sample Data Generation**: One-click realistic data filling
- **Bulk Event Options**: Send multiple events for testing

#### 📊 Live Monitor
- **Real-Time Event Stream**: Live display of notifications as they flow
- **Statistics Dashboard**: Event counts, averages, and trends
- **Connection Status**: Health monitoring for all microservices
- **Event Details**: Full event payloads with timestamps and metadata
- **Filtering Options**: Search and filter events by type, customer, product

#### 🌐 Test Page Manager
- **Direct Access Links**: One-click access to client test pages
- **Configuration Display**: Site IDs, domains, and embed script status
- **Testing Instructions**: Step-by-step guidance for verification
- **Performance Metrics**: Load times and notification delivery stats

#### ⚙️ Settings & Management
- **Test Site Overview**: Current configuration and status
- **Environment Health**: Microservice connection verification
- **Cleanup Tools**: Reset or regenerate test environments
- **Debug Information**: Logs and troubleshooting data

### Client Test Page (`test-client.html`)
Standalone HTML page featuring:

- **Mock E-Commerce Layout**: Realistic product grid and shopping interface
- **Social Proof Integration**: Live notification display area
- **Status Indicators**: Script loading status and notification counters
- **Testing Instructions**: Clear guidance for verification workflow
- **Performance Monitoring**: Client-side metrics and debugging tools

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
- `GET /api/health` - Main application
- `GET /api/test-control-panel/health` - Testing system
- `GET /api/notifications/health` - Notification system

## 🔐 Security Features

### Webhook Security
- **HMAC Signature Validation**: All webhooks verified with SHA256 signatures
- **Timestamp Verification**: Prevents replay attacks with time-based validation  
- **Rate Limiting**: Protects against abuse with configurable limits
- **Input Sanitization**: All user inputs validated and sanitized

### Authentication & Authorization
- **Clerk Integration**: Secure user authentication and session management
- **Protected Routes**: All testing endpoints require authentication
- **User Isolation**: Test sites isolated per user account
- **API Key Management**: Secure handling of integration credentials

### Data Privacy
- **Test Data Only**: No real customer data in testing environment
- **Automatic Cleanup**: Test data automatically purged after use
- **Encryption**: Sensitive data encrypted at rest and in transit
- **Audit Logging**: All testing activities logged for security

## 📈 Performance & Scalability

### Optimization Features
- **Redis Caching**: Frequently accessed data cached for speed
- **Connection Pooling**: Efficient database connection management
- **Event Batching**: Multiple events processed efficiently  
- **Lazy Loading**: UI components loaded on demand

### Monitoring & Metrics
- **Real-Time Metrics**: Live performance monitoring dashboard
- **Event Latency Tracking**: End-to-end timing measurements
- **Error Rate Monitoring**: Automatic error detection and alerting
- **Resource Usage**: Memory and CPU utilization tracking

### Scalability Considerations
- **Horizontal Scaling**: Support for multiple testing instances
- **Load Balancing**: Even distribution of testing load
- **Auto-Scaling**: Dynamic resource allocation based on demand
- **Circuit Breakers**: Graceful degradation during high load

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
- **TypeScript**: Strict type checking enforced
- **ESLint**: Code linting with recommended rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality checks

## 📚 Additional Resources

- **[API Documentation](./docs/testing-system.md)** - Comprehensive API reference
- **[Architecture Guide](./docs/architecture.md)** - System design and architecture
- **[Deployment Guide](./docs/deployment.md)** - Production deployment instructions
- **[Contributing Guide](./CONTRIBUTING.md)** - Guidelines for contributors

## 📧 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/social-proof-app/issues)
- **Documentation**: [Full documentation](./docs/)
- **Discord**: [Join our community](https://discord.gg/your-server)

---

Built with ❤️ for comprehensive social proof testing 