#!/bin/bash

# Staging Deployment Script
#
# This script deploys the current branch to staging using the environment
# variables from .env.staging file. It builds and pushes Docker images,
# then deploys to GKE.
#
# Usage:
#   ./scripts/deploy-staging.sh
#   ./scripts/deploy-staging.sh --force  # Skip confirmation prompts
#
# Prerequisites:
#   - gcloud CLI authenticated and configured
#   - kubectl configured for the target cluster
#   - Docker daemon running
#   - .env.staging file with all required variables

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ANSI color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Global variables
ENV_FILE=".env.staging"
FORCE_MODE=false
CURRENT_BRANCH=""
COMMIT_HASH=""
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Services to build and deploy
SERVICES=("integrations" "billing" "nextjs-app")

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force|-f)
      FORCE_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--force] [--help]"
      echo "  --force, -f    Skip confirmation prompts"
      echo "  --help, -h     Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Logging functions
log() {
  local color=${2:-$NC}
  echo -e "${color}${1}${NC}"
}

error() {
  log "❌ ERROR: $1" $RED
}

success() {
  log "✅ $1" $GREEN
}

warning() {
  log "⚠️  $1" $YELLOW
}

info() {
  log "ℹ️  $1" $BLUE
}

# Prompt function
prompt() {
  local question="$1"
  
  if [[ "$FORCE_MODE" == "true" ]]; then
    warning "$question (auto-confirmed in force mode)"
    return 0
  fi
  
  echo -n "$question (y/N): "
  read -r response
  case "$response" in
    [yY]|[yY][eE][sS])
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Execute command with error handling
exec_cmd() {
  local cmd="$1"
  local silent=${2:-false}
  
  if [[ "$silent" == "true" ]]; then
    if ! output=$(eval "$cmd" 2>&1); then
      error "Command failed: $cmd"
      error "$output"
      exit 1
    fi
    echo "$output"
  else
    if ! eval "$cmd"; then
      error "Command failed: $cmd"
      exit 1
    fi
  fi
}

# Load environment variables from .env.staging
load_environment() {
  info "Loading environment variables from $ENV_FILE..."
  
  if [[ ! -f "$ENV_FILE" ]]; then
    error "Environment file $ENV_FILE not found!"
    exit 1
  fi
  
  # Source the env file and export variables
  set -a  # automatically export all variables
  source "$ENV_FILE"
  set +a
  
  # Validate required environment variables
  local required_vars=("PROJECT_ID" "GCP_REGION" "GKE_CLUSTER" "CONTAINER_REGISTRY")
  
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      error "Required environment variable $var not found in $ENV_FILE"
      exit 1
    fi
  done
  
  success "Loaded environment variables from $ENV_FILE"
}

# Get current branch and commit information
get_branch_info() {
  info "Getting current branch information..."
  
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  COMMIT_HASH=$(git rev-parse --short HEAD)
  
  info "Current branch: $CURRENT_BRANCH"
  info "Commit hash: $COMMIT_HASH"
  
  # Check if working directory is clean
  if [[ -n $(git status --porcelain) ]]; then
    warning "Working directory has uncommitted changes:"
    git status --porcelain
    
    if ! prompt "Continue with uncommitted changes?"; then
      error "Deployment cancelled"
      exit 1
    fi
  fi
}

# Display deployment summary and confirm
confirm_deployment() {
  log "\n$(printf '=%.0s' {1..60})" $CYAN
  log "STAGING DEPLOYMENT SUMMARY" $CYAN
  log "$(printf '=%.0s' {1..60})" $CYAN
  log "Branch: $CURRENT_BRANCH" $BOLD
  log "Commit: $COMMIT_HASH" $BOLD
  log "Project: $PROJECT_ID" $BOLD
  log "Cluster: $GKE_CLUSTER" $BOLD
  log "Region: $GCP_REGION" $BOLD
  log "Services: $(IFS=', '; echo "${SERVICES[*]}")" $BOLD
  log "$(printf '=%.0s' {1..60})" $CYAN
  
  if ! prompt "\nProceed with staging deployment?"; then
    error "Deployment cancelled"
    exit 1
  fi
}

