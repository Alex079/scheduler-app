# syntax=docker/dockerfile:1

# ---------- Stage 1: client build ----------
FROM node:25-slim AS client
WORKDIR /client

COPY src/client/package.json src/client/package-lock.json ./
RUN npm ci

COPY src/client/ ./
RUN npm run build

# ---------- Stage 2: server install ----------
FROM node:25-slim AS server
WORKDIR /server

COPY src/server/package.json src/server/package-lock.json ./
RUN npm ci

# ---------- Stage 3: final runtime ----------
FROM node:25-slim

WORKDIR /app/run/client
COPY --from=client /client/dist ./dist/

WORKDIR /app/run/server
COPY src/server/ ./
COPY --from=server /server/ ./

VOLUME [ "/database", "/pipe" ]

CMD [ "server.js" ]
