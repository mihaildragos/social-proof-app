#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[SETUP]${NC} $1"
}

print_error() {
    echo -e "${RED}[SETUP]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

echo ""
print_header "🔧 MINIMAL DEPLOYMENT ENVIRONMENT SETUP"
print_header "========================================"

# Check if we're in the right directory
if [ ! -f "docker-compose-minimal.yml" ]; then
    print_error "docker-compose-minimal.yml not found. Please run this script from the project root."
    exit 1
fi

# Check if .env.minimal already exists
if [ -f ".env.minimal" ]; then
    print_warning ".env.minimal already exists!"
    echo -n "Do you want to overwrite it? (y/N): "
    read -r response
    case "$response" in
        [yY]|[yY][eE][sS])
            print_status "Overwriting existing .env.minimal..."
            ;;
        *)
            print_status "Keeping existing .env.minimal. Exiting."
            exit 0
            ;;
    esac
fi

# Copy from example if it exists
if [ -f ".env.minimal.example" ]; then
    print_status "Copying from .env.minimal.example..."
    cp .env.minimal.example .env.minimal
else
    print_error ".env.minimal.example not found!"
    exit 1
fi

print_success "✅ Environment file created: .env.minimal"
echo ""

# Generate secure passwords and secrets
print_status "🔐 Generating secure passwords and secrets..."

# Generate PostgreSQL password
POSTGRES_PASSWORD=$(openssl rand -base64 32)
print_status "Generated PostgreSQL password"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64)
print_status "Generated JWT secret"

# Update the .env.minimal file with generated secrets
sed -i.bak "s/your_secure_postgres_password_here/$POSTGRES_PASSWORD/" .env.minimal
sed -i.bak "s/your_jwt_secret_key_here/$JWT_SECRET/" .env.minimal

# Remove backup file
rm -f .env.minimal.bak

print_success "✅ Auto-generated secure passwords"
echo ""

# Interactive setup for required services
print_header "📝 REQUIRED SERVICE CONFIGURATION"
print_header "================================="
echo ""

# Clerk setup
print_status "🔐 Clerk Authentication Setup"
echo "You need to configure Clerk for user authentication."
echo "1. Go to https://clerk.com and create an account"
echo "2. Create a new application"
echo "3. Copy your keys from the dashboard"
echo ""

echo -n "Enter your Clerk Secret Key (sk_test_...): "
read -r CLERK_SECRET_KEY
if [ -n "$CLERK_SECRET_KEY" ]; then
    sed -i.bak "s/sk_test_your_clerk_secret_key_here/$CLERK_SECRET_KEY/" .env.minimal
    print_success "✅ Clerk Secret Key configured"
fi

echo -n "Enter your Clerk Publishable Key (pk_test_...): "
read -r CLERK_PUBLISHABLE_KEY
if [ -n "$CLERK_PUBLISHABLE_KEY" ]; then
    sed -i.bak "s/pk_test_your_clerk_publishable_key_here/$CLERK_PUBLISHABLE_KEY/" .env.minimal
    print_success "✅ Clerk Publishable Key configured"
fi

echo ""

# Stripe setup
print_status "💳 Stripe Payment Setup"
echo "Configure Stripe for payment processing (required for billing features)."
echo "1. Go to https://stripe.com and create an account"
echo "2. Get your API keys from the dashboard"
echo ""

echo -n "Enter your Stripe Secret Key (sk_test_...): "
read -r STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
    sed -i.bak "s/sk_test_your_stripe_secret_key_here/$STRIPE_SECRET_KEY/" .env.minimal
    print_success "✅ Stripe Secret Key configured"
fi

echo -n "Enter your Stripe Webhook Secret (whsec_...): "
read -r STRIPE_WEBHOOK_SECRET
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
    sed -i.bak "s/whsec_your_stripe_webhook_secret_here/$STRIPE_WEBHOOK_SECRET/" .env.minimal
    print_success "✅ Stripe Webhook Secret configured"
fi

echo ""

