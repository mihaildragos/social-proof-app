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

# Install all workspace dependencies
RUN npm install

# Copy shared library source and build it
COPY shared/ ./shared/
RUN npm run build:shared

# Copy billing service source
COPY services/billing/ ./services/billing/

# Build the billing service
RUN npm run build:billing

# Stage 2: Create production image
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy workspace package files for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/billing/package*.json ./services/billing/

# Install only production dependencies
RUN npm install --only=production

# Copy built shared library
COPY --from=builder /app/shared/dist ./shared/dist

# Copy built service code
COPY --from=builder /app/services/billing/dist ./services/billing/dist

# Add custom labels
LABEL maintainer="Social Proof Team"
LABEL service="billing-service"
LABEL version="1.0.0"

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-3003}/health || exit 1

# Create a non-root user and switch to it
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nodeuser
USER nodeuser

# Expose service port
EXPOSE ${PORT:-3003}

# Start the service
CMD ["node", "services/billing/dist/index.js"]
