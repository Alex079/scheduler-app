#!/bin/sh

# Prepare the named pipes for communication with the scheduler-app
mkdir -p /pipe
mkfifo /pipe/request
mkfifo /pipe/response

cleanup () {
  echo 'Stopping...'
  killall -q -SIGINT ffmpeg
}

trap cleanup SIGINT SIGTERM

echo "Starting..."

exec 3<  /pipe/request
exec 4<> /pipe/response

# Main loop
while read -r EVENT <&3; do
  echo "Processing event: $EVENT"
  ffmpeg-runner.sh $EVENT >&4 &
done
