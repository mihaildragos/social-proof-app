# Shopify Integration Architecture

This document outlines the technical architecture of the Shopify integration for the Social Proof Notification platform.

## Overview

The Shopify integration enables merchants to display real-time social proof notifications based on store activities such as orders, signups, and reviews. The integration consists of several components working together to provide a seamless experience.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  Shopify Store  │────────▶│   Integrations  │────────▶│  Notifications  │
│                 │         │    Service      │         │    Service      │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        │                           │                           │
        │                           ▼                           ▼
        │                  ┌─────────────────┐         ┌─────────────────┐
        │                  │                 │         │                 │
        └─────────────────▶│      Kafka      │────────▶│      Redis      │
                           │                 │         │                 │
                           └─────────────────┘         └─────────────────┘
                                                               │
                                                               │
                                                               ▼
                                                      ┌─────────────────┐
                                                      │                 │
                                                      │    Frontend     │
                                                      │    Service      │
                                                      │                 │
                                                      └─────────────────┘
                                                               │
                                                               │
                                                               ▼
                                                      ┌─────────────────┐
                                                      │                 │
                                                      │  Storefront     │
                                                      │  (JS Widget)    │
                                                      │                 │
                                                      └─────────────────┘
```

## Components

### 1. Shopify App

The Shopify app provides the interface for merchants to install and configure the social proof service in their stores.

**Key Functions:**

- OAuth authentication and session management
- App installation/uninstallation flow
- Webhook registration and processing
- Script tag installation for frontend widget
- Merchant dashboard for configuration

### 2. Integrations Service

Responsible for connecting with Shopify's API and processing incoming webhooks from Shopify stores.

**Key Functions:**

- Webhook validation (HMAC verification)
- Processing various Shopify events (orders, customers, products)
- Converting Shopify data into standardized event format
- Producing events to Kafka
- Managing Shopify API interactions

### 3. Notifications Service

Processes events from Kafka and determines what notifications to display based on merchant configuration.

**Key Functions:**

- Consuming events from Kafka
- Applying notification rules and filters
- Generating notification content
- Publishing notifications to Redis
- Storing notification history

### 4. Frontend Service

Serves the SSE (Server-Sent Events) endpoint that the storefront widget connects to for real-time updates.

**Key Functions:**

- SSE connection management
- Redis subscription for notification events
- Client connection tracking
- Delivery status tracking

### 5. Storefront Widget (JavaScript)

The client-side JavaScript widget that displays notifications on merchant storefronts.

**Key Functions:**

- Establishing SSE connection
- Rendering notification templates
- Animation and display logic
- Interaction tracking (clicks, dismissals)

## Data Flow

1. **Webhook Reception**

   - Shopify sends webhooks to the Integrations Service
   - Webhooks are verified using HMAC signature
   - Events are standardized and enriched

2. **Event Processing**

   - Events are published to Kafka topics:
     - `order-events`: For order-related events
     - `customer-events`: For customer-related events
     - `product-events`: For product-related events
   - Events include shop domain, event type, and relevant data

3. **Notification Generation**

   - Notifications Service consumes events from Kafka
   - Applies merchant configuration rules
   - Generates notification content
   - Publishes to Redis channels named `notifications:{shop_domain}`

4. **Notification Delivery**

   - Frontend Service maintains SSE connections with storefront widgets
   - Subscribes to the appropriate Redis channels based on shop domain
   - Forwards notifications to connected clients in real-time

5. **Display**
   - Storefront widget receives notification via SSE
   - Renders notification using configured template
   - Displays with animation
   - Tracks user interaction

## Kafka Topics

| Topic Name        | Key         | Value Schema          | Description                                      |
| ----------------- | ----------- | --------------------- | ------------------------------------------------ |
| `order-events`    | Shop Domain | JSON (order event)    | Order creation, fulfillment, cancellation events |
| `customer-events` | Shop Domain | JSON (customer event) | Customer creation, update events                 |
| `product-events`  | Shop Domain | JSON (product event)  | Product creation, update, deletion events        |

## Redis Channels

| Channel Pattern               | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `notifications:{shop_domain}` | Real-time notifications for a specific shop      |
| `metrics:{shop_domain}`       | Metrics and analytics events for a specific shop |

## Security Considerations

1. **Webhook Verification**

   - All webhooks are verified using HMAC signatures
   - Unverified webhooks are rejected

2. **API Authentication**

   - OAuth tokens are encrypted at rest
   - Token refresh is handled automatically

3. **Multi-tenant Isolation**

   - Shop data is isolated using shop domain as partition key
   - Notification channels are shop-specific

4. **Rate Limiting**
   - API calls are rate-limited to prevent abuse
   - Notification display frequency is configurable

## Monitoring and Logging

- Request tracing with correlation IDs
- Structured logging with Winston
- Health check endpoints for all services
- Kafka consumer lag monitoring
- Redis connection monitoring
- Error alerting via webhook

## Scaling Considerations

- Horizontal scaling of all services
- Kafka partitioning by shop domain
- Redis connection pooling
- Database read replicas for high traffic shops

## Future Enhancements

1. Batch processing for high-volume stores
2. Offline mode support with service worker
3. A/B testing for notification templates
4. Enhanced analytics dashboard
5. Multi-region deployment for global stores
