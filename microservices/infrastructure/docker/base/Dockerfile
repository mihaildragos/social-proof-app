FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Environment variables
ENV NODE_ENV production
ENV PORT 3000

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

# Set the correct permission for node_modules and cache
RUN mkdir -p /app/.npm && chown -R appuser:nodejs /app/.npm

# Copy necessary files from builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# OpenTelemetry instrumentation
COPY --from=builder --chown=appuser:nodejs /app/instrumentation.js ./instrumentation.js

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:$PORT/health || exit 1

# Default command
CMD ["node", "-r", "./instrumentation.js", "dist/index.js"] 