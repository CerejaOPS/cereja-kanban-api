FROM node:lts-trixie AS tester
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run test

FROM node:lts-alpine AS builder
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:lts-alpine
WORKDIR /app

# Como este é um projeto JS puro, não há pasta build/src. 
# Copiamos as pastas vitais do sistema direto.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/seed.js ./seed.js
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Expõe a porta e define entrypoint
EXPOSE 3001
ENTRYPOINT [ "node" ]
CMD [ "server.js" ]
