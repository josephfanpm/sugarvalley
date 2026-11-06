# Sugar Valley server + game. No npm dependencies; Node 22's built-in SQLite holds the data.
FROM node:22.17-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY src ./src
COPY assets/art ./assets/art
COPY assets/audio ./assets/audio
COPY extension/shared ./extension/shared
COPY web ./web
ENV NODE_ENV=production \
    PORT=8080 \
    SUGARPEEK_DATA=/data \
    TRUST_PROXY=1
VOLUME /data
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
