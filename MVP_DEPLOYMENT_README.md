# Social Proof App - MVP Deployment

This repository contains the implementation of a simplified, cost-effective deployment for the Social Proof App MVP serving fewer than 100 users.

## Overview

The Social Proof App is a real-time social proof notification platform built with a microservices architecture. This MVP deployment simplifies the infrastructure to a single-server model to reduce costs while maintaining all core functionality.

## Cost-Effective Infrastructure

This deployment replaces the enterprise-grade AWS infrastructure with a simplified single-server approach:

- **Cost Reduction**: ~96% cost savings ($20-30/month vs. $700-800/month)
- **Simplified Maintenance**: All services run on a single EC2 instance
- **Same Functionality**: Preserves all core features of the application

See [COST_COMPARISON.md](./COST_COMPARISON.md) for detailed cost analysis.

## Deployment Files

- `docker-compose.prod.yml` - Production Docker Compose configuration
- `nginx/conf.d/default.conf` - Nginx configuration for SSL and reverse proxy
- `backup.sh` - Database backup script
- `health_check.sh` - Service health monitoring script
- `setup_ec2.sh` - EC2 instance setup script
- `SINGLE_SERVER_DEPLOYMENT.md` - Detailed deployment instructions

## Quick Start

1. Launch an EC2 t3.small instance with Amazon Linux 2
2. Run the setup script:
   ```bash
   ./setup_ec2.sh
   ```
3. Clone the repository and navigate to the project directory
4. Configure SSL certificates
5. Deploy the application:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

Detailed instructions are available in [SINGLE_SERVER_DEPLOYMENT.md](./SINGLE_SERVER_DEPLOYMENT.md).

## Architecture

This deployment maintains the microservices structure but runs all services on a single server:

- **Nginx**: Reverse proxy with SSL termination
- **PostgreSQL**: Database for persistent storage
- **Redis**: Used for caching, pub/sub, and event streaming
- **Microservices**: All services run as Docker containers
  - API Gateway
  - Users Service
  - Notifications Service
  - Frontend Service
  - Integrations Service

## Features

All core features of the Social Proof App are preserved:

- Real-time social proof notifications
- Shopify integration
- User and organization management
- Notification templates and customization
- Webhook handling

## Scaling Up

As your user base grows, you can easily scale up this deployment:

1. Increase EC2 instance size
2. Move database to a dedicated RDS instance
3. Migrate to a multi-server architecture
4. Eventually adopt the full enterprise-grade infrastructure

## Maintenance

- Database backups run daily
- Health checks run every 5 minutes
- SSL certificates auto-renew
- Logs are available via Docker Compose

For a complete maintenance guide, see [SINGLE_SERVER_DEPLOYMENT.md](./SINGLE_SERVER_DEPLOYMENT.md).
