# syntax=docker/dockerfile:1

# ---------- Stage 1: client build ----------
FROM node:25-alpine AS client
WORKDIR /client

COPY ./client/package.json ./client/package-lock.json ./
RUN npm ci

COPY ./client/ ./
RUN npm run build

# ---------- Stage 2: server install ----------
FROM node:25-alpine AS server
WORKDIR /server

COPY ./server/package.json ./server/package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: final runtime ----------
FROM node:25-alpine

WORKDIR /app/client
COPY --from=client /client/dist/ ./dist/

WORKDIR /app/server
COPY --from=server /server/node_modules/ ./node_modules/
COPY ./server/ ./

# Ship the container entrypoint so the image is self-contained. Without this,
# docker-compose / `docker run` runs the image's ENTRYPOINT (docker-entrypoint.sh)
# and, because there is no node child wrapping the CMD, re-execs straight into
# server.js as PID 1. docker-init never forwards the container's SIGTERM to that
# re-exec'd process, so the server is left orphaned and survives until Docker's
# stop timeout, then is SIGKILLed — meaning server.js's graceful shutdown handler
# (closeDatabase / stop schedulers) never actually runs and `docker compose down`
# hangs for the full timeout.
#
# Copying entrypoint.sh into the image and making it the ENTRYPOINT keeps node a
# child of this shell. The shell stays as PID 1, receives the shutdown signal
# itself, and forwards SIGTERM to node (mirroring ffmpeg-app/entrypoint.sh), so
# graceful shutdown works every time.
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME [ "/database", "/pipe" ]

ENTRYPOINT [ "entrypoint.sh" ]
