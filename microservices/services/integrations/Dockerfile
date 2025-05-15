# Multi-stage build for Node.js microservice
# Stage 1: Build dependencies and TypeScript
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY ./services/integrations ./services/integrations
COPY ./shared ./shared

# Build TypeScript
RUN npm run build:integrations

# Stage 2: Create production image
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built code from builder stage
COPY --from=builder /app/dist ./dist

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
CMD ["node", "dist/services/integrations/index.js"] 