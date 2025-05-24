# End-to-End Testing System Documentation

## Overview

The End-to-End Testing System provides a comprehensive solution for testing the social proof notification flow from event generation to client display. This system allows developers to simulate e-commerce events, monitor their processing through microservices, and verify notification delivery to client websites.

## Architecture

### Components

1. __Test Control Panel__ (`/test-control-panel`)
   * Main dashboard for testing operations
   * Event simulation interface
   * Live monitoring dashboard
   * Test site management

2. __Client Test Page__ (`/test-client.html`)
   * Standalone HTML page simulating a real e-commerce website
   * Loads social proof script and displays notifications
   * Provides testing instructions and status indicators

3. __API Endpoints__
   * `/api/test-control-panel/test-site` - Test site management
   * `/api/test-control-panel/simulate-webhook` - Event simulation
   * `/api/notifications/stream` - SSE notification stream
   * `/api/embed/{siteId}.js` - Social proof embed script

4. __Supporting Libraries__
   * `lib/test-helpers.ts` - Test site management utilities
   * `lib/webhook-security.ts` - Webhook security and validation
   * `lib/service-urls.ts` - Environment-aware service discovery

## Features

### 1. Automated Test Site Setup

The system automatically creates and configures test sites with:

* Unique site configuration in the database
* Shopify integration setup with proper credentials
* Notification preferences and display settings
* Automatic cleanup of old test sites

### 2. Purchase Event Simulation

Complete Shopify order webhook simulation with:

* Realistic order payload generation
* HMAC signature validation
* Customer and product data configuration
* Multi-currency support
* Location and shipping information

### 3. Live Event Monitoring

Real-time monitoring dashboard featuring:

* SSE-based event streaming
* Event statistics and analytics
* Connection status indicators
* Event filtering and search
* Export capabilities

### 4. Client-Side Testing

Standalone test page providing:

* Social proof script integration
* Notification display testing
* Performance monitoring
* Cross-browser compatibility testing

## Setup Instructions

### Prerequisites

1. __Database Setup__
   * PostgreSQL with TimescaleDB extension
   * Required tables: `sites`, `integrations`, `notifications`
   * Database migrations applied

2. __Microservices Running__
   * Integrations service (port 3001)
   * Notifications service (port 3002)
   * Notification stream service (port 3003)
   * Redis server for pub/sub

3. __Environment Configuration__
   ```env
   CLERK_SECRET_KEY=your_clerk_secret
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_public_key
   DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
   REDIS_URL=redis://localhost:6379
   ```

### Installation

1. __Install Dependencies__
   ```bash
   npm install
   ```

2. __Run Database Migrations__
   ```bash
   npm run db:migrate
   ```

3. __Start Services__
   ```bash
   # Start microservices
   npm run services:start

   # Start Next.js app
   npm run dev
   ```

## Usage Guide

### Getting Started

1. __Access Control Panel__
   * Navigate to `/test-control-panel`
   * Sign in with Clerk authentication
   * System will automatically create your test site

2. __Initialize Test Environment__
   * Go to the "Settings" tab
   * Verify test site configuration
   * Check connection status to microservices

### Simulating Events

1. __Open Event Simulator__
   * Navigate to "Event Simulator" tab
   * Fill out customer information form
   * Add products with prices and quantities
   * Click "Send Purchase Event"

2. __Sample Data Generation__
   * Use "Fill Sample Data" button for quick testing
   * Generates realistic customer and product data
   * Randomizes order amounts and locations

### Monitoring Events

1. __Live Monitor Dashboard__
   * Navigate to "Live Monitor" tab
   * View real-time event stream
   * Monitor connection status
   * Analyze event statistics

2. __Event Details__
   * Each event shows customer, product, and transaction data
   * Timestamps and location information
   * Event type indicators and status badges

### Client Testing

1. __Open Test Page__
   * Navigate to "Test Page" tab
   * Click "Open Test Page" to launch client page
   * Page automatically loads with your site configuration

2. __Verify Notifications__
   * Send events from control panel
   * Watch for notifications on test page
   * Verify notification content and styling
   * Check performance and timing

## API Reference

### Test Site Management

#### GET `/api/test-control-panel/test-site`

Get or create test site for authenticated user.

__Response:__

