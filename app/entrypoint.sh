#!/bin/sh

# Prepare the named pipes for communication with the ffmpeg-app
mkdir -p /pipe
mkfifo /pipe/request
mkfifo /pipe/response

echo "Starting scheduler-app..."

# Start the Node.js server in the background
APP_PORT=3000 JWT_SECRET=`openssl rand -hex 64` node src/server/server.js &
PID=$!

trap "echo 'Stopping scheduler-app...' ; kill -TERM $PID ; exit 0" SIGINT SIGTERM

wait $PID
