# Notifications Service

The Notifications Service is responsible for handling real-time notifications for the social-proof application. It consumes events from Kafka, processes them using notification templates, and publishes them to Redis for real-time delivery to clients.

## Features

- Kafka consumer for order events
- Notification template rendering with Handlebars
- Redis publisher for real-time notifications
- Targeting rules for personalized notifications
- PostgreSQL storage for notifications and templates

## Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- Kafka broker
- Redis server

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Kafka configuration
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=notifications-service
KAFKA_TOPICS=events.orders,events.customers
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
KAFKA_SSL=false

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notifications
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the application:

```bash
npm run build
```

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Docker

To build and run the service using Docker:

```bash
# Build the Docker image
docker build -t notifications-service .

# Run the container
docker run -p 3000:3000 --env-file .env notifications-service
```

## API Documentation

This service doesn't expose a REST API directly. It communicates through Kafka and Redis to handle notifications.

## Database Schema

The service requires the following tables in PostgreSQL:

- `templates`: Stores notification templates
- `notifications`: Stores generated notifications
- `targeting_rule_groups`: Groups of targeting rules
- `targeting_rules`: Individual targeting rules
- `notification_events`: Time-series data for notification events

Refer to `db/schema.sql` for the complete database schema.

## Testing

```bash
npm test
```
