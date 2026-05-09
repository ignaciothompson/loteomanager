# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos y limpiar cachés
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código fuente completo del monorepo
COPY . .

# Build de la aplicación admin (Sakai-NG, CSR)
RUN npx nx build admin --configuration=production

# Stage 2: Serve con NGINX
FROM nginx:alpine

# Copiar archivo de configuración personalizado de nginx para SPA (Single Page Application)
# Nota: Puedes montar el nginx.conf o agregarlo luego si lo requieres.
# COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el build al directorio de NGINX
COPY --from=builder /app/dist/apps/admin/browser /usr/share/nginx/html

# Exponer el puerto (por defecto 80 en nginx)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
