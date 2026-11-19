#!/bin/sh

# Container entrypoint for the scheduler-app Node server.
#
# Why this exists
# ---------------
# The container command runs through Docker's docker-entrypoint.sh, which — when
# wrapped in docker-init (docker compose / `docker run`) — re-execs directly
# into `server.js` and becomes PID 1. In that layout docker-init never forwards
# the SIGTERM it receives to the re-exec'd process, so the Node server is left
# orphaned and survives until Docker's stop timeout elapses before it is SIGKILLed
# — the graceful shutdown handler in server.js (closeDatabase / stop schedulers)
# never runs, and `docker compose down` hangs for the full stop timeout.
#
# Fix: keep `node server.js` as a *child* of this shell. The shell stays in the
# foreground as PID 1, receives the container's shutdown signal itself, and
# forwards it to node — mirroring ffmpeg-app/entrypoint.sh.

# Prepare the named pipes used for bidirectional communication with the
# ffmpeg-app container (scheduler -> request, response -> scheduler).
mkdir -p /pipe
[ -p /pipe/request ]  || mkfifo /pipe/request
[ -p /pipe/response ] || mkfifo /pipe/response

cleanup () {
  echo 'Stopping scheduler-app...'
  kill -INT "${SERVER_PID:-}" 2>/dev/null || true
}

trap cleanup INT TERM

# Start the Node.js server in the background so this script stays in the
# foreground as PID 1 and can own the shutdown signal.
APP_PORT=3000 \
JWT_SECRET=$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 32) \
  node /app/server/server.js &
SERVER_PID=$!

# Wait for the server; re-attach to its exit status.
wait "${SERVER_PID}"
STATUS=$?

# Defensive: if we get here without the shutdown signal (e.g. the server exited
# on its own), forward a SIGINT just in case node is still lingering.
kill -INT "${SERVER_PID:-}" 2>/dev/null || true

exit "${STATUS}"
