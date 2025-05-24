# Social Proof MVP - Local Development Environment

## 🎯 Overview

This MVP provides a complete local development environment for the Social Proof application - an enterprise-grade clone of Fomo that delivers real-time social-proof notifications across web popups, email, and push notifications.

## 🏗️ Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Microservices  │    │ Infrastructure  │
│   (Port 3000)   │    │   (Ports 3001-6) │    │   Services      │
│                 │    │                  │    │                 │
│ • Dashboard     │◄──►│ • Integrations   │◄──►│ • PostgreSQL    │
│ • Widget        │    │ • Notifications  │    │ • TimescaleDB   │
│ • Authentication│    │ • Users          │    │ • ClickHouse    │
│ • Admin Panel   │    │ • Analytics      │    │ • Redis         │
│                 │    │ • Billing        │    │ • Kafka         │
│                 │    │ • Notification   │    │                 │
│                 │    │   Stream (SSE)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

```
Shopify Webhook → Kafka → Microservices → Redis → SSE → Widget
       ↓              ↓           ↓         ↓
   PostgreSQL    ClickHouse   External   Real-time
   (Events)      (Analytics)   Services   Updates
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (4.0+)
- Docker Compose (2.0+)
- Git
- 8GB+ RAM available for Docker

### 1. Start the MVP Stack

```bash
# Start all services
./scripts/start-mvp.sh
```

This will:
- Start infrastructure services (Kafka, Redis, PostgreSQL, ClickHouse)
- Initialize databases with schema and sample data
- Create Kafka topics
- Start all microservices
- Start the Next.js application
- Start external service mocks

### 2. Verify Installation

```bash
# Run comprehensive tests
./scripts/test-mvp.sh
```

### 3. Access Services

- **📊 Main Application**: http://localhost:3000
- **🎭 External Mocks**: http://localhost:4000
- **🗄️ PostgreSQL**: localhost:5432 (postgres/postgres)
- **🔴 Redis**: localhost:6379
- **📨 Kafka**: localhost:29092
- **🏢 ClickHouse**: localhost:8123

## 🛠️ Development

### Managing Services

```bash
# Start MVP stack
./scripts/start-mvp.sh

# Stop MVP stack
./scripts/stop-mvp.sh

# Stop and clean all data
./scripts/stop-mvp.sh --clean

# View logs
./scripts/logs-mvp.sh all -f
./scripts/logs-mvp.sh kafka -n 100
./scripts/logs-mvp.sh services --follow

# Run tests
./scripts/test-mvp.sh
```

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Next.js App | http://localhost:3000 | Main application UI |
| Integrations | http://localhost:3001 | Shopify/WooCommerce integration |
| Notification Stream | http://localhost:3002 | SSE endpoints for real-time updates |
| Notifications | http://localhost:3003 | Email/Push notification service |
| Users | http://localhost:3004 | User management and auth |
| Analytics | http://localhost:3005 | Analytics data processing |
| Billing | http://localhost:3006 | Subscription and billing |
| External Mocks | http://localhost:4000 | Mock external services |

### Environment Configuration

Environment variables are configured in `config/mvp.env`. Key variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social_proof_mvp

# Kafka
KAFKA_BROKERS=localhost:29092

# External Services (Mocked)
SENDGRID_API_KEY=SG.mock_sendgrid_api_key_for_testing
FIREBASE_PROJECT_ID=mock-firebase-project-mvp
STRIPE_SECRET_KEY=sk_test_mock_stripe_secret_key_for_testing
```

## 📊 Database Schema

### PostgreSQL (TimescaleDB)

Core tables with time-series optimization:

- **organizations**: Company/client data
- **users**: User accounts with Clerk integration
- **sites**: Client websites and API keys
- **notification_templates**: Popup/email templates
- **events**: Time-series event data (90-day retention)
- **notifications**: Sent notifications tracking
- **analytics_sessions**: User session tracking
- **widget_interactions**: Click/impression data
- **ab_tests**: A/B test configurations

### ClickHouse (Analytics)

High-performance analytics tables:

- **events**: Event analytics with partitioning
- **notifications**: Notification performance metrics
- **widget_interactions**: Interaction analytics
- **revenue_events**: Revenue tracking
- **ab_test_results**: A/B test outcomes

