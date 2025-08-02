#!/bin/bash

set -e

echo "🧪 Testing Social Proof MVP Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_error() {
    echo -e "${RED}[TEST]${NC} $1"
}

# Test configuration
API_KEY="mvp_test_api_key_12345"
SITE_ID="550e8400-e29b-41d4-a716-446655440003"
TEST_ENDPOINT_BASE="http://localhost"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_status "Running test: $test_name"
    
    if eval "$test_command"; then
        print_success "✅ $test_name - PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        print_error "❌ $test_name - FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to test HTTP endpoint
test_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    run_test "$name" "curl -s -o /dev/null -w '%{http_code}' '$url' | grep -q '$expected_status'" "$expected_status"
}

# Function to test JSON API endpoint
test_json_api() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="${4:-}"
    local expected_status="${5:-200}"
    
    local curl_cmd="curl -s -w '%{http_code}' -H 'Content-Type: application/json'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd -X $method '$url'"
    
    run_test "$name" "$curl_cmd | tail -1 | grep -q '$expected_status'" "$expected_status"
}

print_status "Starting comprehensive MVP testing..."
echo ""

# Test 1: Infrastructure Services Health
print_status "=== Testing Infrastructure Services ==="

test_http_endpoint "PostgreSQL Connection Test" "$TEST_ENDPOINT_BASE:5432" "52"  # Connection established
test_http_endpoint "Redis Health Check" "$TEST_ENDPOINT_BASE:6379" "52"          # Connection established  
test_http_endpoint "ClickHouse Ping" "$TEST_ENDPOINT_BASE:8123/ping" "200"
test_http_endpoint "Kafka Bootstrap" "$TEST_ENDPOINT_BASE:29092" "52"            # Connection established

echo ""

# Test 2: External Service Mocks
print_status "=== Testing External Service Mocks ==="

test_http_endpoint "External Mocks Health" "$TEST_ENDPOINT_BASE:4000/health" "200"
test_http_endpoint "External Mocks Status" "$TEST_ENDPOINT_BASE:4000/status" "200"
test_json_api "SendGrid Mock" "$TEST_ENDPOINT_BASE:4000/sendgrid/v3/mail/send" "POST" '{"to":"test@example.com","subject":"Test"}' "202"
test_json_api "Firebase Mock" "$TEST_ENDPOINT_BASE:4000/firebase/messaging/send" "POST" '{"token":"test-token","message":"Test"}' "200"
test_json_api "Stripe Mock" "$TEST_ENDPOINT_BASE:4000/stripe/v1/payment_intents" "POST" '{"amount":2000,"currency":"usd"}' "200"

echo ""

# Test 3: Microservices Health (if they have health endpoints)
print_status "=== Testing Microservices ==="

services=("3001:Integrations" "3002:Notification-Stream" "3003:Notifications" "3004:Users" "3005:Analytics" "3006:Billing")

for service in "${services[@]}"; do
    IFS=':' read -ra ADDR <<< "$service"
    port=${ADDR[0]}
    name=${ADDR[1]}
    
    # Test basic connectivity (since these are basic containers, they might not have health endpoints)
    run_test "$name Service Connectivity" "nc -z localhost $port" "0"
done

echo ""

# Test 4: Database Schema Validation
print_status "=== Testing Database Schema ==="

# Test PostgreSQL tables exist
run_test "PostgreSQL Organizations Table" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c '\\dt organizations' | grep -q 'organizations'" "0"
run_test "PostgreSQL Users Table" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c '\\dt users' | grep -q 'users'" "0"
run_test "PostgreSQL Sites Table" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c '\\dt sites' | grep -q 'sites'" "0"
run_test "PostgreSQL Events Table" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c '\\dt events' | grep -q 'events'" "0"

# Test sample data exists
run_test "Sample Organization Data" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c 'SELECT COUNT(*) FROM organizations;' | grep -q '1'" "0"
run_test "Sample Site Data" "docker exec social-proof-postgres psql -U postgres -d social_proof_mvp -c 'SELECT COUNT(*) FROM sites;' | grep -q '1'" "0"

echo ""

# Test 5: Kafka Topics
print_status "=== Testing Kafka Topics ==="

