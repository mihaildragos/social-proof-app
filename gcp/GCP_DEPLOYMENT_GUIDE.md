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

## 5. HTTP to HTTPS Redirect Setup

### 5.1 Overview

The application implements enterprise-grade HTTP to HTTPS redirect using:
- **nginx-ingress-controller**: Industry-standard ingress controller for reliable redirects
- **cert-manager**: Automatic SSL certificate management via Let's Encrypt
- **Automatic certificate renewal**: Certificates auto-renew before expiration
- **Multi-domain support**: All microservice subdomains included

### 5.2 Architecture

```
Internet → nginx-ingress-controller → Kubernetes Services
    ↓
HTTP (Port 80) → 308 Permanent Redirect → HTTPS (Port 443)
    ↓
Let's Encrypt SSL Certificates (Auto-generated & Renewed)
```

### 5.3 Components Deployed

**nginx-ingress-controller:**
```bash
# Automatically deployed via:
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

**cert-manager:**
```bash
# Automatically deployed via:
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
```

**Let's Encrypt ClusterIssuer:**
```yaml
# gcp/kubernetes/letsencrypt-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@pulsesocialproof.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

**Main Ingress Configuration:**
```yaml
# gcp/kubernetes/ingress-nginx.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: social-proof-nginx-ingress
  namespace: social-proof-system
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - staging.pulsesocialproof.com
    - api-staging.pulsesocialproof.com
    - users-staging.pulsesocialproof.com
    - notifications-staging.pulsesocialproof.com
    - analytics-staging.pulsesocialproof.com
    - billing-staging.pulsesocialproof.com
    - integrations-staging.pulsesocialproof.com
    secretName: social-proof-nginx-tls
```

### 5.4 DNS Configuration

**Required DNS Records:**
```
A Record: staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: api-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: users-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: notifications-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: analytics-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: billing-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
A Record: integrations-staging.pulsesocialproof.com → [nginx-ingress-external-ip]
```

**Get nginx-ingress External IP:**
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# Note the EXTERNAL-IP value for DNS configuration
```

### 5.5 SSL Certificate Status

**Check Certificate Status:**
```bash
# Check if certificates are ready
kubectl get certificates -n social-proof-system

# View certificate details
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check ACME challenges (during initial setup)
kubectl get challenges -n social-proof-system
```

**Expected Output:**
```
NAME                     READY   SECRET                   AGE
social-proof-nginx-tls   True    social-proof-nginx-tls   5m
```

### 5.6 Testing HTTP to HTTPS Redirect

**Test Redirect Functionality:**
```bash
# Test HTTP redirect (should return 308 Permanent Redirect)
curl -I http://staging.pulsesocialproof.com/

# Expected response:
# HTTP/1.1 308 Permanent Redirect
# Location: https://staging.pulsesocialproof.com
# Strict-Transport-Security: max-age=31536000; includeSubDomains

# Test HTTPS endpoint (should return 200 OK)
curl -I https://staging.pulsesocialproof.com/

# Expected response:
# HTTP/2 200
# [application headers...]
```

**Test All Microservice Endpoints:**
```bash
# Main application
curl -I https://staging.pulsesocialproof.com/

# API endpoints
curl -I https://api-staging.pulsesocialproof.com/

# Microservices
curl -I https://users-staging.pulsesocialproof.com/
curl -I https://notifications-staging.pulsesocialproof.com/
curl -I https://analytics-staging.pulsesocialproof.com/
curl -I https://billing-staging.pulsesocialproof.com/
curl -I https://integrations-staging.pulsesocialproof.com/
```

### 5.7 Security Features

**Implemented Security Headers:**
- **HSTS (HTTP Strict Transport Security)**: Forces HTTPS for 1 year
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information leakage

**SSL Certificate Features:**
- **Automatic Generation**: Certificates generated automatically via Let's Encrypt
- **Multi-Domain Support**: Single certificate covers all subdomains
- **Auto-Renewal**: Certificates renew automatically before expiration
- **HTTP-01 Challenge**: Domain validation via HTTP challenge

### 5.8 Troubleshooting HTTPS Setup

**Common Issues and Solutions:**

**1. Certificate Not Ready:**
```bash
# Check certificate status
kubectl describe certificate social-proof-nginx-tls -n social-proof-system

# Check Let's Encrypt issuer
kubectl get clusterissuer letsencrypt-prod

# Common fix: Ensure DNS points to nginx-ingress IP
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

**2. DNS Caching Issues:**
```bash
# Clear local DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Temporary fix: Add to /etc/hosts
echo "[nginx-ingress-ip] staging.pulsesocialproof.com" | sudo tee -a /etc/hosts
```

