# Social Proof Microservices

This directory contains all the microservices for the Social Proof application, containerized with Docker and deployed with HTTPS subdomain routing.

## Services Architecture

The application consists of the following services, each accessible via HTTPS with dedicated subdomains:

### Core Microservices

* __Users Service__ (`users-staging.pulsesocialproof.com`): Handles user authentication and management
* __Notifications Service__ (`notifications-staging.pulsesocialproof.com`): Core service for notification generation and management
* __Analytics Service__ (`analytics-staging.pulsesocialproof.com`): Processes and stores analytics data
* __Billing Service__ (`billing-staging.pulsesocialproof.com`): Manages subscription and payment processing
* __Integrations Service__ (`integrations-staging.pulsesocialproof.com`): Handles third-party platform integrations (Shopify, WooCommerce, etc.)

### Infrastructure Services

* __Redis__: Used for caching and pub/sub messaging
* __Kafka__: Event streaming platform for service communication
* __PostgreSQL__: Primary database for structured data
* __ClickHouse__: Analytics database for high-performance queries

## HTTPS and SSL Configuration

All microservices are deployed with enterprise-grade HTTPS configuration:

### ✅ Automatic SSL Certificates

* __Let's Encrypt Integration__: Free SSL certificates automatically generated for all subdomains
* __Auto-Renewal__: Certificates automatically renew before expiration (90-day cycle)
* __Multi-Domain Support__: Single certificate covers all microservice subdomains

### ✅ Security Features

* __HTTP to HTTPS Redirect__: All HTTP requests automatically redirected to HTTPS (308 Permanent Redirect)
* __Security Headers__: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
* __Rate Limiting__: Protection against abuse and DDoS attacks (100 requests/minute per IP)
* __TLS 1.2+__: Modern encryption with strong cipher suites

### ✅ Microservice Endpoints

| Service       | HTTPS Endpoint                                       | Purpose                              |
| ------------- | ---------------------------------------------------- | ------------------------------------ |
| Users         | `https://users-staging.pulsesocialproof.com`         | User management and authentication   |
| Notifications | `https://notifications-staging.pulsesocialproof.com` | Real-time notification delivery      |
| Analytics     | `https://analytics-staging.pulsesocialproof.com`     | Data processing and insights         |
| Billing       | `https://billing-staging.pulsesocialproof.com`       | Payment processing and subscriptions |
| Integrations  | `https://integrations-staging.pulsesocialproof.com`  | Third-party platform connections     |

### Testing HTTPS Endpoints

```bash
# Test all microservice endpoints
curl -I https://users-staging.pulsesocialproof.com/health
curl -I https://notifications-staging.pulsesocialproof.com/health
curl -I https://analytics-staging.pulsesocialproof.com/health
curl -I https://billing-staging.pulsesocialproof.com/health
curl -I https://integrations-staging.pulsesocialproof.com/health

# Verify HTTP to HTTPS redirect
curl -I http://users-staging.pulsesocialproof.com/
# Should return: HTTP/1.1 308 Permanent Redirect
```

## Running with Docker

### Prerequisites

* Docker and Docker Compose installed on your machine
* Node.js 18+ and npm (for local development)

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

   * Build all service images
   * Start all containers in detached mode
   * Display the status of all running containers

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

## Kubernetes Deployment

The microservices are deployed to Google Kubernetes Engine (GKE) with the following features:

### Deployment Architecture

```sh
Internet → nginx-ingress-controller → Kubernetes Services
    ↓
HTTP (Port 80) → 308 Permanent Redirect → HTTPS (Port 443)
    ↓
Let's Encrypt SSL Certificates → Microservice Pods
```

### Kubernetes Resources

Each microservice includes:

* __Deployment__: Container orchestration and scaling
* __Service__: Internal load balancing and service discovery
* __Ingress__: HTTPS routing and SSL termination
* __ConfigMap__: Environment-specific configuration
* __Secret__: Sensitive data management

### Health Checks

All microservices implement health check endpoints:

```bash
# Kubernetes health checks
kubectl get pods -n social-proof-system

# Individual service health
curl https://users-staging.pulsesocialproof.com/health
curl https://notifications-staging.pulsesocialproof.com/health
curl https://analytics-staging.pulsesocialproof.com/health
curl https://billing-staging.pulsesocialproof.com/health
curl https://integrations-staging.pulsesocialproof.com/health
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

```dotenv
# Infrastructure
POSTGRES_PASSWORD=secure_password

