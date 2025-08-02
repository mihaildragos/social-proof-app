# Docker Setup for Social Proof Microservices

This document explains the Docker configuration for the Social Proof application microservices.

## Available Docker Configurations

The project includes several Docker Compose files for different purposes:

1. **docker-compose.services-only.yml**: Runs only the microservice containers without infrastructure dependencies
2. **docker-compose.all-services.yml**: Runs all services including infrastructure (Redis, Kafka, PostgreSQL, ClickHouse)
3. **docker-compose.simple.yml**: A simplified setup for testing a single service

## Building and Running Services

The easiest way to build and run the services is using the provided script:

```bash
# Make the script executable (if not already)
chmod +x build-and-run.sh

# Run the script
./build-and-run.sh
```

This will build and start all services defined in the `docker-compose.services-only.yml` file.

## Manual Service Management

You can also manually control the services:

```bash
# Build all services
docker-compose -f docker-compose.services-only.yml build

# Start all services
docker-compose -f docker-compose.services-only.yml up -d

# View logs
docker-compose -f docker-compose.services-only.yml logs -f

# Stop all services
docker-compose -f docker-compose.services-only.yml down
```

## Service Ports

The services are exposed on the following ports:

- Integrations Service: 3001
- Notification Stream Service: 3002
- Notifications Service: 3000
- Users Service: 3003
- Analytics Service: 3004
- Billing Service: 3005

## Development Dockerfiles

For each service, there are two types of Dockerfiles:

1. **Dockerfile**: The production-ready multi-stage build that properly compiles TypeScript code
2. **Dockerfile.basic**: A simplified version for development and testing

## Infrastructure Services

When running with `docker-compose.all-services.yml`, the following infrastructure services are also started:

- **Redis**: For caching and pub/sub messaging (port 6379)
- **Kafka**: For event streaming (port 9092)
- **PostgreSQL**: For relational data storage (port 5432)
- **ClickHouse**: For analytics data (ports 8123, 9000)

## Known Issues

When using the full `docker-compose.all-services.yml`, you might encounter:

1. The Kafka image may take a long time to download the first time
2. Some services might fail to connect to their dependencies initially and need to be restarted

## Service Dependencies

- **Integrations Service**: Kafka, Redis
- **Notification Stream Service**: Redis
- **Notifications Service**: Kafka, Redis
- **Users Service**: PostgreSQL
- **Analytics Service**: ClickHouse, Kafka
- **Billing Service**: PostgreSQL 