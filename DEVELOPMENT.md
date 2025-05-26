# Development Guide

This guide covers the development workflow using Docker Compose for a production-like environment with excellent developer experience.

## Quick Start

### 1. Setup Environment
```bash
# Copy environment template
cp .env.dev.example .env.dev

# Edit with your development values
vim .env.dev
```

### 2. Start Everything
```bash
# Start all services (infrastructure + microservices + frontend)
npm run dev:all

# Or start in detached mode
npm run dev:all -- -d
```

### 3. View Logs
```bash
# Follow all logs with color-coded output
npm run dev:logs

# Follow specific service logs
npm run dev:logs -- billing
npm run dev:logs -- integrations
```

## Available Commands

### Service Management
```bash
npm run dev:all          # Start everything
npm run dev:services     # Start only microservices
npm run dev:infra        # Start only infrastructure (DB, Redis, Kafka)
npm run dev:frontend     # Start only Next.js app
npm run dev:stop         # Stop all services
npm run dev:restart      # Stop and restart everything
npm run dev:clean        # Stop and remove volumes/networks
```

### Building & Development
```bash
npm run dev:build        # Build all Docker images
npm run dev:build:nocache # Build without cache (clean build)
npm run dev:status       # Show service status
```

### Debugging & Inspection
```bash
npm run dev:logs                    # Follow all logs
npm run dev:logs -- billing         # Follow specific service
npm run dev:shell:billing          # Shell into billing service
npm run dev:shell:integrations     # Shell into integrations service
npm run dev:shell:postgres         # Connect to PostgreSQL
```

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Next.js App | http://localhost:3000 | Main application |
| Integrations | http://localhost:3001 | Shopify/WooCommerce integration |
| Notification Stream | http://localhost:3002 | SSE endpoints |
| Notifications | http://localhost:3003 | Email/Push notifications |
| Users | http://localhost:3004 | User management |
| Analytics | http://localhost:3005 | Analytics processing |
| Billing | http://localhost:3006 | Subscription/billing |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache/pub-sub |
| Kafka | localhost:9092 | Event streaming |
| ClickHouse | localhost:8123 | Analytics DB |

## Development Features

### 🎨 Color-Coded Output
Docker Compose automatically provides color-coded output for each service:
- Each service gets a unique color
- Service names are prefixed to each log line
- Easy to distinguish between services

### 🔄 Live Reloading
- **Volume mounts**: Code changes are reflected immediately
- **Shared package**: Changes to `@social-proof/shared` trigger rebuilds
- **Next.js**: Hot module replacement for frontend
- **Microservices**: Nodemon restarts on file changes

### 🏗️ Production Parity
- Same Docker images as production (with dev optimizations)
- Same networking and service discovery
- Same environment variable structure
- Same database schemas and migrations

### 🔍 Health Checks
All services include health checks:
```bash
# Check service health
docker-compose -f docker-compose.dev.yml ps

# Services show as "healthy" when ready
```

## Workflow Examples

### Start Development Session
```bash
# 1. Start infrastructure first (optional, for faster startup)
npm run dev:infra

# 2. Wait for services to be healthy, then start microservices
npm run dev:services

# 3. Start frontend
npm run dev:frontend

# Or just start everything at once
npm run dev:all
```

### Work on Specific Service
```bash
# Start only what you need
npm run dev:infra
docker-compose -f docker-compose.dev.yml up billing

# View logs for your service
npm run dev:logs -- billing

# Shell into service for debugging
npm run dev:shell:billing
```

### Database Operations
```bash
# Connect to PostgreSQL
npm run dev:shell:postgres

# Run migrations (from within service)
npm run dev:shell:billing
cd services/billing && npm run migrate

# View database logs
npm run dev:logs -- postgres
```

### Debugging Issues
```bash
# Check service status
npm run dev:status

# View all logs
npm run dev:logs

# Restart specific service
docker-compose -f docker-compose.dev.yml restart billing

# Rebuild and restart
npm run dev:build -- billing
docker-compose -f docker-compose.dev.yml up billing
```

### Clean Restart
```bash
# Stop everything and clean up
npm run dev:clean

# Rebuild everything
npm run dev:build:nocache

# Start fresh
npm run dev:all
```

## Troubleshooting

### Port Conflicts
If you get port conflicts, check what's running:
```bash
lsof -i :3000  # Check if port 3000 is in use
lsof -i :5432  # Check PostgreSQL port
```

### Service Won't Start
```bash
# Check logs for the specific service
npm run dev:logs -- <service-name>

# Check if dependencies are healthy
npm run dev:status

# Try rebuilding the service
npm run dev:build -- <service-name>
```

### Database Issues
```bash
# Reset database
npm run dev:clean
npm run dev:infra

# Check database logs
npm run dev:logs -- postgres

# Connect and inspect
npm run dev:shell:postgres
```

### Shared Package Changes
When you modify the shared package:
```bash
# Rebuild services that depend on it
npm run dev:build -- billing integrations notifications

# Or rebuild everything
npm run dev:build
```

## Performance Tips

1. **Use detached mode** for background development:
   ```bash
   npm run dev:all -- -d
   npm run dev:logs  # Follow logs separately
   ```

2. **Start services incrementally** for faster startup:
   ```bash
   npm run dev:infra     # Start infrastructure first
   npm run dev:services  # Then microservices
   npm run dev:frontend  # Finally frontend
   ```

3. **Use specific service commands** when working on one service:
   ```bash
   docker-compose -f docker-compose.dev.yml up billing
   ```

4. **Keep infrastructure running** between sessions:
   ```bash
   # Stop only application services
   docker-compose -f docker-compose.dev.yml stop billing integrations notifications users analytics nextjs
   
   # Keep postgres, redis, kafka running
   ```

This development setup provides the best of both worlds: production parity with excellent developer experience! 