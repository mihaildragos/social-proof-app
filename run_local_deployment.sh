#!/bin/bash

# Create required directories if they don't exist
mkdir -p nginx/conf.d nginx/ssl nginx/www
mkdir -p backups

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Create self-signed SSL certificates for local testing if they don't exist
if [ ! -f "nginx/ssl/fullchain.pem" ] || [ ! -f "nginx/ssl/privkey.pem" ]; then
    echo "Generating self-signed SSL certificates for local testing..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
        -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

# Create .env.production file if it doesn't exist
if [ ! -f ".env.production" ]; then
    echo "Creating .env.production file..."
    cat > .env.production << EOF
# Database
DATABASE_URL=postgres://postgres:securepassword@postgres:5432/social_proof

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production

# API Gateway
API_GATEWAY_PORT=8000

# Frontend
FRONTEND_PORT=3000

# Shopify Integration
SHOPIFY_API_KEY=test_key
SHOPIFY_API_SECRET=test_secret
SHOPIFY_APP_URL=https://localhost

# Notification Settings
NOTIFICATION_RETENTION_DAYS=30
MAX_NOTIFICATIONS_PER_SITE=100
EOF
fi

# Start the application
echo "Starting the application..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Run health check
echo "Running health check..."
./health_check.sh

echo "Deployment completed. The application should be available at:"
echo "- HTTP: http://localhost"
echo "- HTTPS: https://localhost (you'll need to accept the self-signed certificate warning)"
echo
echo "To stop the application, run: docker-compose -f docker-compose.prod.yml down" 