#!/bin/sh

# Prepare the named pipes for communication with the ffmpeg-app
mkdir -p /pipe
mkfifo /pipe/request
mkfifo /pipe/response

cleanup () {
  echo 'Stopping...'
  killall -q -SIGINT node
}

trap cleanup SIGINT SIGTERM

echo "Starting..."

# Start the Node.js server in the background
APP_PORT=3000 JWT_SECRET=`tr -dc A-Za-z0-9 < /dev/urandom | head -c 32` node src/server/server.js &

wait $!
exit 0