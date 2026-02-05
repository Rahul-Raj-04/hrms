FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

COPY .env.prod .env

EXPOSE 7000

CMD ["node", "src/index.js"]