**3. Certificate Validation Failures:**
```bash
# Check ACME challenges
kubectl get challenges -n social-proof-system

# Check challenge details
kubectl describe challenge [challenge-name] -n social-proof-system

# Ensure HTTP-01 challenge path is accessible
curl http://staging.pulsesocialproof.com/.well-known/acme-challenge/test
```

**4. nginx-ingress Not Responding:**
```bash
# Check nginx-ingress pods
kubectl get pods -n ingress-nginx

# Check nginx-ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Restart nginx-ingress if needed
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx
```

### 5.9 Monitoring and Maintenance

**Certificate Monitoring:**
```bash
# Check certificate expiration
kubectl get certificates -n social-proof-system -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status,EXPIRY:.status.notAfter

# Monitor cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

**nginx-ingress Monitoring:**
```bash
# Check ingress status
kubectl get ingress -n social-proof-system

# Monitor nginx-ingress metrics (if enabled)
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller-metrics 10254:10254
curl http://localhost:10254/metrics
```

**Automatic Renewal:**
- Certificates automatically renew when they have 30 days or less remaining
- No manual intervention required
- Monitor cert-manager logs for renewal activities

### 5.10 Production Considerations

**For Production Deployment:**

1. **Use Production Let's Encrypt Server:**
   ```yaml
   # Already configured in letsencrypt-issuer.yaml
   server: https://acme-v02.api.letsencrypt.org/directory
   ```

2. **Configure Rate Limiting:**
   ```yaml
   # Already configured in ingress-nginx.yaml
   nginx.ingress.kubernetes.io/rate-limit: "100"
   nginx.ingress.kubernetes.io/rate-limit-window: "1m"
   ```

3. **Monitor Certificate Health:**
   - Set up alerts for certificate expiration
   - Monitor cert-manager logs
   - Test renewal process in staging

4. **Backup Certificates:**
   ```bash
   # Backup certificate secrets
   kubectl get secret social-proof-nginx-tls -n social-proof-system -o yaml > ssl-cert-backup.yaml
   ```

5. **DNS Considerations:**
   - Use a reliable DNS provider
   - Consider using CNAME records for easier IP changes
   - Set appropriate TTL values (300-3600 seconds)

## 6. Deployment Process

### 6.1 Trigger Deployment

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

### 6.2 GitHub Actions Workflow Process

The deployment workflow will:

1. **Authenticate** using Workload Identity Federation
2. **Process YAML Templates** by substituting `${{ vars.* }}` and `${{ secrets.* }}`
3. **Build and Push Images** to Google Container Registry
4. **Deploy to GKE** using the processed Kubernetes manifests
5. **Verify Deployment** by checking pod health

### 6.3 Monitor Deployment

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

## 7. Access the Application

### 7.1 Get External IP Addresses

```bash
# Get external IPs for LoadBalancer services
kubectl get services -n social-proof-system --watch
```

Wait for `EXTERNAL-IP` to be assigned to:
- `integrations-service` (port 80)
- `notification-stream-service` (port 80)

### 7.2 Test the Services

```bash
# Test integrations service
curl http://EXTERNAL_IP/health

# Test notification stream service
curl http://EXTERNAL_IP/health
```

## 8. Configuration Management

### 8.1 Adding New Secrets

To add a new secret:

1. **Add to GitHub Secrets**: Repository → Settings → Secrets and variables → Actions → Secrets
2. **Update Kubernetes Secret**: Add the reference in `gcp/kubernetes/secrets.yaml`:
   ```yaml
   stringData:
     NEW_SECRET_KEY: ${{ secrets.NEW_SECRET_KEY }}
   ```
3. **Deploy**: Push changes to trigger deployment

### 8.2 Adding New Variables

To add a new variable:

1. **Add to GitHub Variables**: Repository → Settings → Secrets and variables → Actions → Variables
2. **Update ConfigMap or Deployment**: Add the reference in relevant YAML files:
   ```yaml
   data:
     NEW_CONFIG_VALUE: "${{ vars.NEW_CONFIG_VALUE }}"
   ```
3. **Deploy**: Push changes to trigger deployment

### 8.3 Environment-Specific Configuration

For different environments (staging/production):

1. **Use different GitHub Variable values** for `ENVIRONMENT`
2. **Branch-based deployment**: Different branches can use different variable values
3. **Conditional logic**: GitHub Actions can use different values based on branch

## 9. Post-Deployment Configuration

### 9.1 Update DNS Records

Point your domain names to the external IP addresses of your LoadBalancer services.

### 9.2 Configure SSL/TLS

Set up Google Cloud Load Balancer with SSL certificates:

```bash
# Create a global static IP
gcloud compute addresses create social-proof-ip --global

