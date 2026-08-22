# syntax=docker/dockerfile:1

# ---------- Stage 1: client build ----------
# Isolate the heavy Vite/ESLint dev toolchain here so it never lands in the
# final image, and keep this layer cached across dep-only changes.
FROM node:25-slim AS client
WORKDIR /client/src

COPY src/client/package.json src/client/package-lock.json ./
RUN npm ci

COPY src/client/ ./
RUN npm run build

# ---------- Stage 2: server install ----------
# Node deps first for layer caching. better-sqlite3 native build happens here.
FROM node:25-slim AS server
WORKDIR /app/src

COPY src/server/package.json src/server/package-lock.json ./
RUN npm ci

COPY src/server/ ./server/

# ---------- Stage 3: final runtime ----------
# WORKDIR / reproduces the original Alpine image exactly: the entrypoint's
# `node src/server/server.js` runs from /, and the code's relative paths
# resolve unchanged:
#   staticPath = '../../src/client/dist'  -> /src/client/dist
#   DATABASE_DIR = '../../../database/'    -> /database/
# Files are copied to /src so that WORKDIR-relative and file-relative paths
# match the original layout byte-for-byte.
FROM node:25-slim

WORKDIR /

COPY --from=server /app/src/ ./src/
COPY --from=client /client/src/dist ./src/client/dist

COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

VOLUME [ "/database", "/pipe" ]

ENTRYPOINT [ "entrypoint.sh" ]
