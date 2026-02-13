#!/bin/bash
set -euo pipefail

SURREALDB_PORT=18000

# Start SurrealDB in the background
surreal start memory --bind 127.0.0.1:${SURREALDB_PORT} --unauthenticated &
SURREAL_PID=$!

# Wait for SurrealDB to be ready
echo "Waiting for SurrealDB to start..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:${SURREALDB_PORT}/health >/dev/null 2>&1; then
    echo "SurrealDB is ready!"
    break
  fi
  sleep 0.5
done

# Start the web server with test database configuration
export BACKEND_SURREALDB_WS_URL=ws://127.0.0.1:${SURREALDB_PORT}/rpc
export BACKEND_SURREALDB_HTTP_URL=http://127.0.0.1:${SURREALDB_PORT}
export DEFAULT_NAMESPACE=ns
export DEFAULT_DATABASE=db
export PORT=3000

# Trap to kill SurrealDB when the web server exits
trap "kill $SURREAL_PID 2>/dev/null" EXIT

# Start the web server (this will keep the script running)
bun run server.js
