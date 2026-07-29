# Stage 1: Build (bookworm/glibc — Nx native binaries; alpine/musl breaks project graph)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NX_DAEMON=false
ENV NX_NO_CLOUD=true
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build landing --configuration=production \
  && test -d dist/apps/landing/server

# Stage 2: Production runtime con Playwright/Chromium
FROM node:20-bookworm-slim AS runner

WORKDIR /app

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
  wget \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist/apps/landing ./dist/apps/landing

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npx playwright install chromium

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://localhost:4000/healthz || exit 1

CMD ["node", "dist/apps/landing/server/server.mjs"]
