#!/bin/bash

set -e

echo "🛑 Stopping Social Proof MINIMAL Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[MINIMAL]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[MINIMAL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[MINIMAL]${NC} $1"
}

print_error() {
    echo -e "${RED}[MINIMAL]${NC} $1"
}

# Check if docker-compose is available
if ! command -v docker-compose &>/dev/null; then
    print_error "docker-compose is not installed or not in PATH."
    exit 1
fi

# Check if minimal compose file exists
if [ ! -f "docker-compose-minimal.yml" ]; then
    print_error "docker-compose-minimal.yml not found in current directory."
    exit 1
fi

# Stop all services
print_status "Stopping all minimal services..."
docker-compose -f docker-compose-minimal.yml down --remove-orphans

# Optionally remove volumes (ask user)
if [ "$1" = "--remove-volumes" ] || [ "$1" = "-v" ]; then
    print_warning "Removing all volumes (this will delete all data)..."
    docker-compose -f docker-compose-minimal.yml down -v
elif [ "$1" = "--remove-all" ] || [ "$1" = "-a" ]; then
    print_warning "Removing all containers, volumes, and images..."
    docker-compose -f docker-compose-minimal.yml down -v --rmi all
else
    print_status "Data volumes preserved. Use --remove-volumes to delete data."
fi

# Show remaining containers
remaining=$(docker ps -q | wc -l)
if [ "$remaining" -gt 0 ]; then
    print_status "Remaining running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_success "All containers stopped"
fi

# Show disk usage
print_status "Docker disk usage:"
docker system df

print_success "🛑 Minimal stack stopped successfully!"

if [ "$1" != "--remove-volumes" ] && [ "$1" != "-v" ] && [ "$1" != "--remove-all" ] && [ "$1" != "-a" ]; then
    echo ""
    print_status "To restart: ./scripts/start-minimal.sh"
    print_status "To clean volumes: $0 --remove-volumes"
    print_status "To clean everything: $0 --remove-all"
fi