# GCP MVP Deployment Guide

This guide walks you through deploying the Social Proof App MVP on Google Cloud Platform using GitHub Actions, Kubernetes, and **Workload Identity Federation** for secure authentication.

## Prerequisites

1. **GCP Account** with billing enabled
2. **GitHub Repository** with Actions enabled
3. **GCP Project** created
4. **Terraform** installed locally (for initial infrastructure setup)
5. **kubectl** installed locally
6. **gcloud CLI** installed and authenticated

## 1. GCP Project Setup

### 1.1 Create GCP Project
```bash
# Set your project ID
export PROJECT_ID="your-social-proof-project"

# Create the project
gcloud projects create $PROJECT_ID

# Set as default project
gcloud config set project $PROJECT_ID

# Enable billing (replace BILLING_ACCOUNT_ID with your billing account)
gcloud beta billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 1.2 Set up Workload Identity Federation (Secure Authentication)

**🔒 Important**: We use Workload Identity Federation instead of service account keys for enhanced security.

Run the setup script to configure secure authentication:

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

**Example output:**
```
GitHub Secrets to configure:
GCP_PROJECT_ID = your-social-proof-project
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_SERVICE_ACCOUNT = github-actions-sa@your-social-proof-project.iam.gserviceaccount.com
```

## 2. Terraform Infrastructure Setup

### 2.1 Configure Terraform Variables
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

### 2.2 Deploy Infrastructure
```bash
# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Apply the infrastructure
terraform apply
```

### 2.3 Get GKE Credentials
```bash
# Configure kubectl to connect to your cluster
gcloud container clusters get-credentials social-proof-cluster \
  --region us-central1 \
  --project your-social-proof-project
```

## 3. GitHub Repository Setup

### 3.1 Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Secrets

Add the following **Secrets** (sensitive data that will be used as `${{ secrets.SECRET_NAME }}`):

**🔒 Workload Identity Federation (No service account keys needed!)**
```
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_SERVICE_ACCOUNT = github-actions-sa@your-social-proof-project.iam.gserviceaccount.com
```

**🔐 Application Secrets**
```
POSTGRES_PASSWORD = your-secure-postgres-password-min-16-chars
CLERK_SECRET_KEY = sk_test_your_clerk_secret_key
JWT_SECRET = your-jwt-secret-key-minimum-32-characters-long
SENDGRID_API_KEY = SG.your_sendgrid_api_key
STRIPE_SECRET_KEY = sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET = whsec_your_stripe_webhook_secret
FIREBASE_PROJECT_ID = your-firebase-project-id
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\nyour-firebase-private-key\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
SHOPIFY_API_KEY = your_shopify_api_key
SHOPIFY_API_SECRET = your_shopify_api_secret
WOOCOMMERCE_API_KEY = ck_your_woocommerce_api_key
WOOCOMMERCE_API_SECRET = cs_your_woocommerce_api_secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_your_clerk_publishable_key
```

### 3.2 Setup GitHub Variables

Go to your GitHub repository → Settings → Secrets and variables → Actions → Variables

Add the following **Variables** (non-sensitive configuration that will be used as `${{ vars.VARIABLE_NAME }}`):

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

## 4. GitHub Actions Workflow

### 4.1 YAML Template Processing

Our Kubernetes YAML files use GitHub Actions syntax that gets processed during deployment:

**ConfigMap Example:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: social-proof-config
  environment: ${{ vars.ENVIRONMENT }}  # ← GitHub Variable
data:
  NODE_ENV: "${{ vars.NODE_ENV }}"      # ← GitHub Variable
  DATABASE_URL: "postgresql://${{ vars.POSTGRES_USER }}:${{ secrets.POSTGRES_PASSWORD }}@postgres:5432/${{ vars.POSTGRES_DB }}"
```

**Secrets Example:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: social-proof-secrets
  environment: ${{ vars.ENVIRONMENT }}
type: Opaque
stringData:  # ← Uses stringData for automatic base64 encoding
  CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}  # ← GitHub Secret
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
```

**Deployment Example:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: integrations-service
  environment: ${{ vars.ENVIRONMENT }}
spec:
  template:
    spec:
      containers:
        - name: integrations-service
          image: ${{ vars.CONTAINER_REGISTRY }}/${{ vars.PROJECT_ID }}/integrations:${{ vars.IMAGE_TAG_STRATEGY }}
```

### 4.2 Benefits of New Approach

✅ **Automatic Base64 Encoding**: Using `stringData` instead of `data` means Kubernetes automatically handles base64 encoding
✅ **Clear Secret vs Variable Distinction**: Sensitive data uses `secrets.`, non-sensitive uses `vars.`
✅ **GitHub Actions Integration**: Native syntax that's processed during workflow execution
✅ **Better Security**: Secrets are never exposed in the repository or logs
✅ **Easier Maintenance**: No manual base64 encoding/decoding needed