# Check prerequisites
check_prerequisites() {
  info "Checking prerequisites..."
  
  # Check if gcloud is installed and authenticated
  if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI not found. Please install Google Cloud SDK"
    exit 1
  fi
  
  local account
  account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
  if [[ -z "$account" ]]; then
    error "No active gcloud authentication found. Run: gcloud auth login"
    exit 1
  fi
  success "Authenticated as: $account"
  
  # Check if kubectl is configured
  if ! kubectl cluster-info &> /dev/null; then
    error "kubectl not configured. Run: gcloud container clusters get-credentials"
    exit 1
  fi
  success "kubectl is configured"
  
  # Check if Docker is running
  if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker daemon"
    exit 1
  fi
  success "Docker is running"
}

# Configure Docker for Google Container Registry
configure_gcloud_docker() {
  info "Configuring Docker for Google Container Registry..."
  gcloud auth configure-docker --quiet || true
  success "Docker configured for GCR"
}

# Build and push Docker images
build_and_push_images() {
  info "Building and pushing Docker images..."
  
  local image_tag="${CURRENT_BRANCH}-${COMMIT_HASH}"
  local registry="${CONTAINER_REGISTRY:-gcr.io}"
  
  for service in "${SERVICES[@]}"; do
    info "Building $service service..."
    
    local build_context dockerfile_path image_name
    
    if [[ "$service" == "nextjs-app" ]]; then
      # Handle Next.js app with different build context and Dockerfile
      build_context="."
      dockerfile_path="Dockerfile.nextjs"
      image_name="${registry}/${PROJECT_ID}/social-proof-app:${image_tag}"
    else
      # Handle microservices
      build_context="microservices"
      dockerfile_path="microservices/services/${service}/Dockerfile"
      image_name="${registry}/${PROJECT_ID}/${service}:${image_tag}"
    fi
    
    # Build the image with proper context
    exec_cmd "docker build --platform linux/amd64 -f $dockerfile_path -t $image_name $build_context"
    
    # Push the image
    info "Pushing $service image..."
    exec_cmd "docker push $image_name"
    
    success "$service image built and pushed"
  done
  
  # Also tag as latest for staging
  for service in "${SERVICES[@]}"; do
    local source_image latest_image
    
    if [[ "$service" == "nextjs-app" ]]; then
      source_image="${registry}/${PROJECT_ID}/social-proof-app:${image_tag}"
      latest_image="${registry}/${PROJECT_ID}/social-proof-app:staging-latest"
    else
      source_image="${registry}/${PROJECT_ID}/${service}:${image_tag}"
      latest_image="${registry}/${PROJECT_ID}/${service}:staging-latest"
    fi
    
    exec_cmd "docker tag $source_image $latest_image"
    exec_cmd "docker push $latest_image"
  done
  
  success "All images built and pushed successfully"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
  info "Deploying to Kubernetes..."
  
  local kubernetes_dir="gcp/kubernetes"
  local image_tag="${CURRENT_BRANCH}-${COMMIT_HASH}"
  local registry="${CONTAINER_REGISTRY:-gcr.io}"
  
  # Change to kubernetes directory
  cd "$kubernetes_dir"
  
  # Set environment variables for substitution
  export ENVIRONMENT="staging"
  export NODE_ENV="staging"
  export IMAGE_TAG="$image_tag"
  
  # Apply namespace
  info "Creating/updating namespace..."
  exec_cmd "envsubst < namespace.yaml | kubectl apply -f -"
  
  # Process and apply configmap
  info "Preparing configuration files..."
  
  # Process configmap.yaml
  local configmap_content
  configmap_content=$(cat configmap.yaml)
  configmap_content=${configmap_content//\$\{\{ vars.ENVIRONMENT \}\}/$ENVIRONMENT}
  configmap_content=${configmap_content//\$\{\{ vars.NODE_ENV \}\}/$NODE_ENV}
  configmap_content=${configmap_content//\$\{\{ vars.POSTGRES_USER \}\}/$POSTGRES_USER}
  configmap_content=${configmap_content//\$\{\{ secrets.POSTGRES_PASSWORD \}\}/$POSTGRES_PASSWORD}
  configmap_content=${configmap_content//\$\{\{ vars.POSTGRES_DB \}\}/$POSTGRES_DB}
  configmap_content=${configmap_content//\$\{\{ vars.CLICKHOUSE_DATABASE \}\}/$CLICKHOUSE_DATABASE}
  configmap_content=${configmap_content//\$\{\{ vars.LOG_LEVEL \}\}/$LOG_LEVEL}
  configmap_content=${configmap_content//\$\{\{ vars.METRICS_ENABLED \}\}/$METRICS_ENABLED}
  configmap_content=${configmap_content//\$\{\{ vars.TRACING_ENABLED \}\}/$TRACING_ENABLED}
  configmap_content=${configmap_content//\$\{\{ vars.HEALTH_CHECK_TIMEOUT \}\}/$HEALTH_CHECK_TIMEOUT}
  configmap_content=${configmap_content//\$\{\{ vars.HEALTH_CHECK_INTERVAL \}\}/$HEALTH_CHECK_INTERVAL}
  
  echo "$configmap_content" > configmap.staging.yaml
  
  # Process secrets.yaml
  local secrets_content
  secrets_content=$(cat secrets.yaml)
  secrets_content=${secrets_content//\$\{\{ vars.ENVIRONMENT \}\}/$ENVIRONMENT}
  secrets_content=${secrets_content//\$\{\{ secrets.CLERK_SECRET_KEY \}\}/$CLERK_SECRET_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \}\}/$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.SENDGRID_API_KEY \}\}/$SENDGRID_API_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.STRIPE_SECRET_KEY \}\}/$STRIPE_SECRET_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.STRIPE_WEBHOOK_SECRET \}\}/$STRIPE_WEBHOOK_SECRET}
  secrets_content=${secrets_content//\$\{\{ secrets.POSTGRES_PASSWORD \}\}/$POSTGRES_PASSWORD}
  secrets_content=${secrets_content//\$\{\{ secrets.JWT_SECRET \}\}/$JWT_SECRET}
  secrets_content=${secrets_content//\$\{\{ secrets.SHOPIFY_API_KEY \}\}/$SHOPIFY_API_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.SHOPIFY_API_SECRET \}\}/$SHOPIFY_API_SECRET}
  secrets_content=${secrets_content//\$\{\{ secrets.WOOCOMMERCE_API_KEY \}\}/$WOOCOMMERCE_API_KEY}
  secrets_content=${secrets_content//\$\{\{ secrets.WOOCOMMERCE_API_SECRET \}\}/$WOOCOMMERCE_API_SECRET}
  secrets_content=${secrets_content//\$\{\{ secrets.GCR_AUTH_TOKEN \}\}/${GCR_AUTH_TOKEN:-}}
  
  echo "$secrets_content" > secrets.staging.yaml
  
  # Apply configuration
  info "Applying configuration..."
  exec_cmd "kubectl apply -f configmap.staging.yaml"
  
  # Apply secrets
  info "Applying secrets..."
  exec_cmd "kubectl apply -f secrets.staging.yaml"
  
  # Apply infrastructure
  info "Applying infrastructure..."
  
  # Process infrastructure files
  local infrastructure_files=("clickhouse.yaml" "postgres.yaml" "redis.yaml" "kafka.yaml" "zookeeper.yaml")
  
  for file in "${infrastructure_files[@]}"; do
    local file_path="infrastructure/$file"
    if [[ -f "$file_path" ]]; then
      local content
      content=$(cat "$file_path")
      
      # Handle GitHub Actions syntax
      content=${content//\$\{\{ vars.ENVIRONMENT \}\}/$ENVIRONMENT}
      content=${content//\$\{\{ vars.NODE_ENV \}\}/$NODE_ENV}
      content=${content//\$\{\{ vars.POSTGRES_USER \}\}/$POSTGRES_USER}
      content=${content//\$\{\{ vars.POSTGRES_DB \}\}/$POSTGRES_DB}
      content=${content//\$\{\{ vars.CLICKHOUSE_DATABASE \}\}/$CLICKHOUSE_DATABASE}
      
      # Handle envsubst syntax
      content=${content//\$\{ENVIRONMENT\}/$ENVIRONMENT}
      content=${content//\$\{NODE_ENV\}/$NODE_ENV}
      content=${content//\$\{POSTGRES_USER\}/$POSTGRES_USER}
      content=${content//\$\{POSTGRES_DB\}/$POSTGRES_DB}
      content=${content//\$\{CLICKHOUSE_DATABASE\}/$CLICKHOUSE_DATABASE}
      
      local staging_file="infrastructure/${file%.yaml}.staging.yaml"
      echo "$content" > "$staging_file"
      exec_cmd "kubectl apply -f $staging_file"
    fi
  done
  
  # Apply any remaining infrastructure files
  exec_cmd "kubectl apply -f infrastructure/ --ignore-not-found=true" || true
  
  # Update deployment manifests with new image tags
  info "Updating deployment manifests..."
  for service in "${SERVICES[@]}"; do
    local deployment_file image_name
    
    if [[ "$service" == "nextjs-app" ]]; then
      deployment_file="deployment-social-proof-app.yaml"
      image_name="${registry}/${PROJECT_ID}/social-proof-app:${image_tag}"
    else
      deployment_file="deployments/${service}-service.yaml"
      image_name="${registry}/${PROJECT_ID}/${service}:${image_tag}"
    fi
    
    if [[ -f "$deployment_file" ]]; then
      # Update image tag in deployment file
      local content
      content=$(cat "$deployment_file")
      
      if [[ "$service" == "nextjs-app" ]]; then
        # Update social-proof-app image
        content=$(echo "$content" | sed -E "s|image: [^[:space:]]+/social-proof-app[^[:space:]]*|image: $image_name|g")
      else
        # Update microservice image
        content=$(echo "$content" | sed -E "s|${registry}/\\\$\{GCP_PROJECT_ID\}/${service}:.*|$image_name|g")
      fi
      
      local staging_file
      if [[ "$service" == "nextjs-app" ]]; then
        staging_file="deployment-social-proof-app.staging.yaml"
      else
        staging_file="${service}-service.staging.yaml"
      fi
      
      echo "$content" > "$staging_file"
      exec_cmd "kubectl apply -f $staging_file"
    fi
  done
  
  # Apply services
  info "Applying services..."
  exec_cmd "kubectl apply -f services/"
  
  success "Kubernetes deployment completed"
  
  # Clean up temporary files
  info "Cleaning up temporary files..."
  rm -f configmap.staging.yaml secrets.staging.yaml *.staging.yaml infrastructure/*.staging.yaml || true
  
  # Change back to project root
  cd "$PROJECT_ROOT"
}

# Verify deployment
verify_deployment() {
  info "Verifying deployment..."
  
  # Wait a moment for pods to start
  info "Waiting for pods to start..."
  sleep 10
  
  info "Pod status:"
  kubectl get pods -n social-proof-system || true
  
  info "Service status:"
  kubectl get services -n social-proof-system || true
  
  success "Deployment verification completed"
}

# Main function
main() {
  log "\n🚀 Starting Staging Deployment" $CYAN
  log "================================\n" $CYAN
  
  # Change to project root
  cd "$PROJECT_ROOT"
  
  # Load environment and check prerequisites
  load_environment
  get_branch_info
  check_prerequisites
  
  # Confirm deployment
  confirm_deployment
  
  # Execute deployment steps
  configure_gcloud_docker
  build_and_push_images
  deploy_to_kubernetes
  verify_deployment
  
  log "\n🎉 Staging Deployment Completed Successfully!" $GREEN
  log "==========================================\n" $GREEN
  
  info "Next steps:"
  info "1. Check deployment status: kubectl get pods -n social-proof-system"
  info "2. View logs: kubectl logs -n social-proof-system -l app=<service-name>"
  info "3. Access staging environment: https://staging.pulsesocialproof.com"
}

# Run main function
main "$@" 