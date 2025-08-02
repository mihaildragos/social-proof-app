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
    echo -e "${BLUE}[HEALTH]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[HEALTH]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[HEALTH]${NC} $1"
}

print_error() {
    echo -e "${RED}[HEALTH]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Configuration
TIMEOUT=300  # 5 minutes timeout
CHECK_INTERVAL=10  # Check every 10 seconds
REQUIRED_SERVICES=("postgres" "redis" "integrations-service" "notifications-service" "users-service" "billing-service" "nextjs-app")
OPTIONAL_SERVICES=("notification-stream-service" "nginx")

# Health check URLs
declare -A HEALTH_URLS=(
    ["nextjs-app"]="http://localhost:3000"
    ["integrations-service"]="http://localhost:3001/health"
    ["notification-stream-service"]="http://localhost:3002/health"
    ["notifications-service"]="http://localhost:3003/health"
    ["users-service"]="http://localhost:3004/health"
    ["billing-service"]="http://localhost:3006/health"
)

# Parse command line arguments
DETAILED=false
CONTINUOUS=false
ROLLBACK_ON_FAILURE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detailed)
            DETAILED=true
            shift
            ;;
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK_ON_FAILURE=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -d, --detailed         Show detailed health information"
            echo "  -c, --continuous       Run continuous health monitoring"
            echo "  -r, --rollback         Rollback on health check failure"
            echo "      --timeout SECONDS  Health check timeout (default: 300)"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                     Run basic health check"
            echo "  $0 -d                  Run detailed health check"
            echo "  $0 -c                  Monitor health continuously"
            echo "  $0 -r                  Run health check with rollback on failure"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

# Function to check container health
check_container_health() {
    local service=$1
    local container_name="social-proof-$service"
    
    # Special case for some service names
    case $service in
        "integrations-service")
            container_name="social-proof-integrations"
            ;;
        "notification-stream-service")
            container_name="social-proof-notification-stream"
            ;;
        "notifications-service")
            container_name="social-proof-notifications"
            ;;
        "users-service")
            container_name="social-proof-users"
            ;;
        "billing-service")
            container_name="social-proof-billing"
            ;;
        "nextjs-app")
            container_name="social-proof-nextjs"
            ;;
    esac
    
    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "^$container_name$"; then
        return 1
    fi
    
    # Check container status
    status=$(docker inspect --format="{{.State.Status}}" "$container_name" 2>/dev/null || echo "not_found")
    if [ "$status" != "running" ]; then
        return 1
    fi
    
    return 0
}

# Function to check HTTP health endpoint
check_http_health() {
    local service=$1
    local url=${HEALTH_URLS[$service]}
    
    if [ -z "$url" ]; then
        return 0  # No HTTP check for this service
    fi
    
    # Try to curl the health endpoint
    if curl -s -f -m 5 "$url" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check database connectivity
check_database_health() {
    local service=$1
    
    case $service in
        "postgres")
            if docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1; then
                return 0
            fi
            ;;
        "redis")
            if docker exec social-proof-redis redis-cli ping >/dev/null 2>&1; then
                return 0
            fi
            ;;
    esac
    
    return 1
}