## 5. Deploy the Application

### 5.1 Trigger Deployment

Push code to the `develop` branch to deploy to staging:
```bash
git checkout develop
git push origin develop
```

Push code to the `main` branch to deploy to production:
```bash
git checkout main
git push origin main
```

### 5.2 GitHub Actions Workflow Process

The deployment workflow will:

1. **Authenticate** using Workload Identity Federation
2. **Process YAML Templates** by substituting `${{ vars.* }}` and `${{ secrets.* }}`
3. **Build and Push Images** to Google Container Registry
4. **Deploy to GKE** using the processed Kubernetes manifests
5. **Verify Deployment** by checking pod health

### 5.3 Monitor Deployment

1. **GitHub Actions**: Go to Actions tab in your repository to monitor the CI/CD pipeline
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

## 6. Access the Application

### 6.1 Get External IP Addresses

```bash
# Get external IPs for LoadBalancer services
kubectl get services -n social-proof-system --watch
```

Wait for `EXTERNAL-IP` to be assigned to:
- `integrations-service` (port 80)
- `notification-stream-service` (port 80)

### 6.2 Test the Services

```bash
# Test integrations service
curl http://EXTERNAL_IP/health

# Test notification stream service
curl http://EXTERNAL_IP/health
```

## 7. Configuration Management

### 7.1 Adding New Secrets

To add a new secret:

1. **Add to GitHub Secrets**: Repository → Settings → Secrets and variables → Actions → Secrets
2. **Update Kubernetes Secret**: Add the reference in `gcp/kubernetes/secrets.yaml`:
   ```yaml
   stringData:
     NEW_SECRET_KEY: ${{ secrets.NEW_SECRET_KEY }}
   ```
3. **Deploy**: Push changes to trigger deployment

### 7.2 Adding New Variables

To add a new variable:

1. **Add to GitHub Variables**: Repository → Settings → Secrets and variables → Actions → Variables
2. **Update ConfigMap or Deployment**: Add the reference in relevant YAML files:
   ```yaml
   data:
     NEW_CONFIG_VALUE: "${{ vars.NEW_CONFIG_VALUE }}"
   ```
3. **Deploy**: Push changes to trigger deployment

### 7.3 Environment-Specific Configuration

For different environments (staging/production):

1. **Use different GitHub Variable values** for `ENVIRONMENT`
2. **Branch-based deployment**: Different branches can use different variable values
3. **Conditional logic**: GitHub Actions can use different values based on branch

## 8. Post-Deployment Configuration

### 8.1 Update DNS Records

Point your domain names to the external IP addresses of your LoadBalancer services.

### 8.2 Configure SSL/TLS

Set up Google Cloud Load Balancer with SSL certificates:

```bash
# Create a global static IP
gcloud compute addresses create social-proof-ip --global

# Get the IP address
gcloud compute addresses describe social-proof-ip --global
```

### 8.3 Database Initialization

```bash
# Port forward to access PostgreSQL
kubectl port-forward service/postgres 5432:5432 -n social-proof-system

# Run database migrations (in another terminal)
cd microservices
npm run migrate:up
```

## 9. Security Features

### 9.1 Workload Identity Federation Benefits

✅ **No long-lived service account keys** stored in GitHub
✅ **Short-lived tokens** that automatically rotate
✅ **Better security** - no risk of key leakage
✅ **Improved auditing** - all access is logged
✅ **Repository-specific** - tokens only work from your specific repository

### 9.2 Secret Management Best Practices

✅ **GitHub Secrets for sensitive data** - API keys, passwords, certificates
✅ **GitHub Variables for configuration** - environment names, URLs, flags
✅ **Automatic base64 encoding** - Kubernetes handles encoding with `stringData`
✅ **No secrets in repository** - All sensitive data stored securely in GitHub
✅ **Audit trail** - GitHub logs all secret access

### 9.3 Verify Security Setup

```bash
# Check Workload Identity Pool
gcloud iam workload-identity-pools describe github-actions-pool --location=global

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID --filter="bindings.members:serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Check authentication logs
gcloud logging read 'resource.type="iam_service_account" AND protoPayload.serviceName="iam.googleapis.com"' --limit=10 --format=json
```

## 10. Monitoring and Maintenance

### 10.1 Check Application Health

```bash
# Check all pods are running
kubectl get pods -n social-proof-system

# Check resource usage
kubectl top pods -n social-proof-system
kubectl top nodes
```

### 10.2 View Logs

```bash
# View application logs
kubectl logs -f deployment/notifications-service -n social-proof-system

# View infrastructure logs
kubectl logs -f deployment/postgres -n social-proof-system
kubectl logs -f deployment/redis -n social-proof-system
```

### 10.3 Scale Services

```bash
# Scale a deployment
kubectl scale deployment integrations-service --replicas=3 -n social-proof-system

# Auto-scale based on CPU
kubectl autoscale deployment integrations-service --cpu-percent=70 --min=2 --max=10 -n social-proof-system
```

