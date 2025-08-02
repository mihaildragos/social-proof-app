# Minimal Cost Deployment Guide

This guide explains how to deploy the PulseSocialProof application for under £25/month, suitable for development, testing, or serving up to 100 users.

## Quick start

Minimal Cost Architecture (what we just used)

Start:
docker-compose -f docker-compose-minimal.yml --env-file .env.minimal up -d

Stop:
docker-compose -f docker-compose-minimal.yml --env-file .env.minimal down

Build & Start:
docker-compose -f docker-compose-minimal.yml --env-file .env.minimal up --build -d

Full Development Environment

Start all services:
npm run dev:all

Start only infrastructure (DB, Redis, Kafka):
npm run dev:infra

Start only microservices:
npm run dev:services

Stop and clean all containers:
npm run dev:clean

View logs:
npm run dev:logs

Manual Docker Compose Commands

Development environment:

### Start

docker-compose -f docker-compose.dev.yml up -d

### Stop

docker-compose -f docker-compose.dev.yml down

### Build & Start

docker-compose -f docker-compose.dev.yml up --build -d

MVP environment:

### Start MVP environment

docker-compose -f docker-compose-mvp.yml up -d

### Stop MVP environment

docker-compose -f docker-compose-mvp.yml down

Individual Service Access

Shell access to services:
npm run dev:shell:billing
npm run dev:shell:notifications
npm run dev:shell:users

Check service status:
docker-compose -f docker-compose-minimal.yml --env-file .env.minimal ps

## Cost Breakdown

### Current Enterprise Setup (£125+/month)

* GKE cluster with 6 nodes: \~£60-80/month
* Container Registry: \~£5-10/month
* Load balancers & networking: \~£20-30/month
* Persistent volumes: \~£15-20/month

### Minimal Cost Setup (£20-25/month)

* Single GCP e2-medium VM: £17/month
* 30GB persistent disk: £2/month
* Static IP: £3/month
* __Total: \~£22/month__

## Deployment Options

### Option 1: Single VM with Docker Compose (Recommended)

Deploy all services on one Google Compute Engine instance using the existing MVP configuration.

__Pros:__

* Simple to manage
* All services in one place
* Easy to backup and restore
* Can handle 100+ concurrent users

__Cons:__

* Single point of failure
* Limited scalability

### Option 2: Google Cloud Run (£10-20/month)

Use serverless containers with pay-per-use pricing.

__Pros:__

* Pay only for usage
* Auto-scaling
* No VM management

__Cons:__

* Cold starts
* More complex setup
* Requires code modifications

### Option 3: Mixed Approach (£20-25/month)

* Frontend on Vercel (free tier)
* Backend on single VM
* Database on Railway.app

__Pros:__

* Better performance
* CDN for frontend
* Managed database

__Cons:__

* More complex
* Multiple services to manage

## Deployment Options

### Option A: Automated GitHub Actions Deployment (Recommended)

__Zero-setup deployment__ - Push to `main` branch and GitHub Actions handles everything:

1. __Push to main branch__ triggers automatic deployment
2. __VM provisioning__ happens automatically if needed
3. __Application deployment__ uses optimized minimal configuration
4. __Health checks__ ensure successful deployment

```bash
# Simply push your changes to main branch
git push origin main

# GitHub Actions will:
# ✅ Create VM if needed (e2-medium, £17/month)
# ✅ Deploy minimal stack (5 core services)
# ✅ Run health checks
# ✅ Provide deployment summary with IP address
```

__Branch Strategy:__

* `main` → Minimal deployment (\~£22/month)
* `enterprise` → Full GKE deployment (\~£125/month)
* `develop` → Staging deployment

### Option B: Manual VM Deployment

If you prefer manual control or want to deploy locally:

#### Prerequisites

* Google Cloud account
* gcloud CLI installed
* Basic knowledge of Docker

#### Step 1: Environment Setup

```bash
git clone https://github.com/yourusername/social-proof-app.git
cd social-proof-app

# Interactive environment setup
./scripts/setup-minimal-env.sh
```

#### Step 2: Local Deployment

```bash
# Start the minimal stack locally
./scripts/start-minimal.sh

# Check status
./scripts/status-minimal.sh

# View logs  
./scripts/logs-minimal.sh
```

#### Step 3: VM Deployment (Manual)

```bash
# Create and configure VM
gcloud compute instances create social-proof-minimal \
  --zone=europe-west1-b \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server

# Configure firewall
gcloud compute firewall-rules create minimal-social-proof-allow \
  --allow tcp:80,tcp:443,tcp:22,tcp:3000-3006 \
  --target-tags=http-server,https-server

# SSH and deploy
gcloud compute ssh social-proof-minimal --zone=europe-west1-b
# (Install Docker, clone repo, run ./scripts/start-minimal.sh)
```

## GitHub Actions Deployment

