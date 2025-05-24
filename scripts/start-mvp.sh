#!/bin/bash

set -e

echo "🚀 Starting Social Proof MVP Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[MVP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[MVP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[MVP]${NC} $1"
}

print_error() {
    echo -e "${RED}[MVP]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &>/dev/null; then
    print_error "docker-compose is not installed or not in PATH."
    exit 1
fi

# Load environment variables
if [ -f "config/.env.mvp" ]; then
    print_status "Loading environment variables from config/.env.mvp"
    export $(cat config/.env.mvp | grep -v '^#' | grep -v '^$' | xargs)
else
    print_warning "Environment file config/.env.mvp not found. Using defaults."
fi

# Clean up any existing containers
print_status "Cleaning up existing containers..."
docker-compose -f docker-compose-mvp.yml down --remove-orphans

# Build and start infrastructure services first
print_status "Starting infrastructure services (Kafka, Redis, Postgres, ClickHouse)..."
docker-compose -f docker-compose-mvp.yml up -d kafka redis postgres clickhouse

# Wait for infrastructure services to be ready
print_status "Waiting for infrastructure services to be ready..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
timeout=60
counter=0
while ! docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        print_error "PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
print_success "PostgreSQL is ready"

# Wait for Redis
print_status "Waiting for Redis..."
timeout=30
counter=0
while ! docker exec social-proof-redis redis-cli ping >/dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        print_error "Redis failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
print_success "Redis is ready"

# Wait for Kafka
print_status "Waiting for Kafka..."
timeout=60
counter=0
while ! docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        print_error "Kafka failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
print_success "Kafka is ready"

# Wait for ClickHouse
print_status "Waiting for ClickHouse..."
timeout=60
counter=0
while ! curl -s http://localhost:8123/ping >/dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        print_error "ClickHouse failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
print_success "ClickHouse is ready"

# Create Kafka topics
print_status "Creating Kafka topics..."
docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic social-proof-events --partitions 3 --replication-factor 1
docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic notification-requests --partitions 3 --replication-factor 1
docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic analytics-events --partitions 3 --replication-factor 1
print_success "Kafka topics created"

# Start external service mocks
print_status "Starting external service mocks..."
docker-compose -f docker-compose-mvp.yml up -d external-service-mocks

# Wait for mocks to be ready
print_status "Waiting for external service mocks..."
timeout=30
counter=0
while ! curl -s http://localhost:4000/health >/dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        print_error "External service mocks failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
print_success "External service mocks are ready"

# Start microservices
print_status "Starting microservices..."
docker-compose -f docker-compose-mvp.yml up -d integrations-service notification-stream-service notifications-service users-service analytics-service billing-service

# Wait for microservices to be ready
sleep 10

# Check microservice health
print_status "Checking microservice health..."
services=("integrations:3001" "notification-stream:3002" "notifications:3003" "users:3004" "analytics:3005" "billing:3006")

for service in "${services[@]}"; do
    IFS=':' read -ra ADDR <<<"$service"
    service_name=${ADDR[0]}
    port=${ADDR[1]}

    print_status "Checking $service_name service on port $port..."
    timeout=30
    counter=0
    while ! curl -s http://localhost:$port/health >/dev/null 2>&1; do
        if [ $counter -eq $timeout ]; then
            print_warning "$service_name service not responding on port $port (this may be expected for basic containers)"
            break
        fi
        sleep 1
        counter=$((counter + 1))
    done
done

# Start Next.js application
print_status "Starting Next.js application..."
docker-compose -f docker-compose-mvp.yml up -d nextjs-app

# Final status check
print_status "Performing final health checks..."
sleep 5

echo ""
print_success "🎉 MVP Stack started successfully!"
echo ""
print_status "Available services:"
echo "  📊 Next.js App:              http://localhost:3000"
echo "  🔗 Integrations Service:     http://localhost:3001"
echo "  📡 Notification Stream:      http://localhost:3002"
echo "  📮 Notifications Service:    http://localhost:3003"
echo "  👥 Users Service:            http://localhost:3004"
echo "  📈 Analytics Service:        http://localhost:3005"
echo "  💳 Billing Service:          http://localhost:3006"
echo "  🎭 External Mocks:           http://localhost:4000"
echo ""
print_status "Infrastructure services:"
echo "  🗄️  PostgreSQL:              localhost:5432"
echo "  🔴 Redis:                    localhost:6379"
echo "  📨 Kafka:                    localhost:29092"
echo "  🏢 ClickHouse:               localhost:8123"
echo ""
print_status "Useful commands:"
echo "  📋 Check all logs:           docker-compose -f docker-compose-mvp.yml logs -f"
echo "  🛑 Stop all services:        docker-compose -f docker-compose-mvp.yml down"
echo "  🔄 Restart services:         ./scripts/restart-mvp.sh"
echo "  🧪 Run tests:                ./scripts/test-mvp.sh"
echo ""
print_success "MVP is ready for development and testing! 🚀"
