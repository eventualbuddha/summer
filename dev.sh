#!/bin/bash
set -euo pipefail

SURREALDB_PORT=8000
DATA_DIR="${SURREALDB_DATA_DIR:-.surrealdb}"

mkdir -p "$DATA_DIR"

# Ensure SurrealDB v2 is installed
SURREAL_VER=$(surreal version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
SURREAL_MAJOR=${SURREAL_VER%%.*}
if [ "$SURREAL_MAJOR" != "2" ]; then
  echo "Error: SurrealDB v2 is required (found: ${SURREAL_VER:-not found}). Please install SurrealDB v2." >&2
  exit 1
fi

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
