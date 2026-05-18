# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build landing --configuration=production

# Stage 2: Production runtime
# Use debian-based image for Playwright/Chromium compatibility
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Chromium system dependencies required by Playwright
RUN apt-get update && apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxext6 \
  fonts-liberation \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Copy build output
COPY --from=builder /app/dist/apps/landing ./dist/apps/landing

# Install Playwright + download Chromium binary
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npx playwright install chromium

EXPOSE 4000

CMD ["node", "dist/apps/landing/server/server.mjs"]
