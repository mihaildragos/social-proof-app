# Social Proof App Infrastructure

This directory contains all the infrastructure-as-code (IaC) resources for the Social Proof application.

## Directory Structure

```
infrastructure/
├── docker/             # Docker-related files
│   └── base/           # Base Docker images
├── terraform/          # Terraform configurations
│   ├── modules/        # Reusable Terraform modules
│   │   ├── api_gateway/# API Gateway configuration
│   │   ├── clickhouse/ # ClickHouse database configuration
│   │   ├── eks/        # Kubernetes cluster configuration
│   │   ├── elasticache/# Redis cache configuration
│   │   ├── msk/        # Kafka configuration
│   │   ├── rds/        # PostgreSQL configuration
│   │   ├── s3/         # Object storage configuration
│   │   ├── shared/     # Shared Terraform resources
│   │   └── vpc/        # Network configuration
│   ├── main.tf         # Main Terraform configuration
│   └── variables.tf    # Input variables for Terraform
└── config/             # Configuration files for services
    ├── otel-collector-config.yaml  # OpenTelemetry collector config
    ├── prometheus.yml              # Prometheus configuration
    ├── loki-config.yaml            # Loki logging configuration
    └── grafana/                    # Grafana dashboards
```

## Infrastructure Components

### Core Infrastructure

1. **VPC and Networking**
   - Private, public, and database subnets across multiple availability zones
   - NAT Gateways for private subnet access
   - Security Groups for service isolation

2. **Kubernetes (EKS)**
   - Managed Kubernetes cluster
   - Node groups with auto-scaling
   - OIDC provider for service account IAM roles

3. **API Gateway (Kong)**
   - mTLS authentication
   - Rate limiting
   - Request transformation
   - Traffic routing

### Databases and Storage

4. **PostgreSQL (RDS) with Supabase and Row-Level Security**
   - PostgreSQL 14 with TimescaleDB extension
   - Row-Level Security (RLS) enabled for multi-tenant isolation
   - Supabase-compatible configuration
   - User/organization-based security policies
   - Multi-AZ deployment for high availability
   - Automated backups and point-in-time recovery

5. **Redis (ElastiCache)**
   - Caching and rate limiting
   - Redis Streams for event processing
   - Cluster mode for scalability

6. **ClickHouse**
   - Analytics database for time-series data
   - High-performance OLAP queries
   - S3 integration for cold storage

7. **Kafka (MSK)**
   - Event streaming platform
   - Multi-broker deployment
   - SASL/SCRAM authentication

8. **S3 Storage**
   - Data archival
   - Log storage
   - Static asset hosting

### Observability

9. **Monitoring and Logging**
   - Prometheus for metrics collection
   - Grafana for visualization
   - Loki for log aggregation
   - Jaeger for distributed tracing
   - OpenTelemetry for instrumentation

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform 1.0+ installed
- kubectl installed

### Initialization

```bash
cd terraform
terraform init
```

### Deployment

```bash
# Create a plan
terraform plan -out=tfplan

# Apply the plan
terraform apply tfplan
```

### Connecting to the Cluster

After deployment, retrieve the kubeconfig:

```bash
aws eks update-kubeconfig --name social-proof-{environment} --region {region}
```

## Docker Images

The `docker/base` directory contains base Docker images used by all microservices:

- Node.js base image with OpenTelemetry instrumentation
- Security hardening
- Multi-stage builds for optimized container size
- Health checks and graceful shutdown

## Monitoring Setup

The infrastructure includes a comprehensive monitoring stack:

- Prometheus for metrics storage and alerting
- Grafana for dashboards and visualization
- Loki for log aggregation and querying
- Jaeger for distributed tracing
- OpenTelemetry Collector for data collection and processing 