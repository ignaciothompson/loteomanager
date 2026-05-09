# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código y construir
COPY . .
RUN npx nx build landing --configuration=production

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Solo copiamos el output final (server + browser assets)
COPY --from=builder /app/dist/apps/landing ./dist/apps/landing

# Exponer puerto para Express
EXPOSE 4000

# Iniciamos el servidor SSR de Angular
CMD ["node", "dist/apps/landing/server/server.mjs"]
