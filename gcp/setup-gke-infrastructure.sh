#!/bin/bash

# Script to set up GCP resources for GitHub Actions
# This script sets up Workload Identity Federation for GitHub Actions
# Adapted for GKE deployment of Social Proof App

set -e

# Function to display usage
usage() {
  echo "Usage: $0 -p PROJECT_ID -r REGION -g GITHUB_REPO"
  echo "  -p PROJECT_ID   : GCP Project ID"
  echo "  -r REGION       : GCP Region (e.g., europe-west1)"
  echo "  -g GITHUB_REPO  : GitHub repository name (format: owner/repo)"
  echo ""
  echo "Note: This script sets up GKE infrastructure for social proof app deployment"
  exit 1
}

# Parse arguments
while getopts "p:r:g:" opt; do
  case $opt in
    p) PROJECT_ID="$OPTARG" ;;
    r) REGION="$OPTARG" ;;
    g) GITHUB_REPO="$OPTARG" ;;
    *) usage ;;
  esac
done

# Check required arguments
if [ -z "$PROJECT_ID" ] || [ -z "$REGION" ] || [ -z "$GITHUB_REPO" ]; then
  usage
fi

echo "Setting up GCP for GitHub Actions GKE deployment..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "GitHub Repo: $GITHUB_REPO"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# Enable necessary APIs for GKE
echo "Enabling necessary APIs..."
gcloud services enable iamcredentials.googleapis.com --project=$PROJECT_ID
gcloud services enable iam.googleapis.com --project=$PROJECT_ID
gcloud services enable container.googleapis.com --project=$PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID
gcloud services enable compute.googleapis.com --project=$PROJECT_ID

# Parse GitHub repo info
GITHUB_OWNER=$(echo $GITHUB_REPO | cut -d '/' -f1)
GITHUB_REPO_NAME=$(echo $GITHUB_REPO | cut -d '/' -f2)

# Create Workload Identity Pool if it doesn't exist
echo "Setting up Workload Identity Pool..."
POOL_EXISTS=$(gcloud iam workload-identity-pools list --location=global --project=$PROJECT_ID --format="value(name)" | grep -c "github-actions-pool" || true)
if [ "$POOL_EXISTS" -eq 0 ]; then
  echo "Creating Workload Identity Pool..."
  gcloud iam workload-identity-pools create github-actions-pool \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --project=$PROJECT_ID
else
  echo "Workload Identity Pool already exists, skipping creation."
fi

# Try to get the Workload Identity Provider, and create it if it doesn't exist
echo "Setting up Workload Identity Provider..."
try_count=0
max_tries=3

while [ $try_count -lt $max_tries ]; do
  PROVIDER_EXISTS=$(gcloud iam workload-identity-pools providers list \
    --workload-identity-pool=github-actions-pool \
    --location=global \
    --project=$PROJECT_ID \
    --format="value(name)" | grep -c "github-actions-provider" || true)
  
  if [ "$PROVIDER_EXISTS" -gt 0 ]; then
    echo "Workload Identity Provider already exists, skipping creation."
    break
  else
    echo "Creating Workload Identity Provider (attempt $(($try_count + 1))/${max_tries})..."
    set +e  # Disable exit on error temporarily
    
    gcloud iam workload-identity-pools providers create-oidc github-actions-provider \
      --location="global" \
      --workload-identity-pool=github-actions-pool \
      --display-name="GitHub Actions Provider" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
      --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
      --project=$PROJECT_ID
    
    RESULT=$?
    set -e  # Re-enable exit on error
    
    if [ $RESULT -eq 0 ]; then
      echo "Workload Identity Provider created successfully."
      break
    else
      echo "Failed to create Workload Identity Provider. Retrying..."
      try_count=$((try_count + 1))
      sleep 5
    fi
  fi
done

if [ $try_count -eq $max_tries ]; then
  echo "Failed to create Workload Identity Provider after ${max_tries} attempts."
  echo "Please try a different approach or check Google Cloud documentation."
  exit 1
fi

# Create service account for GitHub Actions if it doesn't exist
echo "Setting up Service Account for GitHub Actions..."
SA_EXISTS=$(gcloud iam service-accounts list --project=$PROJECT_ID --filter="email:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" --format="value(email)")
if [ -z "$SA_EXISTS" ]; then
  echo "Creating Service Account..."
  gcloud iam service-accounts create github-actions-sa \
    --display-name="GitHub Actions Service Account" \
    --project=$PROJECT_ID
else
  echo "Service Account already exists, skipping creation."
fi

# Add IAM roles to the service account for GKE
echo "Granting required IAM roles for GKE..."
echo "This may show warnings if the bindings already exist, which is okay."

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/logging.viewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.clusterViewer"

# Allow GitHub Actions to access the service account
echo "Setting up workload identity binding..."
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/*" \
  --role="roles/iam.workloadIdentityUser" \
  --project=$PROJECT_ID

# Create GKE cluster
echo "Setting up GKE cluster..."
CLUSTER_EXISTS=$(gcloud container clusters list --project=$PROJECT_ID --region=$REGION --format="value(name)" | grep -c "social-proof-cluster" || true)
if [ "$CLUSTER_EXISTS" -eq 0 ]; then
  echo "Creating GKE cluster..."
  gcloud container clusters create social-proof-cluster \
    --region=$REGION \
    --machine-type=n1-standard-2 \
    --num-nodes=3 \
    --enable-autorepair \
    --enable-autoupgrade \
    --project=$PROJECT_ID
else
  echo "GKE cluster already exists, skipping creation."
fi

# Create Artifact Registry repository if it doesn't exist
echo "Setting up Artifact Registry repository..."
REPO_EXISTS=$(gcloud artifacts repositories list --project=$PROJECT_ID --location=$REGION --format="value(name)" | grep -c "social-proof-app" || true)
if [ "$REPO_EXISTS" -eq 0 ]; then
  echo "Creating Artifact Registry repository..."
  gcloud artifacts repositories create social-proof-app \
    --repository-format=docker \
    --location=$REGION \
    --project=$PROJECT_ID
else
  echo "Artifact Registry repository already exists, skipping creation."
fi

# Generate workload identity provider string
WORKLOAD_IDENTITY_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider"
SERVICE_ACCOUNT="github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Setup complete, print information for GitHub Secrets
echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "Add the following values to your .env.mvp-deploy file:"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=$WORKLOAD_IDENTITY_PROVIDER"
echo "GCP_SERVICE_ACCOUNT=$SERVICE_ACCOUNT"
echo "PROJECT_NUMBER=$PROJECT_NUMBER"
echo "PROJECT_ID=$PROJECT_ID"
echo "GCP_REGION=$REGION"
echo "GCP_ZONE=${REGION}-b"
echo "GKE_CLUSTER=social-proof-cluster"
echo "CONTAINER_REGISTRY=${REGION}-docker.pkg.dev"
echo ""
echo "Next steps:"
echo "1. Update your .env.mvp-deploy file with the values above"
echo "2. Configure GitHub Secrets and Variables as per the deployment guide"
echo "3. Get credentials for your GKE cluster:"
echo "   gcloud container clusters get-credentials social-proof-cluster --region=$REGION --project=$PROJECT_ID"
echo "4. Deploy your application using GitHub Actions"
echo "" 