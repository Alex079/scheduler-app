FROM node:25-alpine

COPY entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/entrypoint.sh

COPY src src

RUN npm ci --prefix src/client

RUN npm run build --prefix src/client

RUN npm ci --prefix src/server

EXPOSE 3000

VOLUME [ "/db", "/pipe" ]

ENTRYPOINT [ "entrypoint.sh" ]
