# Build inside Linux so npm resolves the correct @napi-rs/canvas native binary
# (linux-x64-gnu) rather than whatever platform this image was built on.
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/client/assets ./client/assets

EXPOSE 8787
CMD ["node", "server/src/index.js"]