```json
{
  "success": true,
  "site": {
    "id": "site_123",
    "name": "Test Site",
    "domain": "test-site-123.local",
    "shop_domain": "test-shop-123.myshopify.com",
    "status": "active"
  }
}
```

#### POST `/api/test-control-panel/test-site`

Create new test site (with cleanup options).

__Request:__

```json
{
  "userName": "John Doe",
  "cleanupOld": true
}
```

#### DELETE `/api/test-control-panel/test-site?siteId=123`

Delete specific test site.

### Event Simulation

#### POST `/api/test-control-panel/simulate-webhook`

Simulate Shopify webhook event.

__Request:__

```json
{
  "shop_domain": "test-shop.myshopify.com",
  "order_data": {
    "customer": {
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "city": "New York",
      "country": "United States"
    },
    "products": [{
      "id": "1",
      "title": "Blue T-Shirt",
      "price": "29.99",
      "quantity": 1
    }],
    "currency": "USD",
    "total_price": "29.99"
  }
}
```

__Response:__

```json
{
  "success": true,
  "order_id": 1234567,
  "shop_domain": "test-shop.myshopify.com",
  "integrations_response": { ... }
}
```

## Testing Scenarios

### Basic Flow Test

1. Create test site
2. Simulate purchase event
3. Verify webhook processing
4. Check notification generation
5. Confirm client display

### Error Handling Test

1. Send invalid webhook data
2. Test network failures
3. Verify error logging
4. Check fallback mechanisms

### Performance Test

1. Send multiple events rapidly
2. Monitor processing latency
3. Check notification delivery times
4. Verify system stability

### Cross-Browser Test

1. Open client page in multiple browsers
2. Test notification compatibility
3. Verify script loading
4. Check responsive design

## Troubleshooting

### Common Issues

1. __Test Site Creation Fails__
   * Check database connectivity
   * Verify user authentication
   * Review error logs

2. __Events Not Processing__
   * Ensure microservices are running
   * Check Redis connectivity
   * Verify webhook signatures

3. __Notifications Not Displaying__
   * Verify embed script loading
   * Check browser console for errors
   * Confirm SSE connection

4. __SSE Connection Issues__
   * Check browser support for EventSource
   * Verify CORS configuration
   * Review server logs

### Debug Mode

Enable detailed logging:

```env
DEBUG=social-proof:*
LOG_LEVEL=debug
```

### Health Checks

Monitor service health:

* `/api/health` - Main application health
* `http://localhost:3001/health` - Integrations service
* `http://localhost:3002/health` - Notifications service
* `http://localhost:3003/health` - Stream service

## Security Considerations

### Webhook Security

* HMAC signature validation on all webhooks
* Timestamp verification to prevent replay attacks
* Rate limiting on webhook endpoints
* Input validation and sanitization

### Authentication

* Clerk-based authentication for control panel
* Protected API routes with middleware
* Session management and token validation

### Data Privacy

* Automatic cleanup of test data
* No real customer data in test environment
* Secure handling of sensitive information

## Performance Optimization

### Caching Strategy

* Redis caching for frequently accessed data
* Client-side caching of static resources
* Edge caching for embed scripts

### Database Optimization

* Indexed queries for site lookups
* Connection pooling for high concurrency
* Optimized schema for notification storage

### Real-time Performance

* Efficient SSE implementation
* Connection pooling for streaming
* Automatic reconnection handling

## Deployment

### Production Considerations

1. __Environment Variables__
   * Configure all required environment variables
   * Use secrets management for sensitive data
   * Set appropriate log levels

2. __Database Migration__
   * Run migrations in production
   * Verify data integrity
   * Set up monitoring

3. __Service Dependencies__
   * Ensure all microservices are deployed
   * Configure service discovery
   * Set up health monitoring

4. __Monitoring__
   * Set up application monitoring
   * Configure error tracking
   * Implement performance monitoring

## Extending the System

### Adding New Event Types

1. Update event simulation interface
2. Extend webhook payload generation
3. Add monitoring support
4. Update documentation

### Custom Notification Types

1. Extend notification data structure
2. Update embed script rendering
3. Add configuration options
4. Test cross-browser compatibility

### Integration Testing

1. Add new test scenarios
2. Extend monitoring capabilities
3. Update error handling
4. Enhance reporting features