The GitHub Actions workflow automatically uses GitHub Secrets and Variables (no `.env` files needed). Configure these in your repository settings under __Settings > Secrets and variables > Actions__.

### Required GitHub Secrets (Sensitive data)

Go to __Repository Settings > Secrets and variables > Actions > Secrets__:

```bash
# Authentication
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
JWT_SECRET=your_jwt_secret_key

# External Services  
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENDGRID_API_KEY=SG.your_sendgrid_api_key

# Database
POSTGRES_PASSWORD=your_secure_postgres_password

# Supabase
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# GCP Authentication (for automated deployment)
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/123/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_SERVICE_ACCOUNT=github-actions-sa@your-project.iam.gserviceaccount.com

# Optional Integration Services
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
WOOCOMMERCE_API_KEY=your_woocommerce_api_key
WOOCOMMERCE_API_SECRET=your_woocommerce_api_secret
```

### Required GitHub Variables (Non-sensitive data)

Go to __Repository Settings > Secrets and variables > Actions > Variables__:

```bash
# GCP Configuration
PROJECT_ID=your-gcp-project-id
GCP_REGION=europe-west1

# Database
POSTGRES_USER=postgres
POSTGRES_DB=social_proof_mvp

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

### How It Works

1. __GitHub Actions automatically creates `.env.minimal`__ on the VM using your Secrets/Variables
2. __No manual environment file management__ needed for GitHub deployments
3. __Secrets are securely injected__ during deployment
4. __VM gets the complete environment__ without exposing sensitive data

### Workflow Triggers

* __Push to `main`__: Triggers minimal cost deployment (\~£22/month)
* __Push to `enterprise`__: Triggers full GKE deployment (\~£125/month)
* __Push to `develop`__: Triggers staging deployment
* __Manual trigger__: Available in GitHub Actions UI

## Key Files for Minimal Deployment

### 1. GitHub Actions Workflows

* __`.github/workflows/minimal-deploy.yml`__ - Automated minimal deployment
* __`.github/workflows/ci.yml`__ - Modified to prevent expensive deployments on main

### 2. Docker Compose Configuration

* __`docker-compose-minimal.yml`__ - Optimized minimal stack configuration
* __`docker-compose-mvp.yml`__ - Original MVP stack (more resource intensive)

### 3. Deployment Scripts

* __`scripts/start-minimal.sh`__ - Start minimal stack with health checks
* __`scripts/stop-minimal.sh`__ - Stop minimal stack safely
* __`scripts/logs-minimal.sh`__ - View logs for minimal services
* __`scripts/status-minimal.sh`__ - Comprehensive status report
* __`scripts/health-check-minimal.sh`__ - Health monitoring and verification
* __`scripts/rollback-minimal.sh`__ - Rollback failed deployments
* __`scripts/setup-minimal-env.sh`__ - Interactive environment setup

### 4. Environment Configuration

* __`.env.minimal.example`__ - Template for minimal deployment environment
* __`.env.minimal`__ - Your actual environment file (created by setup script)

### 5. Simplified Dockerfiles

* __`Dockerfile.basic`__ in each service directory
* Single-stage builds for faster deployment
* Runs TypeScript directly without compilation

## Optimized Minimal Configuration

### Using docker-compose-minimal.yml

We've created an optimized configuration file `docker-compose-minimal.yml` that:

* __Removes Kafka & Zookeeper__ - Saves \~2GB RAM (uses Redis pub/sub instead)
* __Removes ClickHouse__ - Saves \~1GB RAM (uses PostgreSQL for basic analytics)
* __Adds memory limits__ - Prevents services from consuming too much RAM
* __Uses Alpine images__ - Smaller container sizes
* __Includes nginx__ - For reverse proxy and SSL termination

### Quick Start with Minimal Configuration

```bash
# Option 1: Use the optimized startup script (RECOMMENDED)
chmod +x scripts/start-minimal.sh
./scripts/start-minimal.sh

# Option 2: Use docker-compose directly
docker-compose -f docker-compose-minimal.yml up -d

# Option 3: Use the original MVP script
./scripts/start-mvp.sh
```

### Resource Usage Comparison

| Service           | Standard MVP | Minimal Config |
| ----------------- | ------------ | -------------- |
| PostgreSQL        | 1GB          | 512MB          |
| Redis             | 512MB        | 256MB          |
| Each Microservice | 512MB        | 256MB          |
| Kafka + Zookeeper | 2GB          | 0 (removed)    |
| ClickHouse        | 1GB          | 0 (removed)    |
| __Total RAM__     | \~6GB        | \~2.5GB        |

### Key Changes in Minimal Configuration

1. __Message Queue__: Uses Redis pub/sub instead of Kafka
   * Set `USE_REDIS_PUBSUB=true` in environment
   * Simpler setup, less resource usage
   * Sufficient for <1000 users

2. __Analytics__: Uses PostgreSQL instead of ClickHouse
   * Set `USE_POSTGRES_ANALYTICS=true` in environment
   * Basic analytics stored in PostgreSQL tables
   * Can migrate to ClickHouse when needed

3. __Memory Limits__: Each service has defined limits
   * Prevents memory overuse
   * Better stability on small VMs
   * Automatic restart on OOM

### Environment Variables for Minimal Setup

Create `.env.minimal`:

```env
# Database
POSTGRES_PASSWORD=your_secure_password

