#!/bin/sh

eval "$1"
ffmpeg -i "$STREAM" -t "$DURATION" -c copy -f mp4 "/recordings/$OUTPUT"   &&   echo "$ID=OK"   ||   echo "$ID=FAILED"
