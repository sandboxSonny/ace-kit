FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY . /app/
WORKDIR /app
RUN npm ci && npm run build

FROM node:24-alpine
ENV HOST=0.0.0.0
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/dist /app/dist
WORKDIR /app
CMD ["node", "dist/server/entry.mjs"]