## 🧪 Testing

### Automated Tests

```bash
# Full test suite
./scripts/test-mvp.sh

# Individual test categories
Infrastructure Services ✓
External Service Mocks ✓
Database Schema ✓
Kafka Topics ✓
ClickHouse Analytics ✓
End-to-End Event Flow ✓
Container Health ✓
Network Connectivity ✓
```

### Manual Testing

1. **Shopify Webhook Simulation**:
   ```bash
   curl -X POST http://localhost:4000/webhooks/shopify \
     -H "Content-Type: application/json" \
     -d '{"id": 123, "email": "test@example.com", "line_items": [{"title": "Test Product"}]}'
   ```

2. **Database Queries**:
   ```bash
   docker exec -it social-proof-postgres psql -U postgres -d social_proof_mvp
   ```

3. **ClickHouse Analytics**:
   ```bash
   curl "http://localhost:8123/?query=SELECT COUNT(*) FROM analytics.events"
   ```

## 🔧 Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker resources
docker system df
docker system prune -f

# Restart Docker Desktop
# Increase Docker memory allocation to 8GB+
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker exec social-proof-postgres pg_isready -U postgres

# Reset database
./scripts/stop-mvp.sh --clean
./scripts/start-mvp.sh
```

#### Kafka Issues

```bash
# Check Kafka topics
docker exec social-proof-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer groups
docker exec social-proof-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

#### Port Conflicts

```bash
# Check port usage
netstat -an | grep LISTEN | grep -E ":(3000|3001|3002|3003|3004|3005|3006|4000|5432|6379|8123|29092)"

# Stop conflicting services or modify ports in docker-compose-mvp.yml
```

### Logs and Monitoring

```bash
# View all logs
./scripts/logs-mvp.sh all -f

# Check specific service
./scripts/logs-mvp.sh postgres -n 50

# Monitor resources
docker stats

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Performance Optimization

1. **Increase Docker Resources**:
   - Memory: 8GB minimum, 16GB recommended
   - CPU: 4 cores minimum
   - Disk: 50GB free space

2. **Database Tuning**:
   ```sql
   -- PostgreSQL settings for development
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   ```

3. **Kafka Optimization**:
   ```yaml
   # Increase partition count for high throughput
   KAFKA_NUM_PARTITIONS: 6
   KAFKA_DEFAULT_REPLICATION_FACTOR: 1
   ```

## 🔒 Security Notes

### Development Security

- All external services are mocked for safety
- No real API keys or credentials required
- Database passwords are defaults (change for production)
- HTTPS not configured (development only)

### Production Considerations

- Replace mock credentials with real ones
- Enable HTTPS/TLS encryption
- Implement proper secret management
- Configure production database settings
- Set up monitoring and alerting

## 🚦 Next Steps

### Phase 1: Core Development
1. Implement Clerk authentication integration
2. Build dashboard UI components
3. Create notification templates system
4. Develop widget JavaScript embed code

### Phase 2: Integration
1. Real Shopify/WooCommerce webhook handling
2. SendGrid email integration
3. Firebase push notifications
4. Stripe billing integration

### Phase 3: Advanced Features
1. A/B testing framework
2. Advanced analytics dashboards
3. Real-time performance monitoring
4. Multi-tenant architecture

## 📚 Additional Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Clerk Authentication](https://clerk.dev/docs)
- [TimescaleDB Guide](https://docs.timescale.com/)
- [ClickHouse Documentation](https://clickhouse.com/docs/)
- [Apache Kafka Quickstart](https://kafka.apache.org/quickstart)

## 🤝 Contributing

1. Make changes to microservices or frontend
2. Test with `./scripts/test-mvp.sh`
3. Check logs with `./scripts/logs-mvp.sh`
4. Commit and push changes

## 📞 Support

For issues with this MVP setup:

1. Check this README troubleshooting section
2. Review service logs: `./scripts/logs-mvp.sh all`
3. Verify all tests pass: `./scripts/test-mvp.sh`
4. Reset environment: `./scripts/stop-mvp.sh --clean && ./scripts/start-mvp.sh`

---

**🎉 Happy coding! Your Social Proof MVP is ready for development.** 