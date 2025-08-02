# Deployment Scripts

This directory contains scripts for deploying the Social Proof App to staging and production environments.

## Prerequisites

Before using these scripts, ensure you have:

1. **Google Cloud SDK** installed and authenticated
   ```bash
   gcloud auth login
   gcloud config set project your-project-id
   ```

2. **kubectl** configured for your GKE cluster
   ```bash
   gcloud container clusters get-credentials social-proof-cluster \
     --region europe-west1 \
     --project social-proof-app-gcp
   ```

3. **Docker** running locally
   ```bash
   docker --version
   ```

4. **Environment file** `.env.staging` in the project root with all required variables

## Available Scripts

### `npm run deploy:staging`

Deploys the current branch to staging environment.

**What it does:**
- ✅ Loads environment variables from `.env.staging`
- ✅ Checks prerequisites (gcloud, kubectl, Docker)
- ✅ Gets current branch and commit information
- ✅ Builds Docker images for all microservices
- ✅ Pushes images to Google Container Registry
- ✅ Deploys to Kubernetes using existing manifests
- ✅ Verifies deployment status

**Usage:**
```bash
# Interactive deployment (with confirmations)
npm run deploy:staging

# Force deployment (skip confirmations)
npm run deploy:staging:force
```

**Example output:**
```
🚀 Starting Staging Deployment
================================

ℹ️  Loading environment variables from .env.staging...
✅ Loaded 25 environment variables
ℹ️  Getting current branch information...
ℹ️  Current branch: implement-billing-service
ℹ️  Commit hash: a1b2c3d
ℹ️  Checking prerequisites...
✅ Authenticated as: your-email@example.com
✅ kubectl is configured
✅ Docker is running

============================================================
STAGING DEPLOYMENT SUMMARY
============================================================
Branch: implement-billing-service
Commit: a1b2c3d
Project: social-proof-app-gcp
Cluster: social-proof-cluster
Region: europe-west1
Services: integrations, notification-stream, notifications, users, analytics, billing
============================================================

Proceed with staging deployment? (y/N): y
```

### `npm run deploy:check`

Checks the status of the current staging deployment.

**What it does:**
- ✅ Verifies Kubernetes connection
- ✅ Checks namespace existence
- ✅ Lists pod status and health
- ✅ Shows service endpoints
- ✅ Displays ingress configuration
- ✅ Shows recent events
- ✅ Provides troubleshooting commands

**Usage:**
```bash
npm run deploy:check
```

**Example output:**
```
🔍 Checking Deployment Status
==============================

ℹ️  Checking Kubernetes connection...
✅ Connected to Kubernetes cluster
ℹ️  Checking namespace: social-proof-system
✅ Namespace social-proof-system exists

📦 Pod Status:
==============
NAME                                    READY   STATUS    RESTARTS   AGE
billing-service-7d4b8c9f6d-x8k2m       1/1     Running   0          5m
integrations-service-6b7c8d9e5f-y9l3n  1/1     Running   0          5m
...

✅ All 6 pods are running

🌐 Service Status:
==================
NAME                   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
billing-service        ClusterIP   10.96.1.100     <none>        3006/TCP
integrations-service   ClusterIP   10.96.1.101     <none>        3001/TCP
...

📊 Deployment Summary
=====================
✅ All checks passed (5/5)
✅ Deployment appears to be healthy! 🎉
```

## Environment Variables

The deployment scripts use variables from `.env.staging`. Key variables include:

### Required Variables
```bash
# GCP Configuration
PROJECT_ID=social-proof-app-gcp
GCP_REGION=europe-west1
GKE_CLUSTER=social-proof-cluster
CONTAINER_REGISTRY=gcr.io

# Authentication
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
POSTGRES_PASSWORD=...

# Application Configuration
NODE_ENV=staging
ENVIRONMENT=staging
```

## Deployment Process

### 1. Image Building
The script builds Docker images for each microservice:
- `integrations` → `gcr.io/project/integrations:branch-commit`
- `notification-stream` → `gcr.io/project/notification-stream:branch-commit`
- `notifications` → `gcr.io/project/notifications:branch-commit`
- `users` → `gcr.io/project/users:branch-commit`
- `analytics` → `gcr.io/project/analytics:branch-commit`
- `billing` → `gcr.io/project/billing:branch-commit`

### 2. Kubernetes Deployment
The script applies Kubernetes manifests in order:
1. **Namespace** - Creates/updates the `social-proof-system` namespace
2. **ConfigMap** - Application configuration (non-sensitive)
3. **Secrets** - Sensitive configuration (API keys, passwords)
4. **Infrastructure** - Databases, message queues, storage
5. **Deployments** - Application services
6. **Services** - Service discovery and load balancing

### 3. Verification
After deployment, the script:
- Waits for pods to start
- Checks pod health status
- Displays service endpoints
- Shows recent Kubernetes events

## Troubleshooting

### Common Issues

**1. Authentication Error**
```bash
Error: No active gcloud authentication found
```
**Solution:**
```bash
gcloud auth login
gcloud auth application-default login
```

**2. Cluster Access Error**
```bash
Error: kubectl not configured
```
**Solution:**
```bash
gcloud container clusters get-credentials social-proof-cluster \
  --region europe-west1 \
  --project social-proof-app-gcp
```

**3. Docker Permission Error**
```bash
Error: Docker is not running
```
**Solution:**
```bash
# Start Docker Desktop or Docker daemon
sudo systemctl start docker  # Linux
open -a Docker  # macOS
```

**4. Image Push Error**
```bash
Error: unauthorized: authentication required
```
**Solution:**
```bash
gcloud auth configure-docker
# or for Artifact Registry:
gcloud auth configure-docker gcr.io
```

### Useful Commands

**View pod logs:**
```bash
kubectl logs -n social-proof-system -l app=billing-service --tail=50
```

**Describe pod for troubleshooting:**
```bash
kubectl describe pod -n social-proof-system <pod-name>
```

**Port forward for local testing:**
```bash
kubectl port-forward -n social-proof-system service/billing-service 8080:3006
```

**Get all resources:**
```bash
kubectl get all -n social-proof-system
```

**Check events:**
```bash
kubectl get events -n social-proof-system --sort-by='.lastTimestamp'
```

## Security Notes

- The `.env.staging` file contains sensitive information and should never be committed to version control
- All secrets are base64 encoded before being applied to Kubernetes
- Docker registry authentication uses gcloud credentials (no service account keys)
- Workload Identity Federation is used for secure GCP authentication

## Next Steps

After successful deployment:

1. **Verify services** are responding:
   ```bash
   kubectl port-forward -n social-proof-system service/billing-service 8080:3006
   curl http://localhost:8080/health
   ```

2. **Check logs** for any errors:
   ```bash
   kubectl logs -n social-proof-system -l app=billing-service
   ```

3. **Monitor metrics** and alerts in your monitoring system

4. **Run integration tests** against the staging environment

5. **Update DNS** or load balancer configuration if needed 