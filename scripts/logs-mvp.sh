#!/bin/bash

echo "📋 Social Proof MVP Logs Viewer"

# Colors for output
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[LOGS]${NC} $1"
}

# Check if service name is provided
if [ -z "$1" ]; then
    print_status "Available services:"
    echo "  all                    - All services"
    echo "  infra                  - Infrastructure (Kafka, Redis, Postgres, ClickHouse)"
    echo "  services               - All microservices"
    echo "  integrations           - Integrations service"
    echo "  notification-stream    - Notification stream service"
    echo "  notifications          - Notifications service"
    echo "  users                  - Users service"
    echo "  analytics              - Analytics service"
    echo "  billing                - Billing service"
    echo "  nextjs                 - Next.js application"
    echo "  mocks                  - External service mocks"
    echo "  kafka                  - Kafka logs"
    echo "  redis                  - Redis logs"
    echo "  postgres               - PostgreSQL logs"
    echo "  clickhouse             - ClickHouse logs"
    echo ""
    echo "Usage: $0 <service-name> [options]"
    echo "Options:"
    echo "  -f, --follow           Follow log output"
    echo "  -n, --tail <number>    Number of lines to show from end"
    echo ""
    echo "Examples:"
    echo "  $0 all -f             # Follow all logs"
    echo "  $0 kafka -n 100       # Show last 100 lines of Kafka logs"
    echo "  $0 services --follow  # Follow all microservice logs"
    exit 1
fi

SERVICE="$1"
shift # Remove service name from arguments

# Set default docker-compose file
COMPOSE_FILE="docker-compose-mvp.yml"
COMPOSE_CMD="docker-compose -f $COMPOSE_FILE"

case "$SERVICE" in
    "all")
        print_status "Showing logs for all services..."
        $COMPOSE_CMD logs "$@"
        ;;
    "infra")
        print_status "Showing infrastructure logs..."
        $COMPOSE_CMD logs "$@" kafka redis postgres clickhouse
        ;;
    "services")
        print_status "Showing microservice logs..."
        $COMPOSE_CMD logs "$@" integrations-service notification-stream-service notifications-service users-service analytics-service billing-service
        ;;
    "integrations")
        print_status "Showing integrations service logs..."
        $COMPOSE_CMD logs "$@" integrations-service
        ;;
    "notification-stream")
        print_status "Showing notification stream service logs..."
        $COMPOSE_CMD logs "$@" notification-stream-service
        ;;
    "notifications")
        print_status "Showing notifications service logs..."
        $COMPOSE_CMD logs "$@" notifications-service
        ;;
    "users")
        print_status "Showing users service logs..."
        $COMPOSE_CMD logs "$@" users-service
        ;;
    "analytics")
        print_status "Showing analytics service logs..."
        $COMPOSE_CMD logs "$@" analytics-service
        ;;
    "billing")
        print_status "Showing billing service logs..."
        $COMPOSE_CMD logs "$@" billing-service
        ;;
    "nextjs")
        print_status "Showing Next.js application logs..."
        $COMPOSE_CMD logs "$@" nextjs-app
        ;;
    "mocks")
        print_status "Showing external service mocks logs..."
        $COMPOSE_CMD logs "$@" external-service-mocks
        ;;
    "kafka")
        print_status "Showing Kafka logs..."
        $COMPOSE_CMD logs "$@" kafka
        ;;
    "redis")
        print_status "Showing Redis logs..."
        $COMPOSE_CMD logs "$@" redis
        ;;
    "postgres")
        print_status "Showing PostgreSQL logs..."
        $COMPOSE_CMD logs "$@" postgres
        ;;
    "clickhouse")
        print_status "Showing ClickHouse logs..."
        $COMPOSE_CMD logs "$@" clickhouse
        ;;
    *)
        echo "Unknown service: $SERVICE"
        echo "Run '$0' without arguments to see available services."
        exit 1
        ;;
esac 