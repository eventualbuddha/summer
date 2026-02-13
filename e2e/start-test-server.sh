#!/bin/bash
set -euo pipefail

SURREALDB_PORT=18000

# Start SurrealDB in the background
surreal start memory --bind 127.0.0.1:${SURREALDB_PORT} --unauthenticated &
SURREAL_PID=$!

# Wait a moment for SurrealDB process to initialize
sleep 1

# Wait for SurrealDB to be ready
echo "Waiting for SurrealDB to start..."
SURREAL_READY=false
for i in {1..60}; do
  # Check health endpoint, SQL queries, and RPC endpoint connectivity
  if curl -s http://127.0.0.1:${SURREALDB_PORT}/health >/dev/null 2>&1 &&
    echo "INFO FOR ROOT;" | surreal sql --endpoint ws://127.0.0.1:${SURREALDB_PORT} --namespace ns --database db >/dev/null 2>&1 &&
    curl -s -X POST http://127.0.0.1:${SURREALDB_PORT}/rpc \
      -H "Content-Type: application/json" \
      -d '{"method":"ping"}' >/dev/null 2>&1; then
    echo "SurrealDB is ready!"
    SURREAL_READY=true
    break
  fi
  sleep 0.5
done

if [ "$SURREAL_READY" != true ]; then
  echo "Error: SurrealDB did not become ready after 60 attempts. Exiting."
  kill "$SURREAL_PID" 2>/dev/null || true
  exit 1
fi
# Start the web server with test database configuration
export BACKEND_SURREALDB_WS_URL=ws://127.0.0.1:${SURREALDB_PORT}/rpc
export BACKEND_SURREALDB_HTTP_URL=http://127.0.0.1:${SURREALDB_PORT}
export DEFAULT_NAMESPACE=ns
export DEFAULT_DATABASE=db
export PORT=3000

# Trap to kill SurrealDB when the web server exits
trap "kill $SURREAL_PID 2>/dev/null" EXIT

# Start the web server (this will keep the script running)
node server.js &
SERVER_PID=$!

# Wait for web server to be fully ready and able to serve requests
echo "Waiting for web server to be ready..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:3000/api/backend-info >/dev/null 2>&1; then
    echo "Web server is ready!"
    # Additional delay to ensure all connections are stable
    sleep 2
    break
  fi
  sleep 0.5
done

# Keep the server running in foreground
wait $SERVER_PID
