#!/bin/bash
set -euo pipefail

SURREALDB_PORT=8000
DATA_DIR="${SURREALDB_DATA_DIR:-.surrealdb}"

mkdir -p "$DATA_DIR"

# Start SurrealDB in the background
surreal start --log info --bind 127.0.0.1:${SURREALDB_PORT} --unauthenticated --allow-all "file:${DATA_DIR}" &
SURREAL_PID=$!

trap "kill $SURREAL_PID 2>/dev/null" EXIT

# Wait for SurrealDB to be ready
echo "Waiting for SurrealDB to start..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:${SURREALDB_PORT}/health >/dev/null 2>&1; then
    echo "SurrealDB is ready on port ${SURREALDB_PORT}"
    break
  fi
  sleep 0.5
done

export SURREALDB_URL=http://127.0.0.1:${SURREALDB_PORT}

exec npx vite dev "$@"
