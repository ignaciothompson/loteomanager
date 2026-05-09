# Usar imagen alpine ligera
FROM alpine:latest

# Instalar dependencias necesarias (wget, unzip)
RUN apk add --no-cache ca-certificates unzip wget

# Argumento para la versión de PocketBase
ARG PB_VERSION=0.23.0

# Descargar y extraer PocketBase
RUN wget https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip \
    && unzip pocketbase_${PB_VERSION}_linux_amd64.zip \
    && chmod +x /pocketbase \
    && rm pocketbase_${PB_VERSION}_linux_amd64.zip

# Copiar pb_hooks y pb_migrations desde la raíz
COPY ./pb_hooks /pb_hooks
COPY ./pb_migrations /pb_migrations

# Exponer el puerto por el que PocketBase servirá HTTP internamente
EXPOSE 8080

# Comando para iniciar PocketBase (sirviendo a cualquier IP)
CMD ["/pocketbase", "serve", "--http=0.0.0.0:8080"]
