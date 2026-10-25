# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# Deploy passes the release (commit) and, if set, the Sentry token as a build secret (not in the image).
ARG SENTRY_RELEASE
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null)" npm run build

FROM node:${NODE_VERSION}-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
COPY scripts/migrate.js ./scripts/migrate.js
USER node
EXPOSE 3000
CMD ["node", "build"]
