FROM node:20-alpine AS base

# Set environment variables
ENV NODE_ENV=staging \
    PORT=3004

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

# Set user to node for security
USER node

# Copy production dependencies
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
# Copy built application
COPY --from=builder --chown=node:node /app/dist ./dist
# Copy necessary files
COPY --chown=node:node package.json ./

# Expose port
EXPOSE $PORT

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:$PORT/health || exit 1

# Run the application
CMD ["node", "dist/index.js"] 