FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN mkdir -p auth auth_info session

EXPOSE 5000

CMD ["node", "node_modules/.bin/nodemon", "--legacy-watch", "src/server.js"]


FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p auth auth_info session

EXPOSE 5000

CMD ["node", "src/server.js"]
