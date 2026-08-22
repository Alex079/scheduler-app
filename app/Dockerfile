# syntax=docker/dockerfile:1

# ---------- Stage 1: client build ----------
FROM node:25-slim AS client
WORKDIR /client

COPY ./client/package.json ./client/package-lock.json ./
RUN npm ci

COPY ./client/ ./
RUN npm run build

# ---------- Stage 2: server install ----------
FROM node:25-slim AS server
WORKDIR /server

COPY ./server/package.json ./server/package-lock.json ./
RUN npm ci

# ---------- Stage 3: final runtime ----------
FROM node:25-slim

WORKDIR /app/client
COPY --from=client /client/dist ./dist/

WORKDIR /app/server
COPY ./server/ ./
COPY --from=server /server/ ./

VOLUME [ "/database", "/pipe" ]

CMD [ "server.js" ]
