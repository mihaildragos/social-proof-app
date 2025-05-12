# Social Proof App

A real-time social proof notification platform similar to Fomo, built with scalable microservices architecture.

## Overview

This application allows merchants to deliver low-latency, edge-cached real-time social proof notifications across web pop-ups, email, and push notifications. It includes integrated A/B testing, analytics, and enterprise features under a unified dashboard.

## Architecture

The system is built using a microservices architecture with the following services:

1. **Users Service**: Authentication, user management, organizations
2. **Notifications Service**: Notification templates, A/B tests, targeting rules
3. **Analytics Service**: Real-time metrics, reporting, event tracking
4. **Integrations Service**: Third-party integrations, webhooks, API
5. **Billing Service**: Subscription management, invoicing, usage tracking

## Tech Stack

- **Backend Framework**: Next.js 14 (API routes)
- **Languages**: TypeScript
- **Database**: PostgreSQL with Supabase, TimescaleDB, ClickHouse for analytics
- **Caching**: Redis
- **Messaging**: Apache Kafka / Redis Streams
- **Authentication**: Clerk Auth
- **UI**: Tailwind CSS, Shadcn UI
- **Monitoring**: OpenTelemetry, Prometheus, Grafana
- **Deployment**: Kubernetes (EKS), Terraform
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20 or later
- PostgreSQL client (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/social-proof-app.git
   cd social-proof-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development environment:
   ```bash
   docker-compose up -d
   ```

4. Initialize the database:
   ```bash
   npm run db:init
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the app

### Development

The application follows a microservices architecture, with each service having its own directory:

- `services/users/`: User authentication, management, and organizations
- `services/notifications/`: Notification templates, A/B tests
- `services/analytics/`: Metrics, reporting, and event tracking
- `services/integrations/`: Third-party integration connectors
- `services/billing/`: Subscription and payment processing

Each service is designed to work independently, communicating through well-defined APIs.

## Deployment

### Local Development

```bash
docker-compose up -d
```

### Production Deployment

The application can be deployed to Kubernetes using the provided Helm charts:

```bash
cd infrastructure/kubernetes
helm install social-proof-app ./charts/social-proof-app
```

## Documentation

- [API Documentation](./documentation/api.md)
- [Database Schema](./documentation/schema.md)
- [Architecture Overview](./documentation/architecture.md)

## Monitoring

The application includes comprehensive monitoring:

- Grafana: [http://localhost:3000](http://localhost:3000) (admin/admin)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Jaeger (Tracing): [http://localhost:16686](http://localhost:16686)

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m 'Add some amazing feature'`)
4. Push to the Branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Fomo and similar social proof applications
- Built with enterprise-grade architecture for high availability and scalability

## Implementation Status

### Core Infrastructure

- [x] Infrastructure as Code (Terraform)
  - [x] EKS Cluster Configuration
  - [x] API Gateway Setup (Kong)
  - [x] Kafka and Redis Streams
  - [x] Supabase/PostgreSQL with Row-Level Security (RLS)
  - [x] TimescaleDB and ClickHouse
  - [x] Redis for Caching
  - [x] Docker Base Images
  - [x] Observability Stack

### Shared Libraries

- [x] Logging (Winston + OpenTelemetry context)
- [x] Error Handling
- [x] Tracing (OpenTelemetry)
- [x] Database Models
- [ ] Event Schemas
- [x] Validators

### Microservices

- [x] Users Service (Completed)
- [ ] Notifications Service (Planned)
- [ ] Analytics Service (Planned)
- [ ] Integrations Service (Planned)
- [ ] Billing Service (Planned) 