#!/bin/sh

for token in $@; do
  case "$token" in
    *=*)
      var=${token%%=*}
      val=${token#*=}
      case "$var" in
        ID|STREAM|DURATION|OUTPUT)
          val=${val#\'}; val=${val%\'}
          eval "$var=\$val"
          ;;
        *)
          echo "Bad variable name: $var" >&2
          exit 1
          ;;
      esac
      ;;
    *)
      echo "Unexpected token: $token" >&2
      exit 1
      ;;
  esac
done
# validate required vars
: "${ID:?ID is required}" "${STREAM:?STREAM is required}" "${DURATION:?DURATION is required}" "${OUTPUT:?OUTPUT is required}"

ffmpeg -i "$STREAM" -t "$DURATION" -c copy -map_metadata 0 -f mp4 "/recordings/$OUTPUT"   &&   echo "$ID=OK"   ||   echo "$ID=FAILED"
