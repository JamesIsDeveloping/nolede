# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Install deps (needs devDeps for tsc + vite)
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci

# Build server (tsc) and client (vite)
COPY . .
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
# The Playwright image ships with Chromium pre-installed and version-matched
# to the npm package, so no browser download is needed at runtime.
FROM mcr.microsoft.com/playwright:v1.50.0-noble
WORKDIR /app

# Production deps only
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci --omit=dev

# Compiled output from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Directory used by Playwright HTML debug snapshots
RUN mkdir -p logs

ENV NODE_ENV=production
EXPOSE 3050

CMD ["node", "server/dist/server.js"]
