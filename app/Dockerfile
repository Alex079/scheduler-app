FROM node:25-alpine

COPY src src

RUN npm ci --prefix src/client

RUN npm run build --prefix src/client

RUN npm ci --prefix src/server

COPY entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

VOLUME [ "/database", "/pipe" ]

ENTRYPOINT [ "entrypoint.sh" ]
