# Social Proof Microservices

This directory contains all the microservices for the Social Proof application, containerized with Docker.

## Services Architecture

The application consists of the following services:

- **Integrations Service**: Handles third-party platform integrations (Shopify, WooCommerce, etc.)
- **Notification Stream Service**: Manages real-time notification delivery via SSE
- **Notifications Service**: Core service for notification generation and management
- **Users Service**: Handles user authentication and management
- **Analytics Service**: Processes and stores analytics data
- **Billing Service**: Manages subscription and payment processing

## Infrastructure Services

- **Redis**: Used for caching and pub/sub messaging
- **Kafka**: Event streaming platform for service communication
- **PostgreSQL**: Primary database for structured data
- **ClickHouse**: Analytics database for high-performance queries

## Running with Docker

### Prerequisites

- Docker and Docker Compose installed on your machine
- Node.js 18+ and npm (for local development)

### Building and Running All Services

1. Make sure you're in the `microservices` directory:

   ```bash
   cd microservices
   ```

2. Run the build and run script:

   ```bash
   ./build-and-run.sh
   ```

   This will:
   - Build all service images
   - Start all containers in detached mode
   - Display the status of all running containers

### Running Individual Services

To build and run a specific service:

```bash
docker-compose build [service_name]
docker-compose up -d [service_name]
```

For example, to run just the integrations service:

```bash
docker-compose build integrations
docker-compose up -d integrations
```

### Viewing Logs

To view logs for all services:

```bash
docker-compose logs -f
```

For a specific service:

```bash
docker-compose logs -f [service_name]
```

### Stopping Services

To stop all services:

```bash
docker-compose down
```

To stop and remove all data (volumes):

```bash
docker-compose down -v
```

## Development

For local development without Docker:

1. Install dependencies in each service directory:

   ```bash
   cd services/[service_name]
   npm install
   ```

2. Run the service in development mode:

   ```bash
   npm run dev
   ```

## Environment Variables

The docker-compose.yml file is configured with default environment variables for development. For production, you should:

1. Create a `.env` file in the microservices directory
2. Set the following variables (add more as needed):

```
# Infrastructure
POSTGRES_PASSWORD=secure_password

# API Keys
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Security
NODE_ENV=production
```

## Tech Stack

- Node.js & TypeScript
- Express for API endpoints
- Kafka for event streaming
- Redis for pub/sub
- PostgreSQL for persistent storage
- Docker and Docker Compose for containerization

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 14+
- Kafka
- Redis

## Getting Started

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/social-proof-app.git
cd social-proof-app/microservices
```

2. Install dependencies using the provided script:

```bash
chmod +x install-deps.sh
./install-deps.sh
```

Or install dependencies manually:

```bash
npm install
```

3. Create environment variables:

```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration settings.

### Running with Docker

The easiest way to run the entire application is using Docker Compose:

```bash
# Start development environment
docker-compose up

# Start production environment
docker-compose -f docker-compose.production.yml up -d
```

### Running for Development

1. Start the required infrastructure:

```bash
docker-compose up -d kafka redis postgres
```

2. Start all microservices:

```bash
npm start
```

Or start individual services:

```bash
# For Integrations Service
npm run dev:integrations

# For Notifications Service
npm run dev:notifications

# For Frontend Service
npm run dev:frontend
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests for a specific service
npm test -- --testPathPattern=services/integrations
```

## API Documentation

### Integrations Service

- `POST /webhooks/shopify/orders/create`: Endpoint for Shopify order creation webhook

### Frontend Service

- `GET /api/notifications/sse`: SSE endpoint for real-time notifications

## Shopify Integration

The Shopify integration uses webhooks to receive order data and display real-time notifications. See the [Shopify Integration Guide](./docs/shopify-integration-architecture.md) for details.

## Testing with a Development Store

See the [Development Store Setup Guide](./docs/shopify-development-store-setup.md) for instructions on setting up a Shopify development store for testing.

## Deployment

The application can be deployed to Kubernetes using the provided manifests:

```bash
# Deploy to staging
kubectl apply -f infrastructure/kubernetes/staging

# Deploy to production
kubectl apply -f infrastructure/kubernetes/production
```

## CI/CD Pipeline

The repository includes GitHub Actions workflows for CI/CD:

- `ci.yml`: Runs tests, builds Docker images, and deploys to staging

## Troubleshooting

### TypeScript Errors

If you encounter TypeScript errors related to missing modules or type declarations, make sure you've installed all dependencies and try running:

```bash
npm install --save-dev @types/express @types/cors @types/node @types/uuid @types/pg @types/jest @types/supertest
```

### Express Application Error

If you see an error like `This expression is not callable. Type 'typeof import("express")' has no call signatures`, it's related to TypeScript module resolution. The custom type declarations in `types/express.d.ts` should fix this.

### SSE Implementation Issues

The Server-Sent Events (SSE) implementation requires the following to work correctly:

1. Custom type declarations for Response.write and Response.flushHeaders
2. Proper Redis PubSub channel naming convention
3. Connection cleanup on client disconnect

## License

MIT

## Docker Support

All microservices can be run in Docker containers for easier development and deployment. For detailed instructions on using Docker with this project, see the [Docker documentation](DOCKER_MVP_SETUP.md).

To quickly build and run all services in Docker:

```bash
# Make the script executable (if not already)
chmod +x build-and-run.sh

# Run the script
./build-and-run.sh
```

This will build and start containers for all microservices.
