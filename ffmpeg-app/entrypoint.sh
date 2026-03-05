#!/bin/sh

# Prepare the named pipes for communication with the scheduler-app
mkdir -p /pipe
mkfifo /pipe/request
mkfifo /pipe/response

echo "Starting ffmpeg-app..."

trap "echo 'Stopping ffmpeg-app...' ; exit 0" SIGINT SIGTERM

# Main loop
while true; do
  while read EVENT; do
    echo "Processing event: $EVENT"
    ffmpeg-runner.sh "$EVENT" > /pipe/response &
  done < /pipe/request
done