run_test "Kafka Social Proof Events Topic" "docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list | grep -q 'social-proof-events'" "0"
run_test "Kafka Notification Requests Topic" "docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list | grep -q 'notification-requests'" "0"
run_test "Kafka Analytics Events Topic" "docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list | grep -q 'analytics-events'" "0"

echo ""

# Test 6: ClickHouse Analytics
print_status "=== Testing ClickHouse Analytics ==="

run_test "ClickHouse Analytics Database" "curl -s '$TEST_ENDPOINT_BASE:8123/?query=SHOW DATABASES' | grep -q 'analytics'" "0"
run_test "ClickHouse Events Table" "curl -s '$TEST_ENDPOINT_BASE:8123/?query=SHOW TABLES FROM analytics' | grep -q 'events'" "0"
run_test "ClickHouse Sample Data" "curl -s '$TEST_ENDPOINT_BASE:8123/?query=SELECT COUNT(*) FROM analytics.events' | grep -q '2'" "0"

echo ""

# Test 7: End-to-End Event Flow Simulation
print_status "=== Testing End-to-End Event Flow ==="

# Simulate Shopify webhook event
SHOPIFY_WEBHOOK_DATA='{
  "id": 123456789,
  "email": "test@example.com",
  "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "line_items": [
    {
      "id": 987654321,
      "title": "Test Product",
      "quantity": 1,
      "price": "29.99"
    }
  ],
  "shipping_address": {
    "city": "San Francisco",
    "country": "United States"
  }
}'

print_status "Simulating Shopify webhook event..."
test_json_api "Shopify Webhook Simulation" "$TEST_ENDPOINT_BASE:4000/webhooks/shopify" "POST" "$SHOPIFY_WEBHOOK_DATA" "200"

# Test Redis key operations
run_test "Redis SET Operation" "docker exec social-proof-redis redis-cli SET test-key 'test-value' | grep -q 'OK'" "0"
run_test "Redis GET Operation" "docker exec social-proof-redis redis-cli GET test-key | grep -q 'test-value'" "0"

echo ""

# Test 8: Container Health and Resource Usage
print_status "=== Testing Container Health ==="

containers=("social-proof-kafka" "social-proof-redis" "social-proof-postgres" "social-proof-clickhouse" "social-proof-mocks")

for container in "${containers[@]}"; do
    run_test "$container Container Running" "docker ps --filter name=$container --filter status=running | grep -q $container" "0"
done

echo ""

# Test 9: Network Connectivity
print_status "=== Testing Network Connectivity ==="

run_test "Social Proof Network Exists" "docker network ls | grep -q social-proof-network" "0"
run_test "Container Network Communication" "docker exec social-proof-postgres ping -c 1 social-proof-redis > /dev/null 2>&1" "0"

echo ""

# Test 10: Environment Configuration
print_status "=== Testing Environment Configuration ==="

if [ -f "config/.env.mvp" ]; then
    run_test "Environment File Exists" "test -f config/.env.mvp" "0"
    run_test "Environment File Has Database URL" "grep -q 'DATABASE_URL' config/.env.mvp" "0"
    run_test "Environment File Has Kafka Config" "grep -q 'KAFKA_BROKERS' config/.env.mvp" "0"
else
    print_warning "Environment file config/.env.mvp not found - this is optional for testing"
fi

echo ""

# Final Test Summary
print_status "=== Test Summary ==="
echo ""
print_status "Total Tests Run: $TOTAL_TESTS"
print_success "Tests Passed: $PASSED_TESTS"

if [ $FAILED_TESTS -gt 0 ]; then
    print_error "Tests Failed: $FAILED_TESTS"
    echo ""
    print_error "❌ Some tests failed. Please check the logs above for details."
    
    print_status "Common troubleshooting steps:"
    echo "  1. Ensure all services are fully started: ./scripts/start-mvp.sh"
    echo "  2. Check service logs: docker-compose -f docker-compose-mvp.yml logs"
    echo "  3. Verify Docker resources are sufficient"
    echo "  4. Check network connectivity between containers"
    
    exit 1
else
    echo ""
    print_success "🎉 All tests passed! MVP stack is working correctly."
    
    print_status "Next steps:"
    echo "  📊 Access the dashboard: http://localhost:3000"
    echo "  🛠️  Start developing: Check the Next.js app"
    echo "  📈 Monitor services: Check logs and metrics"
    echo "  🧪 Run integration tests: Develop and test your features"
    
    exit 0
fi 