# Function to perform comprehensive health check
perform_health_check() {
    local failed_services=()
    local total_checks=0
    local passed_checks=0
    
    print_header "🔍 MINIMAL STACK HEALTH CHECK"
    print_header "============================="
    
    # Check container status
    print_status "Checking container status..."
    for service in "${REQUIRED_SERVICES[@]}" "${OPTIONAL_SERVICES[@]}"; do
        total_checks=$((total_checks + 1))
        
        if check_container_health "$service"; then
            print_success "✅ $service container is running"
            passed_checks=$((passed_checks + 1))
        else
            print_error "❌ $service container is not running"
            failed_services+=("$service")
        fi
    done
    
    echo ""
    
    # Check database connectivity
    print_status "Checking database connectivity..."
    for db_service in "postgres" "redis"; do
        total_checks=$((total_checks + 1))
        
        if check_database_health "$db_service"; then
            print_success "✅ $db_service is accessible"
            passed_checks=$((passed_checks + 1))
        else
            print_error "❌ $db_service is not accessible"
            failed_services+=("$db_service")
        fi
    done
    
    echo ""
    
    # Check HTTP endpoints
    print_status "Checking HTTP endpoints..."
    for service in "${!HEALTH_URLS[@]}"; do
        total_checks=$((total_checks + 1))
        
        if check_http_health "$service"; then
            print_success "✅ $service HTTP endpoint is healthy"
            passed_checks=$((passed_checks + 1))
        else
            print_warning "⚠️  $service HTTP endpoint check failed (may be expected)"
            # Don't add to failed_services for HTTP checks as they might not have health endpoints
        fi
    done
    
    echo ""
    
    # Detailed checks if requested
    if [ "$DETAILED" = true ]; then
        print_status "Detailed system information..."
        
        # Resource usage
        echo ""
        print_status "Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -10
        
        # Disk usage
        echo ""
        print_status "Disk Usage:"
        df -h / | awk 'NR==2 {print "  💿 Root: " $3 "/" $2 " used (" $5 ")"}'
        docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}"
        
        # Memory usage
        echo ""
        print_status "Memory Usage:"
        free -h | awk '/^Mem:/ {print "  💾 Memory: " $3 "/" $2 " used (" int($3/$2*100) "%)"}'
        
        # Network
        echo ""
        print_status "Network Information:"
        hostname -I | awk '{print "  🌐 Internal IP: " $1}'
        
        # Logs check
        echo ""
        print_status "Recent Error Logs:"
        for service in "${REQUIRED_SERVICES[@]}"; do
            error_count=$(docker-compose -f docker-compose-minimal.yml logs "$service" 2>/dev/null | grep -i error | wc -l || echo "0")
            if [ "$error_count" -gt 0 ]; then
                print_warning "⚠️  $service has $error_count error entries in logs"
            fi
        done
    fi
    
    # Summary
    echo ""
    print_header "📊 HEALTH CHECK SUMMARY"
    print_header "======================="
    
    health_percentage=$((passed_checks * 100 / total_checks))
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_success "🎉 All systems healthy! ($passed_checks/$total_checks checks passed)"
        return 0
    else
        print_error "❌ Health check failed ($passed_checks/$total_checks checks passed, $health_percentage%)"
        print_error "Failed services: ${failed_services[*]}"
        return 1
    fi
}

# Function to rollback deployment
rollback_deployment() {
    print_warning "🔄 Attempting to rollback deployment..."
    
    # Stop current services
    print_status "Stopping current services..."
    docker-compose -f docker-compose-minimal.yml down --remove-orphans
    
    # Check if we have previous images
    print_status "Looking for previous images..."
    previous_images=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(social-proof|integrations|notifications|users|billing)" | grep -v latest | head -5)
    
    if [ -n "$previous_images" ]; then
        print_status "Found previous images:"
        echo "$previous_images"
        
        # For now, just restart with the same configuration
        # In a real scenario, you'd restore from a known good state
        print_status "Restarting services..."
        docker-compose -f docker-compose-minimal.yml up -d
        
        print_warning "⚠️  Basic rollback completed. Manual intervention may be required."
    else
        print_error "No previous images found for rollback."
        print_status "Attempting to restart current deployment..."
        docker-compose -f docker-compose-minimal.yml up -d
    fi
}

# Function for continuous monitoring
continuous_monitoring() {
    print_header "🔄 CONTINUOUS HEALTH MONITORING"
    print_header "==============================="
    print_status "Press Ctrl+C to stop monitoring"
    echo ""
    
    local consecutive_failures=0
    local max_consecutive_failures=3
    
    while true; do
        if perform_health_check >/dev/null 2>&1; then
            print_success "$(date): All systems healthy ✅"
            consecutive_failures=0
        else
            consecutive_failures=$((consecutive_failures + 1))
            print_error "$(date): Health check failed (failure #$consecutive_failures) ❌"
            
            if [ "$ROLLBACK_ON_FAILURE" = true ] && [ $consecutive_failures -ge $max_consecutive_failures ]; then
                print_error "Maximum consecutive failures reached. Triggering rollback..."
                rollback_deployment
                consecutive_failures=0
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Main execution
if [ "$CONTINUOUS" = true ]; then
    continuous_monitoring
else
    if perform_health_check; then
        exit 0
    else
        if [ "$ROLLBACK_ON_FAILURE" = true ]; then
            rollback_deployment
        fi
        exit 1
    fi
fi