#!/bin/sh

for arg in $@; do
  case "$arg" in
    ID=*)       ID=${arg#*=} ;;
    STREAM=*)   STREAM=${arg#*=} ;;
    DURATION=*) DURATION=${arg#*=} ;;
    OUTPUT=*)   OUTPUT=${arg#*=} ;;
    *) echo "Bad argument: $arg" >&2 ;;
  esac
done
# validate required vars
: "${ID:?ID is required}" "${STREAM:?STREAM is required}" "${DURATION:?DURATION is required}" "${OUTPUT:?OUTPUT is required}"

ffmpeg -i "$STREAM" -t "$DURATION" -c copy -map_metadata 0 -f mp4 "/recordings/$OUTPUT"   &&   echo "$ID=OK"   ||   echo "$ID=FAILED"