## 11. Troubleshooting

### 11.1 Common Issues

**GitHub Actions template processing errors:**
```bash
# Check GitHub Actions logs for template substitution errors
# Look for messages about missing variables or secrets
```

**Workload Identity Federation errors:**
```bash
# Check if the provider is configured correctly
gcloud iam workload-identity-pools providers describe github-actions-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global

# Verify repository condition
gcloud iam workload-identity-pools providers describe github-actions-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global \
  --format="value(attributeCondition)"
```

**Pods stuck in Pending state:**
```bash
kubectl describe pod <pod-name> -n social-proof-system
```

**Image pull errors:**
```bash
# Check if authentication is working
kubectl get pods -n social-proof-system | grep ImagePullBackOff
kubectl describe pod <pod-name> -n social-proof-system
```

**Database connection issues:**
```bash
# Check if PostgreSQL is running
kubectl get pods -l app=postgres -n social-proof-system

# Check service discovery
kubectl get endpoints -n social-proof-system
```

**Secret decoding issues:**
```bash
# Check if secrets are properly encoded
kubectl get secret social-proof-secrets -n social-proof-system -o yaml

# Decode a secret manually to verify
kubectl get secret social-proof-secrets -n social-proof-system -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
```

### 11.2 Restart Services

```bash
# Restart a deployment
kubectl rollout restart deployment/integrations-service -n social-proof-system

# Check rollout status
kubectl rollout status deployment/integrations-service -n social-proof-system
```

### 11.3 Access Pod Shell

```bash
# Execute commands in a pod
kubectl exec -it deployment/integrations-service -n social-proof-system -- /bin/bash

# Check environment variables
kubectl exec deployment/integrations-service -n social-proof-system -- env
```

## 12. Cleanup

### 12.1 Delete Kubernetes Resources

```bash
kubectl delete namespace social-proof-system
```

### 12.2 Delete GCP Infrastructure

```bash
cd gcp/terraform
terraform destroy
```

### 12.3 Delete Workload Identity Federation

```bash
# Delete the provider
gcloud iam workload-identity-pools providers delete github-actions-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global

# Delete the pool
gcloud iam workload-identity-pools delete github-actions-pool --location=global

# Delete the service account
gcloud iam service-accounts delete github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com
```

### 12.4 Delete GCP Project

```bash
gcloud projects delete your-social-proof-project
```

## 13. Migration from Service Account Keys

If you're migrating from the old service account key method:

### 13.1 Remove Old Secrets
1. Go to GitHub repository → Settings → Secrets and variables → Actions → Secrets
2. **Delete** the old `GCP_SA_KEY` secret
3. **Add** the new Workload Identity Federation secrets

### 13.2 Benefits of Migration
- 🔒 **Enhanced Security**: No long-lived credentials
- 🔄 **Automatic Rotation**: Tokens refresh automatically
- 📊 **Better Auditing**: Complete access logs
- 🚫 **Zero Key Management**: No manual key rotation needed

## 14. Advanced Configuration

### 14.1 Environment-Specific Overrides

For production deployment with different values:

1. **Create production branch**: `production`
2. **Use GitHub Environments**: Create separate environments with different variable values
3. **Conditional workflows**: Use different variables based on branch/environment

### 14.2 Secret Rotation

To rotate secrets:

1. **Update in external service** (e.g., regenerate API key in Stripe)
2. **Update GitHub Secret** with new value
3. **Restart affected pods**:
   ```bash
   kubectl rollout restart deployment/integrations-service -n social-proof-system
   ```

### 14.3 Multi-Environment Setup

For multiple environments (dev, staging, prod):

1. **Use different PROJECT_ID values** for each environment
2. **Create separate GCP projects**
3. **Use GitHub Environments** feature for environment-specific secrets
4. **Branch-based deployment** with different variable values

## Support

For issues:
1. Check GitHub Actions logs for template processing errors
2. Verify GitHub Secrets and Variables are properly configured
3. Check Kubernetes pod logs
4. Review GCP Cloud Console for infrastructure issues
5. Verify Workload Identity Federation setup
6. Check IAM permissions and bindings

## Security Best Practices

1. **Use Workload Identity Federation** - Never store service account keys
2. **Separate secrets from variables** - Use `secrets.` for sensitive data, `vars.` for configuration
3. **Use stringData in Kubernetes** - Let Kubernetes handle base64 encoding
4. **Rotate application secrets regularly** - Update API keys and passwords periodically
5. **Use least privilege** - Only grant necessary IAM permissions
6. **Monitor access** - Review GCP audit logs regularly
7. **Keep images updated** - Regularly update base images and dependencies
8. **Network security** - Use VPC firewall rules to restrict access
9. **Repository security** - Limit who can modify GitHub secrets and variables
10. **Environment isolation** - Use separate projects/clusters for production 