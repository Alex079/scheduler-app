FROM jrottenberg/ffmpeg:8-scratch

COPY entrypoint.sh ffmpeg-runner.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/ffmpeg-runner.sh

VOLUME [ "/pipe", "/recordings" ]

ENTRYPOINT [ "entrypoint.sh" ]
