# Multi-Stage Dockerfile for Farmer Saathi Web Application
# Optimized for High Concurrency, Fast Cold Starts, and Cross-Platform (AMD64 & ARM64)

# ==========================================
# Stage 1: Build the Vite Frontend
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests for caching
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
COPY shared/ shared/

# Install client dependencies and compile static production assets
RUN npm ci --workspace=client
COPY client/ client/
RUN npm run build -w client

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

# Install dumb-init for proper PID 1 signal forwarding and wget for healthchecks
RUN apk add --no-cache dumb-init wget

ENV NODE_ENV=production
ENV PORT=4000
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Install only production dependencies
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci --omit=dev --workspace=server && npm cache clean --force

# Copy application server code, shared constants, and built UI
COPY shared/ shared/
COPY server/ server/
COPY --from=builder /app/client/dist /app/client/dist

# Security: Run as unprivileged node user
USER node

EXPOSE 4000

# Native Docker healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/src/server.js"]