# API Keys
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Security
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long

# SSL/HTTPS (automatically configured in Kubernetes)
FORCE_HTTPS=true
TRUST_PROXY=true
```

## Tech Stack

* __Runtime__: Node.js & TypeScript
* __Framework__: Express for API endpoints
* __Messaging__: Kafka for event streaming, Redis for pub/sub
* __Database__: PostgreSQL for persistent storage, ClickHouse for analytics
* __Containerization__: Docker and Docker Compose
* __Orchestration__: Kubernetes (GKE)
* __SSL/HTTPS__: nginx-ingress-controller with cert-manager
* __Monitoring__: Health checks and logging

## Prerequisites

* Node.js 18+
* Docker and Docker Compose
* PostgreSQL 14+
* Kafka
* Redis
* kubectl and gcloud CLI (for Kubernetes deployment)

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

## Production Deployment

For production deployment with HTTPS and SSL certificates:

### Automatic Deployment

Push to the `develop` branch to trigger automatic deployment:

```bash
git push origin develop
```

This will:

1. Build Docker images for all microservices
2. Deploy to GKE cluster
3. Configure nginx-ingress-controller
4. Generate SSL certificates via Let's Encrypt
5. Set up HTTP to HTTPS redirects

### Manual Deployment

For manual deployment, see the detailed guides:

* [GCP Deployment Guide](../gcp/GCP_DEPLOYMENT_GUIDE.md)
* [HTTPS Redirect Setup](../gcp/kubernetes/HTTPS_REDIRECT_README.md)

### Monitoring Production

```bash
# Check all microservice pods
kubectl get pods -n social-proof-system

# Check SSL certificates
kubectl get certificates -n social-proof-system

# Check ingress status
kubectl get ingress -n social-proof-system

# Test HTTPS endpoints
for service in users notifications analytics billing integrations; do
  echo "Testing $service..."
  curl -I https://$service-staging.pulsesocialproof.com/health
done
```

## Security

### Enterprise-Grade Security Features

* __HTTPS Everywhere__: All traffic encrypted with TLS 1.2+
* __Automatic SSL Certificates__: Let's Encrypt integration with auto-renewal
* __Security Headers__: HSTS, X-Frame-Options, CSP, and more
* __Rate Limiting__: Protection against abuse and DDoS attacks
* __JWT Authentication__: Secure inter-service communication
* __Network Policies__: Kubernetes-level network segmentation

### SSL Certificate Management

* __Certificate Authority__: Let's Encrypt (free, trusted)
* __Validation Method__: HTTP-01 challenge
* __Renewal__: Automatic (30 days before expiration)
* __Coverage__: All microservice subdomains
* __Monitoring__: Automated certificate health checks

## Troubleshooting

### Common Issues

#### Service Not Responding

```bash
# Check pod status
kubectl get pods -n social-proof-system

# Check service logs
kubectl logs -f deployment/[service-name] -n social-proof-system

# Check ingress configuration
kubectl describe ingress social-proof-nginx-ingress -n social-proof-system
```

#### SSL Certificate Issues

```bash
# Check certificate status
kubectl get certificates -n social-proof-system

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Force certificate regeneration
kubectl delete certificate social-proof-nginx-tls -n social-proof-system
```

#### DNS Issues

```bash
# Check nginx-ingress external IP
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Test DNS resolution
nslookup users-staging.pulsesocialproof.com

# Clear DNS cache (macOS)
sudo dscacheutil -flushcache
```

For detailed troubleshooting, see [HTTPS Redirect README](../gcp/kubernetes/HTTPS_REDIRECT_README.md#troubleshooting).

## Documentation

* [GCP Deployment Guide](../gcp/GCP_DEPLOYMENT_GUIDE.md) - Complete deployment instructions
* [HTTPS Redirect Setup](../gcp/kubernetes/HTTPS_REDIRECT_README.md) - SSL/HTTPS configuration
* [Individual Service READMEs](./services/) - Service-specific documentation

## Support

For microservice-specific issues:

1. Check service health endpoints
2. Review Kubernetes pod logs
3. Verify SSL certificate status
4. Check nginx-ingress configuration
5. Open an issue in this repository

---

__Last Updated__: May 25, 2025\
__Microservices__: 5 services with HTTPS endpoints\
__SSL Status__: ✅ Active with auto-renewal
