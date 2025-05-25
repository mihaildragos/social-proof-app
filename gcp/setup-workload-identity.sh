#!/bin/bash

# Workload Identity Federation Setup for GitHub Actions
# This script sets up secure authentication between GitHub Actions and GCP
# without using long-lived service account keys

set -e

# Configuration
PROJECT_ID="${1:-}"
GITHUB_REPO="${2:-}" # Format: "owner/repo"
POOL_ID="github-actions-pool"
PROVIDER_ID="github-actions-provider"
SERVICE_ACCOUNT_NAME="github-actions-sa"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate inputs
if [[ -z "$PROJECT_ID" ]]; then
    print_error "Usage: $0 <PROJECT_ID> <GITHUB_REPO>"
    print_error "Example: $0 my-gcp-project octocat/social-proof-app"
    exit 1
fi

if [[ -z "$GITHUB_REPO" ]]; then
    print_error "GitHub repository must be specified in format 'owner/repo'"
    print_error "Example: octocat/social-proof-app"
    exit 1
fi

print_status "Setting up Workload Identity Federation for:"
print_status "  GCP Project: $PROJECT_ID"
print_status "  GitHub Repo: $GITHUB_REPO"
echo

# Set the project
print_status "Setting GCP project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
print_status "Enabling required APIs..."
gcloud services enable \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    sts.googleapis.com \
    iamcredentials.googleapis.com

print_success "APIs enabled"

# Create service account if it doesn't exist
print_status "Creating service account: $SERVICE_ACCOUNT_NAME"
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1; then
    print_warning "Service account already exists"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="GitHub Actions Service Account" \
        --description="Service account for GitHub Actions CI/CD via Workload Identity Federation"
    print_success "Service account created"
fi

# Grant necessary roles to service account
print_status "Granting IAM roles to service account..."
ROLES=(
    "roles/container.developer"
    "roles/storage.admin"
    "roles/cloudbuild.builds.editor"
    "roles/compute.admin"
    "roles/iam.serviceAccountUser"
)

for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="$role" \
        --quiet
done

print_success "IAM roles granted"

# Create Workload Identity Pool
print_status "Creating Workload Identity Pool: $POOL_ID"
if gcloud iam workload-identity-pools describe "$POOL_ID" --location="global" >/dev/null 2>&1; then
    print_warning "Workload Identity Pool already exists"
else
    gcloud iam workload-identity-pools create "$POOL_ID" \
        --location="global" \
        --display-name="GitHub Actions Pool" \
        --description="Workload Identity Pool for GitHub Actions"
    print_success "Workload Identity Pool created"
fi

# Create Workload Identity Provider
print_status "Creating Workload Identity Provider: $PROVIDER_ID"
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location="global" >/dev/null 2>&1; then
    print_warning "Workload Identity Provider already exists"
else
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
        --workload-identity-pool="$POOL_ID" \
        --location="global" \
        --issuer-uri="https://token.actions.githubusercontent.com" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
    print_success "Workload Identity Provider created"
fi

# Allow the provider to impersonate the service account
print_status "Configuring service account impersonation..."
gcloud iam service-accounts add-iam-policy-binding \
    "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

print_success "Service account impersonation configured"

# Get the Workload Identity Provider resource name
WORKLOAD_IDENTITY_PROVIDER=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location="global" \
    --format="value(name)")

print_success "Setup completed successfully!"
echo
print_status "GitHub Secrets to configure:"
echo "GCP_PROJECT_ID = $PROJECT_ID"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = $WORKLOAD_IDENTITY_PROVIDER"
echo "GCP_SERVICE_ACCOUNT = ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo
print_status "GitHub Variables to configure:"
echo "GCP_REGION = us-central1"
echo "GCP_ZONE = us-central1-a"
echo "GKE_CLUSTER = social-proof-cluster"
echo "CONTAINER_REGISTRY = gcr.io"
echo
print_warning "Remove the following from GitHub Secrets (no longer needed):"
echo "- GCP_SA_KEY"
echo
print_status "Next steps:"
echo "1. Update GitHub Secrets with the values above"
echo "2. Remove GCP_SA_KEY from GitHub Secrets"
echo "3. Deploy using GitHub Actions"
echo
print_success "Workload Identity Federation is ready to use!"
