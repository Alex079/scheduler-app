#!/bin/sh

# Prepare the named pipes for communication with the scheduler-app
mkdir -p /pipe
[ -p /pipe/request ]  || mkfifo /pipe/request
[ -p /pipe/response ] || mkfifo /pipe/response

cleanup () {
  echo 'Stopping ffmpeg-app...'
  killall -q -INT ffmpeg 2>/dev/null || true
}

trap cleanup INT TERM

echo "Starting..."

exec 3<  /pipe/request
exec 4<> /pipe/response

# Main loop
while read -r EVENT <&3; do
  echo "Processing event: $EVENT"
  ffmpeg-runner.sh $EVENT >&4 &
done
