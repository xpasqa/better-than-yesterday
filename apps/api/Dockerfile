# Multi-stage build for @better/api. Built from the REPO ROOT as context
# (see docker-compose.yml's `context: .`), because npm workspaces need every
# package.json in the tree present before `npm ci` can resolve them.

FROM node:22-slim AS build
WORKDIR /repo

# Copy just the manifests first so this layer caches across source changes.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN NODE_OPTIONS=--max-old-space-size=512 npm ci

COPY packages/core packages/core
COPY apps/api apps/api
RUN npm run build -w @better/api

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The build above already bundled every workspace import (including all of
# @better/core) directly into dist/*.js via esbuild — nothing under
# node_modules/@better/* is ever required or imported at runtime. What
# genuinely needs installing here is the handful of real npm dependencies
# with native or otherwise unbundleable code: @node-rs/argon2 (prebuilt
# per-platform binary) and postgres (its own TCP client, fine to bundle
# too, but left as a real dependency for a smaller, more cacheable stage).
# `@better/core` is deleted before install so npm never tries to resolve a
# private workspace name against the public registry.
COPY apps/api/package.json ./package.json
RUN npm pkg delete devDependencies dependencies.@better/core \
  && npm install --omit=dev --ignore-scripts

COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/drizzle ./drizzle

EXPOSE 3001
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
