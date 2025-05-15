# Social Proof App - Microservices

This repository contains the microservices implementation for the Social Proof App, a Fomo-style real-time social proof notification platform.

## Architecture

The application is built using a microservices architecture with the following components:

1. **Integrations Service**: Handles integration with third-party platforms like Shopify
2. **Notifications Service**: Processes events and manages notification delivery
3. **Frontend Service**: Serves the frontend and handles SSE connections

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