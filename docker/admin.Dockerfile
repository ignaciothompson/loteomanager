# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build admin --configuration=production

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
