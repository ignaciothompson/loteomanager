#!/bin/sh
set -e

PB_BIN="/pocketbase"
PB_DATA_DIR="/pb_data"
PB_HTTP_ADDR="0.0.0.0:8080"
HEALTH_URL="http://127.0.0.1:8080/api/health"
HEALTH_TIMEOUT_SECONDS=30

log() {
  echo "[entrypoint] $*"
}

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  pw_len=$(printf '%s' "$PB_SUPERUSER_PASSWORD" | wc -c | tr -d ' ')
  if [ "$pw_len" -lt 10 ]; then
    log "ERROR: PB_SUPERUSER_PASSWORD must be at least 10 characters (got $pw_len). Aborting."
    exit 1
  fi
fi

log "Starting PocketBase on ${PB_HTTP_ADDR}..."
"$PB_BIN" serve --http="$PB_HTTP_ADDR" --dir="$PB_DATA_DIR" &
PB_PID=$!

trap 'log "Forwarding signal to PocketBase (pid ${PB_PID})..."; kill -TERM "$PB_PID" 2>/dev/null || true; wait "$PB_PID"' INT TERM

log "Waiting for PocketBase health check (max ${HEALTH_TIMEOUT_SECONDS}s)..."
i=0
while [ "$i" -lt "$HEALTH_TIMEOUT_SECONDS" ]; do
  if ! kill -0 "$PB_PID" 2>/dev/null; then
    log "ERROR: PocketBase process exited before becoming healthy."
    wait "$PB_PID" || true
    exit 1
  fi
  if wget --quiet --spider "$HEALTH_URL" 2>/dev/null; then
    log "PocketBase healthy after ${i}s."
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$i" -ge "$HEALTH_TIMEOUT_SECONDS" ]; then
  log "ERROR: PocketBase did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s."
  kill -TERM "$PB_PID" 2>/dev/null || true
  wait "$PB_PID" || true
  exit 1
fi

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  log "Bootstrapping superuser ${PB_SUPERUSER_EMAIL} (upsert)..."
  if "$PB_BIN" superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD"; then
    log "Superuser upsert OK."
  else
    rc=$?
    log "ERROR: superuser upsert failed (exit ${rc})."
    kill -TERM "$PB_PID" 2>/dev/null || true
    wait "$PB_PID" || true
    exit "$rc"
  fi
else
  log "WARNING: PB_SUPERUSER_EMAIL/PASSWORD no definidas, skip bootstrap."
fi

log "Foregrounding PocketBase (pid ${PB_PID})."
wait "$PB_PID"
