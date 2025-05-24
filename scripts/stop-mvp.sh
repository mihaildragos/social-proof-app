#!/bin/bash

echo "🛑 Stopping Social Proof MVP Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[MVP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[MVP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[MVP]${NC} $1"
}

# Stop all services
print_status "Stopping all MVP services..."
docker-compose -f docker-compose-mvp.yml down --remove-orphans

# Clean up volumes if requested
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
    print_warning "Cleaning up volumes and data..."
    docker-compose -f docker-compose-mvp.yml down -v
    docker volume prune -f
    print_warning "All data has been removed!"
fi

# Show remaining containers
remaining=$(docker ps -a --filter "name=social-proof" --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
if [ -n "$remaining" ]; then
    print_warning "Remaining containers:"
    echo "$remaining"
else
    print_success "All MVP containers stopped successfully"
fi

print_success "✅ MVP Stack stopped"

echo ""
print_status "To restart: ./scripts/start-mvp.sh"
print_status "To clean all data: ./scripts/stop-mvp.sh --clean" 