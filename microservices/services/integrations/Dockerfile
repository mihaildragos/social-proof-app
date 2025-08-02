# Multi-stage build for Node.js microservice with npm workspaces
# Stage 1: Build dependencies and TypeScript
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace root package.json and package-lock.json
COPY package*.json ./

# Copy all workspace package.json files for dependency resolution
COPY shared/package*.json ./shared/
COPY services/integrations/package*.json ./services/integrations/
COPY services/billing/package*.json ./services/billing/
COPY services/notifications/package*.json ./services/notifications/
COPY services/notification-stream-service/package*.json ./services/notification-stream-service/
COPY services/users/package*.json ./services/users/
COPY services/analytics/package*.json ./services/analytics/

# Install all workspace dependencies
RUN npm ci

# Copy shared library source and build it
COPY shared/ ./shared/
RUN npm run build:shared

# Copy integrations service source
COPY services/integrations/ ./services/integrations/

# Build the integrations service
RUN npm run build:integrations

# Stage 2: Create production image
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy workspace package files for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/integrations/package*.json ./services/integrations/

# Install only production dependencies
RUN npm ci --only=production --workspaces=false && \
    npm ci --only=production --workspace=shared && \
    npm ci --only=production --workspace=services/integrations

# Copy built shared library
COPY --from=builder /app/shared/dist ./shared/dist

# Copy built service code
COPY --from=builder /app/services/integrations/dist ./services/integrations/dist

# Add custom labels
LABEL maintainer="Social Proof Team"
LABEL service="integrations-service"
LABEL version="1.0.0"

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-3001}/health || exit 1

# Create a non-root user and switch to it
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nodeuser
USER nodeuser

# Expose service port
EXPOSE ${PORT:-3001}

# Start the service
CMD ["node", "services/integrations/dist/index.js"] 