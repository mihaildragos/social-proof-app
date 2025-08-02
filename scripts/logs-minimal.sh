#!/bin/bash

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

# Parse command line arguments
SERVICE=""
FOLLOW=false
TAIL_LINES=50

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -t|--tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS] [SERVICE]"
            echo ""
            echo "Options:"
            echo "  -f, --follow       Follow log output"
            echo "  -t, --tail LINES   Number of lines to show from end of logs (default: 50)"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Services:"
            echo "  postgres           PostgreSQL database"
            echo "  redis              Redis cache/message queue"
            echo "  integrations       Integrations service"
            echo "  notifications      Notifications service"
            echo "  notification-stream Notification stream service"
            echo "  users              Users service"
            echo "  billing            Billing service"
            echo "  nextjs-app         Next.js frontend"
            echo "  nginx              Nginx reverse proxy"
            echo ""
            echo "Examples:"
            echo "  $0                 Show logs for all services"
            echo "  $0 -f              Follow logs for all services"
            echo "  $0 postgres        Show logs for PostgreSQL only"
            echo "  $0 -f nextjs-app   Follow logs for Next.js app"
            exit 0
            ;;
        *)
            SERVICE="$1"
            shift
            ;;
    esac
done

# Build docker-compose logs command
CMD="docker-compose -f docker-compose-minimal.yml logs"

if [ "$FOLLOW" = true ]; then
    CMD="$CMD -f"
fi

CMD="$CMD --tail=$TAIL_LINES"

if [ -n "$SERVICE" ]; then
    CMD="$CMD $SERVICE"
    print_status "Showing logs for $SERVICE service..."
else
    print_status "Showing logs for all minimal services..."
fi

# Show service status first
print_status "Current service status:"
docker-compose -f docker-compose-minimal.yml ps

echo ""
if [ "$FOLLOW" = true ]; then
    print_status "Following logs (press Ctrl+C to stop)..."
else
    print_status "Showing last $TAIL_LINES lines..."
fi
echo ""

# Execute the logs command
eval $CMD