# Dockerfile for Farmer Saathi Full-Stack Web Application
FROM node:22-alpine AS builder
WORKDIR /app

# Install client dependencies and build static assets
COPY package*.json ./
COPY client/package*.json client/
COPY shared/ shared/
RUN npm ci --workspace=client

COPY client/ client/
RUN npm run build -w client

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production server dependencies
COPY package*.json ./
COPY server/package*.json server/
RUN npm ci --omit=dev --workspace=server

# Copy server code, shared modules, and built client dist
COPY shared/ shared/
COPY server/ server/
COPY --from=builder /app/client/dist /app/client/dist

EXPOSE 4000

USER node

CMD ["node", "server/src/server.js"]
