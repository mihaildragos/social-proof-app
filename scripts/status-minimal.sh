#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[STATUS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[STATUS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[STATUS]${NC} $1"
}

print_error() {
    echo -e "${RED}[STATUS]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
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

echo ""
print_header "🔍 MINIMAL STACK STATUS REPORT"
print_header "================================"

# Service status
echo ""
print_status "Container Status:"
docker-compose -f docker-compose-minimal.yml ps

# Resource usage
echo ""
print_status "Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" | head -10

# Disk usage
echo ""
print_status "Docker Disk Usage:"
docker system df

# Health checks
echo ""
print_status "Service Health Checks:"

# Check if services are responding
services=("nextjs-app:3000" "integrations-service:3001" "notification-stream-service:3002" "notifications-service:3003" "users-service:3004" "billing-service:3006")

for service in "${services[@]}"; do
    IFS=':' read -ra ADDR <<<"$service"
    service_name=${ADDR[0]}
    port=${ADDR[1]}
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null | grep -q "200"; then
        print_success "✅ $service_name (port $port) - Healthy"
    elif curl -s -o /dev/null "http://localhost:$port" 2>/dev/null; then
        print_warning "⚠️  $service_name (port $port) - Responding (no health endpoint)"
    else
        print_error "❌ $service_name (port $port) - Not responding"
    fi
done

# Database connectivity
echo ""
print_status "Database Connectivity:"

# Check PostgreSQL
if docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1; then
    print_success "✅ PostgreSQL - Connected"
else
    print_error "❌ PostgreSQL - Connection failed"
fi

# Check Redis
if docker exec social-proof-redis redis-cli ping >/dev/null 2>&1; then
    print_success "✅ Redis - Connected"
else
    print_error "❌ Redis - Connection failed"
fi

# System resources
echo ""
print_status "System Resources:"

# Memory usage
total_mem=$(free -h | awk '/^Mem:/ {print $2}')
used_mem=$(free -h | awk '/^Mem:/ {print $3}')
available_mem=$(free -h | awk '/^Mem:/ {print $7}')

echo "  💾 Memory: $used_mem / $total_mem used, $available_mem available"

# Disk usage
disk_usage=$(df -h / | awk 'NR==2 {print $3 "/" $2 " used (" $5 ")"}')
echo "  💿 Disk: $disk_usage"

# Network
echo ""
print_status "Network Information:"
hostname -I | awk '{print "  🌐 Internal IP: " $1}'

# If we can detect external IP
external_ip=$(curl -s -m 5 ifconfig.me 2>/dev/null || echo "Unable to detect")
echo "  🌍 External IP: $external_ip"

# Application URLs
echo ""
print_status "Application URLs:"
echo "  📊 Frontend:              http://localhost:3000"
echo "  🔗 Integrations Service:  http://localhost:3001"
echo "  📡 Notification Stream:   http://localhost:3002"
echo "  📮 Notifications:         http://localhost:3003"
echo "  👥 Users Service:         http://localhost:3004"
echo "  💳 Billing Service:       http://localhost:3006"

# Cost information
echo ""
print_status "💰 Cost Information:"
echo "  📉 Estimated monthly cost: ~£22 (vs £125+ for full enterprise stack)"
echo "  🎯 Optimized for: <100 concurrent users"
echo "  💾 Memory usage: ~2.5GB (vs 6GB+ for full stack)"

# Quick actions
echo ""
print_status "📋 Quick Actions:"
echo "  📋 View logs:    ./scripts/logs-minimal.sh [-f] [service]"
echo "  🔄 Restart:      ./scripts/start-minimal.sh"
echo "  🛑 Stop:         ./scripts/stop-minimal.sh"
echo "  📊 Monitor:      watch docker stats"

echo ""
print_header "🎉 Status report complete!"