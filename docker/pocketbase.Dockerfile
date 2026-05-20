FROM alpine:latest

RUN apk add --no-cache ca-certificates unzip wget

ARG PB_VERSION=0.23.0

RUN wget https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip \
    && unzip pocketbase_${PB_VERSION}_linux_amd64.zip \
    && chmod +x /pocketbase \
    && rm pocketbase_${PB_VERSION}_linux_amd64.zip

COPY ./pb_hooks /pb_hooks
COPY ./pb_migrations /pb_migrations

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://localhost:8080/api/health || exit 1

CMD ["/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb_data"]
