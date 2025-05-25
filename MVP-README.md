# Social Proof MVP - Local Development Environment

## 🎯 Overview

This MVP provides a complete local development environment for the Social Proof application - an enterprise-grade clone of Fomo that delivers real-time social-proof notifications across web popups, email, and push notifications.

## 🏗️ Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Microservices  │    │ Infrastructure  │
│   (Port 3000)   │    │   (Ports 3001-6) │    │   Services      │
│                 │    │                  │    │                 │
│ • Dashboard     │◄──►│ • Integrations   │◄──►│ • PostgreSQL    │
│ • Widget        │    │ • Notifications  │    │ • TimescaleDB   │
│ • Authentication│    │ • Users          │    │ • ClickHouse    │
│ • Admin Panel   │    │ • Analytics      │    │ • Redis         │
│                 │    │ • Billing        │    │ • Kafka         │
│                 │    │ • Notification   │    │                 │
│                 │    │   Stream (SSE)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### ✅ __Core Features__

* __Real-time social proof notifications__ via WebSockets and Server-Sent Events
* __Microservices architecture__ with 5 specialized services
* __Multi-database support__ (PostgreSQL + TimescaleDB + ClickHouse)
* __Third-party integrations__ (Shopify, WooCommerce, Stripe)
* __Enterprise authentication__ with Clerk
* __Advanced analytics__ and real-time dashboards

### ✅ __Infrastructure Features__

* __Kubernetes deployment__ on Google Cloud Platform (GKE)
* __Automatic HTTPS__ with Let's Encrypt SSL certificates
* __HTTP to HTTPS redirect__ with enterprise security headers
* __Multi-domain support__ with subdomain routing for microservices
* __Auto-scaling__ and health monitoring
* __CI/CD pipeline__ with GitHub Actions

### ✅ __Security Features__

* __Workload Identity Federation__ (no service account keys)
* __HTTPS everywhere__ with automatic certificate renewal
* __Security headers__ (HSTS, X-Frame-Options, CSP, etc.)
* __Rate limiting__ and DDoS protection
* __JWT authentication__ for inter-service communication

### Prerequisites

* Docker Desktop (4.0+)
* Docker Compose (2.0+)
* Git
* 8GB+ RAM available for Docker

### __Required Accounts__