# Optional services
print_header "📧 OPTIONAL SERVICE CONFIGURATION"
print_header "================================="
echo ""

echo -n "Do you want to configure SendGrid for email? (y/N): "
read -r setup_sendgrid
if [[ "$setup_sendgrid" =~ ^[Yy]$ ]]; then
    echo "1. Go to https://sendgrid.com and create an account"
    echo "2. Create an API key in the dashboard"
    echo ""
    echo -n "Enter your SendGrid API Key: "
    read -r SENDGRID_API_KEY
    if [ -n "$SENDGRID_API_KEY" ]; then
        sed -i.bak "s/SG.your_sendgrid_api_key_here/$SENDGRID_API_KEY/" .env.minimal
        print_success "✅ SendGrid configured"
    fi
fi

echo ""

echo -n "Do you want to configure Supabase? (y/N): "
read -r setup_supabase
if [[ "$setup_supabase" =~ ^[Yy]$ ]]; then
    echo "1. Go to https://supabase.com and create a project"
    echo "2. Get your URL and service role key from settings"
    echo ""
    echo -n "Enter your Supabase URL: "
    read -r SUPABASE_URL
    if [ -n "$SUPABASE_URL" ]; then
        sed -i.bak "s|https://your-project.supabase.co|$SUPABASE_URL|" .env.minimal
        print_success "✅ Supabase URL configured"
    fi
    
    echo -n "Enter your Supabase Service Role Key: "
    read -r SUPABASE_KEY
    if [ -n "$SUPABASE_KEY" ]; then
        sed -i.bak "s/your_supabase_service_role_key_here/$SUPABASE_KEY/" .env.minimal
        print_success "✅ Supabase Service Key configured"
    fi
fi

# Clean up backup files
rm -f .env.minimal.bak

echo ""
print_header "🌐 DEPLOYMENT CONFIGURATION"
print_header "==========================="

# Get current IP for development
current_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
print_status "Detected internal IP: $current_ip"

echo ""
echo "Choose your deployment target:"
echo "1. Local development (localhost)"
echo "2. VM deployment (will prompt for IP/domain)"
echo "3. Custom domain"
echo ""

echo -n "Select option (1-3): "
read -r deployment_option

case $deployment_option in
    1)
        frontend_url="http://localhost:3000"
        ;;
    2)
        echo -n "Enter your VM IP address: "
        read -r vm_ip
        frontend_url="http://$vm_ip:3000"
        ;;
    3)
        echo -n "Enter your domain (e.g., yourdomain.com): "
        read -r domain
        frontend_url="https://$domain"
        ;;
    *)
        print_warning "Invalid option. Using localhost."
        frontend_url="http://localhost:3000"
        ;;
esac

# Update frontend URL in the file
sed -i.bak "s|http://your-vm-ip:3000|$frontend_url|g" .env.minimal
rm -f .env.minimal.bak

print_success "✅ Frontend URL set to: $frontend_url"

echo ""
print_header "✅ SETUP COMPLETE!"
print_header "=================="
echo ""

print_success "🎉 Your minimal deployment environment is configured!"
echo ""
print_status "📁 Configuration file: .env.minimal"
print_status "🚀 To start the stack: ./scripts/start-minimal.sh"
print_status "📊 To check status: ./scripts/status-minimal.sh"
print_status "📋 To view logs: ./scripts/logs-minimal.sh"
echo ""

print_warning "⚠️  IMPORTANT NOTES:"
echo "  • Keep your .env.minimal file secure and never commit it to git"
echo "  • Add .env.minimal to your .gitignore file"
echo "  • This configuration is optimized for <100 users"
echo "  • Estimated monthly cost: ~£22 (vs £125+ for enterprise)"
echo ""

print_status "🔧 Next steps:"
echo "  1. Review and customize .env.minimal if needed"
echo "  2. Run: ./scripts/start-minimal.sh"
echo "  3. Access your app at: $frontend_url"
echo "  4. Set up monitoring and backups"
echo ""

print_success "🎯 Ready for minimal cost deployment!"