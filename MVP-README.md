# Social Proof App - Complete MVP Deployment Guide

This comprehensive guide walks you through deploying the Social Proof App MVP from scratch, including infrastructure setup, microservices deployment, HTTPS configuration, and troubleshooting.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [GCP Project Setup](#gcp-project-setup)
4. [Infrastructure Deployment](#infrastructure-deployment)
5. [GitHub Repository Configuration](#github-repository-configuration)
6. [Application Deployment](#application-deployment)
7. [HTTPS and SSL Configuration](#https-and-ssl-configuration)
8. [Microservices Overview](#microservices-overview)
9. [Verification and Testing](#verification-and-testing)
10. [Monitoring and Maintenance](#monitoring-and-maintenance)
11. [Troubleshooting](#troubleshooting)
12. [Cost Analysis](#cost-analysis)
13. [Scaling and Production](#scaling-and-production)

## Overview

The Social Proof App MVP is an enterprise-grade social proof notification system featuring:

### ✅ **Core Features**
- **Real-time social proof notifications** via WebSockets and Server-Sent Events
- **Microservices architecture** with 5 specialized services
- **Multi-database support** (PostgreSQL + TimescaleDB + ClickHouse)
- **Third-party integrations** (Shopify, WooCommerce, Stripe)
- **Enterprise authentication** with Clerk
- **Advanced analytics** and real-time dashboards

### ✅ **Infrastructure Features**
- **Kubernetes deployment** on Google Cloud Platform (GKE)
- **Automatic HTTPS** with Let's Encrypt SSL certificates
- **HTTP to HTTPS redirect** with enterprise security headers
- **Multi-domain support** with subdomain routing for microservices
- **Auto-scaling** and health monitoring
- **CI/CD pipeline** with GitHub Actions

### ✅ **Security Features**
- **Workload Identity Federation** (no service account keys)
- **HTTPS everywhere** with automatic certificate renewal
- **Security headers** (HSTS, X-Frame-Options, CSP, etc.)
- **Rate limiting** and DDoS protection
- **JWT authentication** for inter-service communication

## Prerequisites

Before starting, ensure you have:

### **Required Accounts**
- [Google Cloud Platform](https://cloud.google.com/) account with billing enabled
- [GitHub](https://github.com/) account with repository access
- [Clerk](https://clerk.com/) account for authentication
- [Supabase](https://supabase.com/) account for database
- [Stripe](https://stripe.com/) account for payments

### **Required Tools**
- **Node.js 18+** installed locally
- **Docker and Docker Compose** for local development
- **gcloud CLI** installed and authenticated
- **kubectl** installed for Kubernetes management
- **Terraform** installed for infrastructure as code
- **Git** for version control

### **Domain Requirements**
- A domain name you control (e.g., `yourdomain.com`)
- Access to DNS management for the domain
- Ability to create A records pointing to external IPs

## GCP Project Setup

### Step 1: Create GCP Project

```bash
# Set your project ID (replace with your desired project name)
export PROJECT_ID="your-social-proof-project"

# Create the project
gcloud projects create $PROJECT_ID

# Set as default project
gcloud config set project $PROJECT_ID

# Enable billing (replace BILLING_ACCOUNT_ID with your billing account)
gcloud beta billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### Step 2: Set up Workload Identity Federation

**🔒 Important**: We use Workload Identity Federation instead of service account keys for enhanced security.

```bash
# Make the script executable
chmod +x gcp/setup-workload-identity.sh

# Run the setup (replace with your GitHub repository)
./gcp/setup-workload-identity.sh $PROJECT_ID "your-username/social-proof-app"
```

This script will:
- ✅ Enable required GCP APIs
- ✅ Create a service account with appropriate permissions
- ✅ Set up Workload Identity Pool and Provider
- ✅ Configure OIDC authentication for GitHub Actions
- ✅ Output the values needed for GitHub Secrets

**Save the output** - you'll need these values for GitHub configuration:
```
GitHub Secrets to configure:
GCP_PROJECT_ID = your-social-proof-project
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_SERVICE_ACCOUNT = github-actions-sa@your-social-proof-project.iam.gserviceaccount.com
```

## Infrastructure Deployment

### Step 1: Configure Terraform

```bash
cd gcp/terraform

# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

Update `terraform.tfvars`:
```hcl
project_id = "your-social-proof-project"
region     = "us-central1"
zone       = "us-central1-a"
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
  --region us-central1 \
  --project your-social-proof-project
```

## GitHub Repository Configuration

### Step 1: Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Secrets

Add the following **Secrets** (sensitive data):

**🔒 Workload Identity Federation**
```
GCP_WORKLOAD_IDENTITY_PROVIDER = [from setup script output]
GCP_SERVICE_ACCOUNT = [from setup script output]
```

**🔐 Application Secrets**
```
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

Add the following **Variables** (non-sensitive configuration):

**🌐 GCP Configuration**
```
PROJECT_ID = your-social-proof-project
GCP_REGION = us-central1
GCP_ZONE = us-central1-a
GKE_CLUSTER = social-proof-cluster
CONTAINER_REGISTRY = gcr.io
```

**🏗️ Environment Configuration**
```
NODE_ENV = production
ENVIRONMENT = staging
IMAGE_TAG_STRATEGY = latest
```

**⚙️ Application Configuration**
```
LOG_LEVEL = info
METRICS_ENABLED = true
TRACING_ENABLED = true
HEALTH_CHECK_TIMEOUT = 5000
HEALTH_CHECK_INTERVAL = 30000
```

**🗄️ Database Configuration**
```
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
1. **Authenticate** using Workload Identity Federation
2. **Process YAML Templates** by substituting variables and secrets
3. **Build and Push Images** to Google Container Registry
4. **Deploy to GKE** using processed Kubernetes manifests
5. **Set up HTTPS** with nginx-ingress-controller and cert-manager
6. **Generate SSL certificates** via Let's Encrypt
7. **Verify Deployment** by checking pod health

### Step 2: Monitor Deployment

1. **GitHub Actions**: Go to Actions tab in your repository
2. **GKE Console**: Check Google Cloud Console → Kubernetes Engine → Workloads
3. **kubectl**: Monitor deployments locally:

```bash
# Check pod status
kubectl get pods -n social-proof-system

# Check services
kubectl get services -n social-proof-system

# Check deployments
kubectl get deployments -n social-proof-system

# View logs
kubectl logs -f deployment/integrations-service -n social-proof-system
```

## HTTPS and SSL Configuration

### Overview

The application implements enterprise-grade HTTP to HTTPS redirect using:
- **nginx-ingress-controller**: Industry-standard ingress controller
- **cert-manager**: Automatic SSL certificate management via Let's Encrypt
- **Multi-domain support**: Single certificate covers all microservice subdomains
- **Automatic renewal**: Certificates auto-renew before expiration

### Architecture

```
Internet Traffic Flow:
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   HTTP Request  │───▶│  nginx-ingress       │───▶│  308 Permanent      │
│   Port 80       │    │  Controller          │    │  Redirect to HTTPS  │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
                                  │
                                  ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  HTTPS Request  │◀───│  Let's Encrypt       │◀───│  Kubernetes         │
│   Port 443      │    │  SSL Certificate     │    │  Services           │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
```

### Components Deployed

**nginx-ingress-controller** (automatically deployed):
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

**cert-manager** (automatically deployed):
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
```

**Let's Encrypt ClusterIssuer**:
```yaml
# gcp/kubernetes/letsencrypt-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com  # Update with your email
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### DNS Configuration

**Get nginx-ingress External IP:**
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# Note the EXTERNAL-IP value
```

**Required DNS Records** (replace with your domain and the external IP):
```
A Record: staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: api-staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: users-staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: notifications-staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: analytics-staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: billing-staging.yourdomain.com → [nginx-ingress-external-ip]
A Record: integrations-staging.yourdomain.com → [nginx-ingress-external-ip]
```

### Security Features

**Implemented Security Headers:**
- **HSTS (HTTP Strict Transport Security)**: Forces HTTPS for 1 year
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information leakage
- **Rate Limiting**: 100 requests per minute per IP

## Microservices Overview

The application consists of 5 core microservices, each accessible via HTTPS with dedicated subdomains:

### Core Microservices

| Service | HTTPS Endpoint | Purpose | Port |
|---------|---------------|---------|------|
| **Users** | `https://users-staging.yourdomain.com` | User management and authentication | 3000 |
| **Notifications** | `https://notifications-staging.yourdomain.com` | Real-time notification delivery | 3000 |
| **Analytics** | `https://analytics-staging.yourdomain.com` | Data processing and insights | 3000 |
| **Billing** | `https://billing-staging.yourdomain.com` | Payment processing and subscriptions | 3000 |
| **Integrations** | `https://integrations-staging.yourdomain.com` | Third-party platform connections | 3000 |

### Infrastructure Services

- **Redis**: Caching and pub/sub messaging
- **Kafka**: Event streaming platform
- **PostgreSQL**: Primary database with TimescaleDB extension
- **ClickHouse**: Analytics database for high-performance queries

### Kubernetes Resources

Each microservice includes:
- **Deployment**: Container orchestration and scaling
- **Service**: Internal load balancing and service discovery
- **ConfigMap**: Environment-specific configuration
- **Secret**: Sensitive data management
- **Ingress**: HTTPS routing and SSL termination (shared)

## Verification and Testing

### Step 1: Check Component Status

```bash
# Check nginx-ingress pods
kubectl get pods -n ingress-nginx

# Check cert-manager pods
kubectl get pods -n cert-manager

# Check application pods
kubectl get pods -n social-proof-system

# Check certificates
kubectl get certificates -n social-proof-system

# Check ingress status
kubectl get ingress -n social-proof-system
```

### Step 2: Test HTTP to HTTPS Redirect

```bash
# Test redirect (should return 308 Permanent Redirect)
curl -I http://staging.yourdomain.com/

# Expected response:
# HTTP/1.1 308 Permanent Redirect
# Location: https://staging.yourdomain.com
```

### Step 3: Test HTTPS Endpoints

```bash
# Test main application
curl -I https://staging.yourdomain.com/

# Test API endpoints
curl -I https://api-staging.yourdomain.com/

# Test all microservices
curl -I https://users-staging.yourdomain.com/health
curl -I https://notifications-staging.yourdomain.com/health
curl -I https://analytics-staging.yourdomain.com/health
curl -I https://billing-staging.yourdomain.com/health
curl -I https://integrations-staging.yourdomain.com/health
```

### Step 4: Verify SSL Certificate

```bash
# Check certificate details
echo | openssl s_client -servername staging.yourdomain.com -connect staging.yourdomain.com:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates

# Expected output:
# issuer=C=US, O=Let's Encrypt, CN=R10
# subject=CN=staging.yourdomain.com
# notBefore=[date]
# notAfter=[date + 90 days]
```

### Step 5: Test Application Functionality

1. **Visit the main application**: `https://staging.yourdomain.com`
2. **Test authentication**: Sign up/sign in with Clerk
3. **Test microservices**: Each should respond with health status
4. **Check browser security**: Should show "Secure" with valid certificate

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

- **Renewal Trigger**: Certificates renew when 30 days or less remaining
- **Process**: Fully automated via cert-manager
- **Validation**: HTTP-01 challenge via nginx-ingress
- **Monitoring**: Check cert-manager logs for renewal activities

## Troubleshooting

### Common Issues and Solutions

#### 1. Certificate Not Ready

**Symptoms:**
- `kubectl get certificates` shows `READY: False`
- Browser shows "Not Secure" warning
- Using nginx default certificate

**Diagnosis:**
```bash
# Check certificate status
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check Let's Encrypt issuer
kubectl get clusterissuer letsencrypt-prod

# Check ACME challenges
kubectl get challenges -n social-proof-system
```

**Solutions:**
- Ensure DNS points to nginx-ingress IP
- Verify domain is accessible via HTTP
- Check Let's Encrypt rate limits
- Verify email address in ClusterIssuer

#### 2. DNS Caching Issues

**Symptoms:**
- Browser still connects to old IP
- `curl` works but browser doesn't
- "Connection reset" errors

**Solutions:**
```bash
# Clear DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Clear DNS cache (Linux)
sudo systemctl restart systemd-resolved

# Temporary fix: Add to /etc/hosts
echo "[nginx-ingress-ip] staging.yourdomain.com" | sudo tee -a /etc/hosts
```

#### 3. Pods Stuck in Pending State

**Diagnosis:**
```bash
kubectl describe pod <pod-name> -n social-proof-system
```

**Common Solutions:**
- Check node resources: `kubectl describe nodes`
- Check persistent volume claims: `kubectl get pvc -n social-proof-system`
- Check image pull secrets: `kubectl get secrets -n social-proof-system`

#### 4. Image Pull Errors

**Diagnosis:**
```bash
kubectl get pods -n social-proof-system | grep ImagePullBackOff
kubectl describe pod <pod-name> -n social-proof-system
```

**Solutions:**
- Verify Workload Identity Federation setup
- Check container registry permissions
- Verify image names and tags

#### 5. Service Not Responding

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n social-proof-system

# Check service logs
kubectl logs -f deployment/[service-name] -n social-proof-system

# Check ingress configuration
kubectl describe ingress social-proof-nginx-ingress -n social-proof-system
```

**Solutions:**
```bash
# Restart a deployment
kubectl rollout restart deployment/[service-name] -n social-proof-system

# Check service discovery
kubectl get endpoints -n social-proof-system

# Port forward for direct testing
kubectl port-forward service/[service-name] 8080:80 -n social-proof-system
```

#### 6. Browser Shows "Not Secure" Despite Valid Certificate

**Symptoms:**
- Certificate is valid but browser shows warning
- Mixed content warnings
- Duplicate security headers

**Solutions:**
1. **Clear browser cache and data** for the domain
2. **Hard refresh**: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
3. **Try incognito mode** to bypass cached data
4. **Check for duplicate headers**:
   ```bash
   curl -I https://staging.yourdomain.com/ | grep -i strict-transport-security
   # Should only show one HSTS header
   ```

### Emergency Procedures

#### Rollback Deployment

```bash
# Rollback to previous version
kubectl rollout undo deployment/[service-name] -n social-proof-system

# Check rollout status
kubectl rollout status deployment/[service-name] -n social-proof-system
```

#### Force Certificate Regeneration

```bash
# Delete existing certificate
kubectl delete certificate social-proof-nginx-tls -n social-proof-system

# Delete certificate secret
kubectl delete secret social-proof-nginx-tls -n social-proof-system

# Reapply ingress to trigger new certificate
kubectl apply -f gcp/kubernetes/ingress-nginx.yaml
```

#### Temporary HTTP Access

If HTTPS is completely broken:

```bash
# Edit ingress to disable SSL redirect temporarily
kubectl edit ingress social-proof-nginx-ingress -n social-proof-system

# Change: nginx.ingress.kubernetes.io/ssl-redirect: "false"
# Remove: cert-manager.io/cluster-issuer annotation
```

## Cost Analysis

### MVP vs Enterprise Comparison

| Component | MVP Cost (Monthly) | Enterprise Cost (Monthly) | Savings |
|-----------|-------------------|---------------------------|---------|
| **Compute** | GKE cluster (3 nodes) | Multi-region EKS | 85% |
| **Database** | Single PostgreSQL | RDS Multi-AZ + Read Replicas | 90% |
| **Storage** | Standard SSD | Premium SSD + Backup | 80% |
| **Networking** | Single region | Global load balancer | 95% |
| **Monitoring** | Basic GCP monitoring | Enterprise APM | 90% |
| **Total** | **$20-30/month** | **$700-800/month** | **96%** |

### Cost Optimization Tips

1. **Use preemptible nodes** for non-critical workloads
2. **Scale down during off-hours** using HPA
3. **Use regional persistent disks** instead of zonal
4. **Monitor resource usage** and right-size instances
5. **Set up billing alerts** to avoid surprises

## Scaling and Production

### Horizontal Scaling

```bash
# Scale a deployment
kubectl scale deployment integrations-service --replicas=3 -n social-proof-system

# Auto-scale based on CPU
kubectl autoscale deployment integrations-service --cpu-percent=70 --min=2 --max=10 -n social-proof-system
```

### Production Considerations

#### 1. Environment Separation

Create separate environments:
- **Development**: `dev.yourdomain.com`
- **Staging**: `staging.yourdomain.com`
- **Production**: `yourdomain.com`

#### 2. Database Scaling

- **Read Replicas**: For read-heavy workloads
- **Connection Pooling**: Use pgbouncer for PostgreSQL
- **Partitioning**: Use TimescaleDB for time-series data

#### 3. Security Hardening

- **Network Policies**: Restrict pod-to-pod communication
- **Pod Security Standards**: Enforce security contexts
- **Secrets Management**: Use external secret management
- **Image Scanning**: Scan container images for vulnerabilities

#### 4. Monitoring and Alerting

Set up monitoring for:
- **Certificate expiration** (alert at 30 days)
- **Pod health** and resource usage
- **Application errors** and performance
- **Database performance** and connections

#### 5. Backup and Disaster Recovery

```bash
# Database backups
kubectl create cronjob postgres-backup --image=postgres:14 --schedule="0 2 * * *" -- pg_dump

# Certificate backups
kubectl get secret social-proof-nginx-tls -n social-proof-system -o yaml > ssl-cert-backup.yaml
```

### Migration to Production

1. **Create production GCP project**
2. **Update DNS to production domains**
3. **Configure production secrets** (real API keys)
4. **Set up monitoring and alerting**
5. **Implement backup strategies**
6. **Test disaster recovery procedures**

## Support and Resources

### Documentation Links
- [nginx-ingress Documentation](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine/docs)

### Community Support
- [nginx-ingress GitHub Issues](https://github.com/kubernetes/ingress-nginx/issues)
- [cert-manager GitHub Issues](https://github.com/cert-manager/cert-manager/issues)
- [Kubernetes Slack](https://kubernetes.slack.com/)

### Getting Help

For issues:
1. **Check this troubleshooting guide** first
2. **Review GitHub Actions logs** for deployment issues
3. **Check Kubernetes pod logs** for application issues
4. **Verify DNS and certificate status**
5. **Open an issue** in this repository with detailed logs

---

## Quick Start Checklist

Use this checklist to deploy from scratch:

### ☐ **Prerequisites**
- [ ] GCP account with billing enabled
- [ ] GitHub repository with Actions enabled
- [ ] Domain name with DNS access
- [ ] Required tools installed (gcloud, kubectl, terraform)

### ☐ **GCP Setup**
- [ ] Create GCP project
- [ ] Run Workload Identity Federation setup script
- [ ] Save GitHub secrets and variables

### ☐ **Infrastructure**
- [ ] Configure terraform.tfvars
- [ ] Run `terraform apply`
- [ ] Get GKE credentials

### ☐ **GitHub Configuration**
- [ ] Add all required secrets
- [ ] Add all required variables
- [ ] Verify repository settings

### ☐ **DNS Configuration**
- [ ] Get nginx-ingress external IP
- [ ] Create A records for all domains
- [ ] Verify DNS propagation

### ☐ **Deployment**
- [ ] Push to develop branch
- [ ] Monitor GitHub Actions
- [ ] Verify pod status
- [ ] Check certificate generation

### ☐ **Verification**
- [ ] Test HTTP to HTTPS redirect
- [ ] Verify SSL certificate
- [ ] Test all microservice endpoints
- [ ] Check application functionality

### ☐ **Final Steps**
- [ ] Set up monitoring
- [ ] Configure alerts
- [ ] Document any customizations
- [ ] Plan scaling strategy

---

**Last Updated**: May 25, 2025  
**Version**: 2.0  
**Deployment Status**: ✅ Production Ready  
**SSL Status**: ✅ Auto-renewal Active  
**Microservices**: 5 services with HTTPS endpoints 