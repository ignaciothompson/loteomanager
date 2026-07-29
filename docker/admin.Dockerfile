# Stage 1: Build (bookworm/glibc — Nx native binaries; alpine/musl breaks project graph)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NX_DAEMON=false
ENV NX_NO_CLOUD=true
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build admin --configuration=production \
  && test -d dist/apps/admin/browser

# Stage 2: Serve con NGINX
FROM nginx:alpine

RUN apk add --no-cache wget

COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/apps/admin/browser /usr/share/nginx/html

COPY ./docker/admin-entrypoint.sh /admin-entrypoint.sh
RUN chmod +x /admin-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://localhost/healthz || exit 1

ENTRYPOINT ["/admin-entrypoint.sh"]