* [Google Cloud Platform](https://cloud.google.com/) account with billing enabled
* [GitHub](https://github.com/) account with repository access
* [Clerk](https://clerk.com/) account for authentication
* [Supabase](https://supabase.com/) account for database
* [Stripe](https://stripe.com/) account for payments

### __Required Tools__

* __Node.js 18+__ installed locally
* __Docker and Docker Compose__ for local development
* __gcloud CLI__ installed and authenticated
* __kubectl__ installed for Kubernetes management
* __Terraform__ installed for infrastructure as code
* __Git__ for version control

### __Domain Requirements__

* A domain name you control (e.g., `pulsesocialproof.com`)
* Access to DNS management for the domain
* Ability to create A records pointing to external IPs

## GCP Project Setup

### Step 1: Create GCP Project

```bash
# Set your project ID (replace with your desired project name)
export PROJECT_ID="social-proof-app-gcp"

# Create the project
gcloud projects create $PROJECT_ID

# Set as default project
gcloud config set project $PROJECT_ID

# Enable billing (replace BILLING_ACCOUNT_ID with your billing account)
gcloud beta billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

This will:

* Start infrastructure services (Kafka, Redis, PostgreSQL, ClickHouse)
* Initialize databases with schema and sample data
* Create Kafka topics
* Start all microservices
* Start the Next.js application
* Start external service mocks

__🔒 Important__: We use Workload Identity Federation instead of service account keys for enhanced security.

```bash
# Run comprehensive tests
./scripts/test-mvp.sh
```

This script will:

* ✅ Enable required GCP APIs
* ✅ Create a service account with appropriate permissions
* ✅ Set up Workload Identity Pool and Provider
* ✅ Configure OIDC authentication for GitHub Actions
* ✅ Output the values needed for GitHub Secrets

__Save the output__ - you'll need these values for GitHub configuration:

```dotenv
# GitHub Secrets to configure:
GCP_PROJECT_ID = social-proof-app-gcp
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_SERVICE_ACCOUNT = github-actions-sa@social-proof-app-gcp.iam.gserviceaccount.com
```

## 🛠️ Development

### Managing Services

```bash
# Start MVP stack
./scripts/start-mvp.sh

# Stop MVP stack
./scripts/stop-mvp.sh

# Edit with your values
vim terraform.tfvars
```

Update `terraform.tfvars`:

```hcl
project_id = "social-proof-app-gcp"
region     = "europe-west1"
zone       = "europe-west1-a"
environment = "staging"
cluster_name = "social-proof-cluster"
node_count = 3
machine_type = "n1-standard-2"
disk_size_gb = 50
```

### Step 2: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Apply the infrastructure
terraform apply
```

### Step 3: Get GKE Credentials

```bash
# Configure kubectl to connect to your cluster
gcloud container clusters get-credentials social-proof-cluster \
  --region europe-west1 \
  --project social-proof-app-gcp
```

## GitHub Repository Configuration

### Step 1: Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Secrets

Add the following __Secrets__ (sensitive data):

#### 🔒 Workload Identity Federation

```dotenv
GCP_WORKLOAD_IDENTITY_PROVIDER = [from setup script output]
GCP_SERVICE_ACCOUNT = [from setup script output]
```

#### 🔐 Application Secrets

```dotenv
POSTGRES_PASSWORD = your-secure-postgres-password-min-16-chars
CLERK_SECRET_KEY = sk_test_your_clerk_secret_key
JWT_SECRET = your-jwt-secret-key-minimum-32-characters-long
SENDGRID_API_KEY = SG.your_sendgrid_api_key
STRIPE_SECRET_KEY = sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET = whsec_your_stripe_webhook_secret
SHOPIFY_API_KEY = your_shopify_api_key
SHOPIFY_API_SECRET = your_shopify_api_secret
WOOCOMMERCE_API_KEY = ck_your_woocommerce_api_key
WOOCOMMERCE_API_SECRET = cs_your_woocommerce_api_secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_your_clerk_publishable_key
```

### Step 2: Setup GitHub Variables

Go to your GitHub repository → Settings → Secrets and variables → Actions → Variables

Add the following __Variables__ (non-sensitive configuration):

#### 🌐 GCP Configuration

```dotenv
PROJECT_ID = social-proof-app-gcp
GCP_REGION = europe-west1
GCP_ZONE = europe-west1-a
GKE_CLUSTER = social-proof-cluster
CONTAINER_REGISTRY = gcr.io
```

#### 🏗️ Environment Configuration

```dotenv
NODE_ENV = production
ENVIRONMENT = staging
IMAGE_TAG_STRATEGY = latest
```

#### ⚙️ Application Configuration

```dotenv
LOG_LEVEL = info
METRICS_ENABLED = true
TRACING_ENABLED = true
HEALTH_CHECK_TIMEOUT = 5000
HEALTH_CHECK_INTERVAL = 30000
```

#### 🗄️ Database Configuration

```dotenv
POSTGRES_DB = social_proof_mvp
POSTGRES_USER = postgres
CLICKHOUSE_DATABASE = analytics
```

## Application Deployment

### Step 1: Trigger Deployment

Push code to the `develop` branch to deploy to staging:

```bash
git checkout develop
git push origin develop
```

The GitHub Actions workflow will:

1. __Authenticate__ using Workload Identity Federation
2. __Process YAML Templates__ by substituting variables and secrets
3. __Build and Push Images__ to Google Container Registry
4. __Deploy to GKE__ using processed Kubernetes manifests
5. __Set up HTTPS__ with nginx-ingress-controller and cert-manager
6. __Generate SSL certificates__ via Let's Encrypt
7. __Verify Deployment__ by checking pod health

### Step 2: Monitor Deployment

1. __GitHub Actions__: Go to Actions tab in your repository
2. __GKE Console__: Check Google Cloud Console → Kubernetes Engine → Workloads
3. __kubectl__: Monitor deployments locally:

```bash
# Check pod status
kubectl get pods -n social-proof-system

# Check services
kubectl get services -n social-proof-system

# Check deployments
kubectl get deployments -n social-proof-system

# View logs
./scripts/logs-mvp.sh all -f
./scripts/logs-mvp.sh kafka -n 100
./scripts/logs-mvp.sh services --follow

# Run tests
./scripts/test-mvp.sh
```

### Service URLs

| Service             | URL                     | Purpose                             |
| ------------------- | ----------------------- | ----------------------------------- |
| Next.js App         | <http://localhost:3000> | Main application UI                 |
| Integrations        | <http://localhost:3001> | Shopify/WooCommerce integration     |
| Notification Stream | <http://localhost:3002> | SSE endpoints for real-time updates |
| Notifications       | <http://localhost:3003> | Email/Push notification service     |
| Users               | <http://localhost:3004> | User management and auth            |
| Analytics           | <http://localhost:3005> | Analytics data processing           |
| Billing             | <http://localhost:3006> | Subscription and billing            |
| External Mocks      | <http://localhost:4000> | Mock external services              |

The application implements enterprise-grade HTTP to HTTPS redirect using:

* __nginx-ingress-controller__: Industry-standard ingress controller
* __cert-manager__: Automatic SSL certificate management via Let's Encrypt
* __Multi-domain support__: Single certificate covers all microservice subdomains
* __Automatic renewal__: Certificates auto-renew before expiration

Environment variables are configured in `config/.env.mvp`. Key variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social_proof_mvp

# Kafka
KAFKA_BROKERS=localhost:29092

# External Services (Mocked)
SENDGRID_API_KEY=SG.mock_sendgrid_api_key_for_testing
FIREBASE_PROJECT_ID=mock-firebase-project-mvp
STRIPE_SECRET_KEY=sk_test_mock_stripe_secret_key_for_testing
```

## 📊 Database Schema

__nginx-ingress-controller__ (automatically deployed):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

__cert-manager__ (automatically deployed):

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
```

__Let's Encrypt ClusterIssuer__:

```yaml
# gcp/kubernetes/letsencrypt-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@pulsesocialproof.com  # Update with your email
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### ClickHouse (Analytics)

__Get nginx-ingress External IP:__

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# Note the EXTERNAL-IP value
```

__Required DNS Records__ (replace with your domain and the external IP):

```
A Record: staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: api-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: users-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: notifications-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: analytics-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: billing-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: integrations-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
```

## 🧪 Testing

__Implemented Security Headers:__

* __HSTS (HTTP Strict Transport Security)__: Forces HTTPS for 1 year
* __X-Frame-Options__: Prevents clickjacking attacks
* __X-Content-Type-Options__: Prevents MIME type sniffing
* __Referrer-Policy__: Controls referrer information leakage
* __Rate Limiting__: 100 requests per minute per IP

## Microservices Overview

The application consists of 5 core microservices, each accessible via HTTPS with dedicated subdomains:

### Core Microservices

| Service           | HTTPS Endpoint                                       | Purpose                              | Port |
| ----------------- | ---------------------------------------------------- | ------------------------------------ | ---- |
| __Users__         | `https://users-staging.pulsesocialproof.com`         | User management and authentication   | 3000 |
| __Notifications__ | `https://notifications-staging.pulsesocialproof.com` | Real-time notification delivery      | 3000 |
| __Analytics__     | `https://analytics-staging.pulsesocialproof.com`     | Data processing and insights         | 3000 |
| __Billing__       | `https://billing-staging.pulsesocialproof.com`       | Payment processing and subscriptions | 3000 |
| __Integrations__  | `https://integrations-staging.pulsesocialproof.com`  | Third-party platform connections     | 3000 |

### Infrastructure Services

* __Redis__: Caching and pub/sub messaging
* __Kafka__: Event streaming platform
* __PostgreSQL__: Primary database with TimescaleDB extension
* __ClickHouse__: Analytics database for high-performance queries

### Kubernetes Resources

Each microservice includes:

* __Deployment__: Container orchestration and scaling
* __Service__: Internal load balancing and service discovery
* __ConfigMap__: Environment-specific configuration
* __Secret__: Sensitive data management
* __Ingress__: HTTPS routing and SSL termination (shared)

## Verification and Testing

### Step 1: Check Component Status

```bash
# Full test suite
./scripts/test-mvp.sh

# Individual test categories
Infrastructure Services ✓
External Service Mocks ✓
Database Schema ✓
Kafka Topics ✓
ClickHouse Analytics ✓
End-to-End Event Flow ✓
Container Health ✓
Network Connectivity ✓
```

### Manual Testing

```bash
# Test redirect (should return 308 Permanent Redirect)
curl -I http://staging.pulsesocialproof.com/

# Expected response:
# HTTP/1.1 308 Permanent Redirect
# Location: https://staging.pulsesocialproof.com
```

### Step 3: Test HTTPS Endpoints

```bash
# Test main application
curl -I https://staging.pulsesocialproof.com/

# Test API endpoints
curl -I https://api-staging.pulsesocialproof.com/

# Test all microservices
curl -I https://users-staging.pulsesocialproof.com/health
curl -I https://notifications-staging.pulsesocialproof.com/health
curl -I https://analytics-staging.pulsesocialproof.com/health
curl -I https://billing-staging.pulsesocialproof.com/health
curl -I https://integrations-staging.pulsesocialproof.com/health
```

### Step 4: Verify SSL Certificate

```bash
# Check certificate details
echo | openssl s_client -servername staging.pulsesocialproof.com -connect staging.pulsesocialproof.com:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates

# Expected output:
# issuer=C=US, O=Let's Encrypt, CN=R10
# subject=CN=staging.pulsesocialproof.com
# notBefore=[date]
# notAfter=[date + 90 days]
```

### Step 5: Test Application Functionality

1. __Visit the main application__: `https://staging.pulsesocialproof.com`
2. __Test authentication__: Sign up/sign in with Clerk
3. __Test microservices__: Each should respond with health status
4. __Check browser security__: Should show "Secure" with valid certificate

## Monitoring and Maintenance

### SSL Certificate Monitoring

```bash
# Check certificate status
kubectl get certificates -n social-proof-system

# View certificate details
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check certificate expiration
kubectl get certificates -n social-proof-system -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,EXPIRY:.status.notAfter

# Monitor cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Application Health Monitoring

```bash
# Check all microservice pods
kubectl get pods -n social-proof-system

# Check resource usage
kubectl top pods -n social-proof-system
kubectl top nodes

# View application logs
kubectl logs -f deployment/notifications-service -n social-proof-system

# Check service endpoints
kubectl get endpoints -n social-proof-system
```

### Automatic Certificate Renewal

* __Renewal Trigger__: Certificates renew when 30 days or less remaining
* __Process__: Fully automated via cert-manager
* __Validation__: HTTP-01 challenge via nginx-ingress
* __Monitoring__: Check cert-manager logs for renewal activities

## Troubleshooting

### Common Issues and Solutions

#### 1. Certificate Not Ready

__Symptoms:__

* `kubectl get certificates` shows `READY: False`
* Browser shows "Not Secure" warning
* Using nginx default certificate

__Diagnosis:__

```bash
# Check certificate status
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check Let's Encrypt issuer
kubectl get clusterissuer letsencrypt-prod

# Check ACME challenges
kubectl get challenges -n social-proof-system
```

__Solutions:__

* Ensure DNS points to nginx-ingress IP
* Verify domain is accessible via HTTP
* Check Let's Encrypt rate limits
* Verify email address in ClusterIssuer

#### 2. DNS Caching Issues

__Symptoms:__

* Browser still connects to old IP
* `curl` works but browser doesn't
* "Connection reset" errors

__Solutions:__

```bash
# Clear DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Clear DNS cache (Linux)
sudo systemctl restart systemd-resolved

# Temporary fix: Add to /etc/hosts
echo "[nginx-ingress-ip] staging.pulsesocialproof.com" | sudo tee -a /etc/hosts
```

#### 3. Pods Stuck in Pending State

__Diagnosis:__

```bash
kubectl describe pod <pod-name> -n social-proof-system
```

__Common Solutions:__

* Check node resources: `kubectl describe nodes`
* Check persistent volume claims: `kubectl get pvc -n social-proof-system`
* Check image pull secrets: `kubectl get secrets -n social-proof-system`

#### 4. Image Pull Errors

__Diagnosis:__

```bash
kubectl get pods -n social-proof-system | grep ImagePullBackOff
kubectl describe pod <pod-name> -n social-proof-system
```

__Solutions:__

* Verify Workload Identity Federation setup
* Check container registry permissions
* Verify image names and tags

#### 5. Service Not Responding

__Diagnosis:__

```bash
# Check pod status
kubectl get pods -n social-proof-system

# Check service logs
kubectl logs -f deployment/[service-name] -n social-proof-system

# Check ingress configuration
kubectl describe ingress social-proof-nginx-ingress -n social-proof-system
```

__Solutions:__

```bash
# Restart a deployment
kubectl rollout restart deployment/[service-name] -n social-proof-system

# Check service discovery
kubectl get endpoints -n social-proof-system

# Port forward for direct testing
kubectl port-forward service/[service-name] 8080:80 -n social-proof-system
```

#### 6. Browser Shows "Not Secure" Despite Valid Certificate

__Symptoms:__

* Certificate is valid but browser shows warning
* Mixed content warnings
* Duplicate security headers

__Solutions:__

1. __Clear browser cache and data__ for the domain

2. __Hard refresh__: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)

3. __Try incognito mode__ to bypass cached data

4. __Check for duplicate headers__:

   ```bash
   curl -I https://staging.pulsesocialproof.com/ | grep -i strict-transport-security
   # Should only show one HSTS header
   ```

5. __Database Queries__:

   ```bash
   docker exec -it social-proof-postgres psql -U postgres -d social_proof_mvp
   ```

6. __ClickHouse Analytics__:

   ```bash
   curl "http://localhost:8123/?query=SELECT COUNT(*) FROM analytics.events"
   ```

## 🔧 Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker resources
docker system df
docker system prune -f

# Restart Docker Desktop
# Increase Docker memory allocation to 8GB+
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker exec social-proof-postgres pg_isready -U postgres

# Reset database
./scripts/stop-mvp.sh --clean
./scripts/start-mvp.sh
```

#### Kafka Issues

```bash
# Check Kafka topics
docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer groups
docker exec social-proof-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

## Cost Analysis

### MVP vs Enterprise Comparison

| Component      | MVP Cost (Monthly)    | Enterprise Cost (Monthly)    | Savings |
| -------------- | --------------------- | ---------------------------- | ------- |
| __Compute__    | GKE cluster (3 nodes) | Multi-region EKS             | 85%     |
| __Database__   | Single PostgreSQL     | RDS Multi-AZ + Read Replicas | 90%     |
| __Storage__    | Standard SSD          | Premium SSD + Backup         | 80%     |
| __Networking__ | Single region         | Global load balancer         | 95%     |
| __Monitoring__ | Basic GCP monitoring  | Enterprise APM               | 90%     |
| __Total__      | __$20-30/month__      | __$700-800/month__           | __96%__ |

### Cost Optimization Tips

1. __Use preemptible nodes__ for non-critical workloads
2. __Scale down during off-hours__ using HPA
3. __Use regional persistent disks__ instead of zonal
4. __Monitor resource usage__ and right-size instances
5. __Set up billing alerts__ to avoid surprises

## Scaling and Production

### Horizontal Scaling

```bash
# Check port usage
netstat -an | grep LISTEN | grep -E ":(3000|3001|3002|3003|3004|3005|3006|4000|5432|6379|8123|29092)"

# Stop conflicting services or modify ports in docker-compose-mvp.yml
```

### Logs and Monitoring

```bash
# View all logs
./scripts/logs-mvp.sh all -f

# Check specific service
./scripts/logs-mvp.sh postgres -n 50

# Monitor resources
docker stats

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Performance Optimization

1. __Increase Docker Resources__:
   * Memory: 8GB minimum, 16GB recommended
   * CPU: 4 cores minimum
   * Disk: 50GB free space

2. __Database Tuning__:
   ```sql
   -- PostgreSQL settings for development
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   ```

3. __Kafka Optimization__:
   ```yaml
   # Increase partition count for high throughput
   KAFKA_NUM_PARTITIONS: 6
   KAFKA_DEFAULT_REPLICATION_FACTOR: 1
   ```

## 🔒 Security Notes

### Development Security

* All external services are mocked for safety
* No real API keys or credentials required
* Database passwords are defaults (change for production)
* HTTPS not configured (development only)

### Production Considerations

* Replace mock credentials with real ones
* Enable HTTPS/TLS encryption
* Implement proper secret management
* Configure production database settings
* Set up monitoring and alerting

Create separate environments:

* __Development__: `dev.pulsesocialproof.com`
* __Staging__: `staging.pulsesocialproof.com`
* __Production__: `pulsesocialproof.com`

### Phase 1: Core Development

1. Implement Clerk authentication integration
2. Build dashboard UI components
3. Create notification templates system
4. Develop widget JavaScript embed code

* __Read Replicas__: For read-heavy workloads
* __Connection Pooling__: Use pgbouncer for PostgreSQL
* __Partitioning__: Use TimescaleDB for time-series data

### Phase 3: Advanced Features

1. A/B testing framework
2. Advanced analytics dashboards
3. Real-time performance monitoring
4. Multi-tenant architecture

* __Network Policies__: Restrict pod-to-pod communication
* __Pod Security Standards__: Enforce security contexts
* __Secrets Management__: Use external secret management
* __Image Scanning__: Scan container images for vulnerabilities

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Clerk Authentication](https://clerk.dev/docs)
- [TimescaleDB Guide](https://docs.timescale.com/)
- [ClickHouse Documentation](https://clickhouse.com/docs/)
- [Apache Kafka Quickstart](https://kafka.apache.org/quickstart)

Set up monitoring for:

* __Certificate expiration__ (alert at 30 days)
* __Pod health__ and resource usage
* __Application errors__ and performance
* __Database performance__ and connections

1. Make changes to microservices or frontend
2. Test with `./scripts/test-mvp.sh`
3. Check logs with `./scripts/logs-mvp.sh`
4. Commit and push changes

## 📞 Support

For issues with this MVP setup:

### Migration to Production

1. __Create production GCP project__
2. __Update DNS to production domains__
3. __Configure production secrets__ (real API keys)
4. __Set up monitoring and alerting__
5. __Implement backup strategies__
6. __Test disaster recovery procedures__

## Support and Resources

### Documentation Links

* [nginx-ingress Documentation](https://kubernetes.github.io/ingress-nginx/)
* [cert-manager Documentation](https://cert-manager.io/docs/)
* [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
* [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine/docs)

### Community Support

* [nginx-ingress GitHub Issues](https://github.com/kubernetes/ingress-nginx/issues)
* [cert-manager GitHub Issues](https://github.com/cert-manager/cert-manager/issues)
* [Kubernetes Slack](https://kubernetes.slack.com/)

### Getting Help

For issues:

1. __Check this troubleshooting guide__ first
2. __Review GitHub Actions logs__ for deployment issues
3. __Check Kubernetes pod logs__ for application issues
4. __Verify DNS and certificate status__
5. __Open an issue__ in this repository with detailed logs

---

## Quick Start Checklist

Use this checklist to deploy from scratch:

### ☐ __Prerequisites__

* [ ] GCP account with billing enabled
* [ ] GitHub repository with Actions enabled
* [ ] Domain name with DNS access
* [ ] Required tools installed (gcloud, kubectl, terraform)

### ☐ __GCP Setup__

* [ ] Create GCP project
* [ ] Run Workload Identity Federation setup script
* [ ] Save GitHub secrets and variables

### ☐ __Infrastructure__

* [ ] Configure terraform.tfvars
* [ ] Run `terraform apply`
* [ ] Get GKE credentials

### ☐ __GitHub Configuration__

* [ ] Add all required secrets
* [ ] Add all required variables
* [ ] Verify repository settings

### ☐ __DNS Configuration__

* [ ] Get nginx-ingress external IP
* [ ] Create A records for all domains
* [ ] Verify DNS propagation

### ☐ __Deployment__

* [ ] Push to develop branch
* [ ] Monitor GitHub Actions
* [ ] Verify pod status
* [ ] Check certificate generation

### ☐ __Verification__

* [ ] Test HTTP to HTTPS redirect
* [ ] Verify SSL certificate
* [ ] Test all microservice endpoints
* [ ] Check application functionality

### ☐ __Final Steps__

* [ ] Set up monitoring
* [ ] Configure alerts
* [ ] Document any customizations
* [ ] Plan scaling strategy

---

__Last Updated__: May 25, 2025\
__Version__: 2.0\
__Deployment Status__: ✅ Production Ready\
__SSL Status__: ✅ Auto-renewal Active\
__Microservices__: 5 services with HTTPS endpoints