# External Services
CLERK_SECRET_KEY=your_clerk_key
STRIPE_SECRET_KEY=your_stripe_key
SENDGRID_API_KEY=your_sendgrid_key

# Feature Flags
USE_REDIS_PUBSUB=true
USE_POSTGRES_ANALYTICS=true

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

### 3. Use Swap Memory

On the VM, enable swap for better memory management:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Monitoring and Maintenance

### Check Service Health

```bash
docker-compose -f docker-compose-mvp.yml ps
curl http://localhost:3000/health
```

### View Logs

```bash
./scripts/logs-mvp.sh
# Or for specific service:
docker-compose -f docker-compose-mvp.yml logs -f billing-service
```

### Backup Database

```bash
docker exec social-proof-postgres pg_dump -U postgres social_proof_mvp > backup.sql
```

### Update Services

```bash
git pull
docker-compose -f docker-compose-mvp.yml build
./scripts/start-mvp.sh
```

## Scaling Up

When you need to scale beyond 100 users:

### 100-500 Users

* Upgrade to e2-standard-2 (£34/month)
* Add more swap space
* Enable Redis persistence

### 500-1000 Users

* Move database to Cloud SQL
* Separate frontend to Cloud Run
* Add CDN for static assets

### 1000+ Users

* Migrate to Kubernetes (GKE)
* Implement horizontal scaling
* Add monitoring and alerting

## Production Considerations

### 1. SSL/TLS Setup

Use Let's Encrypt for free SSL certificates:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### 2. Automated Backups

Set up daily backups with cron:

```bash
0 2 * * * docker exec social-proof-postgres pg_dump -U postgres social_proof_mvp > /backups/db_$(date +\%Y\%m\%d).sql
```

### 3. Monitoring

* Use free tier of Google Cloud Monitoring
* Set up alerts for disk space and memory
* Monitor application logs for errors

### 4. Security

* Change all default passwords
* Use Google Cloud firewall rules
* Keep Docker and dependencies updated
* Enable fail2ban for SSH protection

## Troubleshooting

### GitHub Actions Deployment Issues

__Workflow fails to trigger:__

```bash
# Check branch protection rules
# Ensure you're pushing to 'main' branch
git branch --show-current

# Force trigger manually
# Go to GitHub Actions tab and click "Run workflow"
```

__VM provisioning fails:__

```bash
# Check GCP quotas and permissions
gcloud auth list
gcloud projects get-iam-policy YOUR_PROJECT_ID

# Check VM exists
gcloud compute instances list --filter="name:social-proof-minimal"
```

__Deployment health checks fail:__

```bash
# SSH into VM and check manually
gcloud compute ssh social-proof-minimal --zone=europe-west1-b

# Check services on VM
docker-compose -f docker-compose-minimal.yml ps
./scripts/status-minimal.sh
```

### Local Deployment Issues

__Services Won't Start:__

```bash
# Check logs
./scripts/logs-minimal.sh

# Check detailed status
./scripts/status-minimal.sh

# Restart specific service
docker-compose -f docker-compose-minimal.yml restart service-name
```

__Out of Memory:__

```bash
# Check memory usage
docker stats

# Enable swap if not already enabled
sudo swapon --show
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Free up space
docker system prune -a
```

__Database Connection Issues:__

```bash
# Check PostgreSQL status
docker exec social-proof-postgres pg_isready

# Check Redis status  
docker exec social-proof-redis redis-cli ping

# Restart databases
docker-compose -f docker-compose-minimal.yml restart postgres redis
```

__Environment Configuration Issues:__

```bash
# Regenerate environment
./scripts/setup-minimal-env.sh

# Validate environment file
cat .env.minimal | grep -v '^#' | grep '='
```

### Rollback Procedures

__Automatic rollback via health checks:__

```bash
./scripts/health-check-minimal.sh --rollback
```

__Manual rollback:__

```bash
# List available backups
./scripts/rollback-minimal.sh --list

# Perform rollback with data restoration
./scripts/rollback-minimal.sh --restore-data

# Force rollback without confirmation
./scripts/rollback-minimal.sh --force
```

## Support

For issues or questions:

* Check logs first: `./scripts/logs-mvp.sh`
* Review the [main README](README.md)
* Open an issue on GitHub

## Conclusion

This minimal deployment approach provides a fully functional PulseSocialProof application for under £25/month. It's perfect for:

* Development and testing
* Small businesses (<100 users)
* Proof of concept deployments
* Educational purposes

The setup uses the same codebase and can be easily scaled up when your user base grows.