# Get the IP address
gcloud compute addresses describe social-proof-ip --global
```

### 9.3 Database Initialization

```bash
# Port forward to access PostgreSQL
kubectl port-forward service/postgres 5432:5432 -n social-proof-system

# Run database migrations (in another terminal)
cd microservices
npm run migrate:up
```

## 10. Security Features

### 10.1 Workload Identity Federation Benefits

✅ **No long-lived service account keys** stored in GitHub
✅ **Short-lived tokens** that automatically rotate
✅ **Better security** - no risk of key leakage
✅ **Improved auditing** - all access is logged
✅ **Repository-specific** - tokens only work from your specific repository

### 10.2 Secret Management Best Practices

✅ **GitHub Secrets for sensitive data** - API keys, passwords, certificates
✅ **GitHub Variables for configuration** - environment names, URLs, flags
✅ **Automatic base64 encoding** - Kubernetes handles encoding with `stringData`
✅ **No secrets in repository** - All sensitive data stored securely in GitHub
✅ **Audit trail** - GitHub logs all secret access

### 10.3 Verify Security Setup

```bash
# Check Workload Identity Pool
gcloud iam workload-identity-pools describe github-actions-pool --location=global

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID --filter="bindings.members:serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Check authentication logs
gcloud logging read 'resource.type="iam_service_account" AND protoPayload.serviceName="iam.googleapis.com"' --limit=10 --format=json
```

## 11. Monitoring and Maintenance

### 11.1 Check Application Health

```bash
# Check all pods are running
kubectl get pods -n social-proof-system

# Check resource usage
kubectl top pods -n social-proof-system
kubectl top nodes
```

### 11.2 View Logs

```bash
# View application logs
kubectl logs -f deployment/notifications-service -n social-proof-system

# View infrastructure logs
kubectl logs -f deployment/postgres -n social-proof-system
kubectl logs -f deployment/redis -n social-proof-system
```

### 11.3 Scale Services

```bash
# Scale a deployment
kubectl scale deployment integrations-service --replicas=3 -n social-proof-system

# Auto-scale based on CPU
kubectl autoscale deployment integrations-service --cpu-percent=70 --min=2 --max=10 -n social-proof-system
```

## 12. Troubleshooting

### 12.1 Common Issues

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

### 12.2 Restart Services

```bash
# Restart a deployment
kubectl rollout restart deployment/integrations-service -n social-proof-system

# Check rollout status
kubectl rollout status deployment/integrations-service -n social-proof-system
```

### 12.3 Access Pod Shell

```bash
# Execute commands in a pod
kubectl exec -it deployment/integrations-service -n social-proof-system -- /bin/bash

# Check environment variables
kubectl exec deployment/integrations-service -n social-proof-system -- env
```

## 13. Cleanup

### 13.1 Delete Kubernetes Resources

```bash
kubectl delete namespace social-proof-system
```

### 13.2 Delete GCP Infrastructure

```bash
cd gcp/terraform
terraform destroy
```

### 13.3 Delete Workload Identity Federation

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

### 13.4 Delete GCP Project

```bash
gcloud projects delete your-social-proof-project
```

## 14. Migration from Service Account Keys

If you're migrating from the old service account key method:

### 14.1 Remove Old Secrets
1. Go to GitHub repository → Settings → Secrets and variables → Actions → Secrets
2. **Delete** the old `GCP_SA_KEY` secret
3. **Add** the new Workload Identity Federation secrets

### 14.2 Benefits of Migration
- 🔒 **Enhanced Security**: No long-lived credentials
- 🔄 **Automatic Rotation**: Tokens refresh automatically
- 📊 **Better Auditing**: Complete access logs
- 🚫 **Zero Key Management**: No manual key rotation needed

## 15. Advanced Configuration

### 15.1 Environment-Specific Overrides

For production deployment with different values:

1. **Create production branch**: `production`
2. **Use GitHub Environments**: Create separate environments with different variable values
3. **Conditional workflows**: Use different variables based on branch/environment

### 15.2 Secret Rotation

To rotate secrets:

1. **Update in external service** (e.g., regenerate API key in Stripe)
2. **Update GitHub Secret** with new value
3. **Restart affected pods**:
   ```bash
   kubectl rollout restart deployment/integrations-service -n social-proof-system
   ```

### 15.3 Multi-Environment Setup

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