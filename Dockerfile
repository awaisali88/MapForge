# syntax=docker/dockerfile:1.7
# =============================================================================
# MapForge production image
# Multi-stage: node:22-alpine builds the static bundle, nginx:alpine serves it.
# Build: docker build -t mapforge:local .
# Run:   docker run --rm -p 8080:80 mapforge:local
# =============================================================================


# -----------------------------------------------------------------------------
# Stage 1: build the static bundle with Node + pnpm via Corepack.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Corepack pins the pnpm version from package.json's `packageManager` field
# so the build is deterministic across machines.
RUN corepack enable

# Copy manifests first so dependency installs cache separately from source
# changes. Touching application code won't re-trigger `pnpm install`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Approve native build scripts (esbuild, etc.) before they're invoked by the
# install. Listed in package.json under `pnpm.onlyBuiltDependencies`.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Now copy the rest of the source. Anything in `.dockerignore` is excluded.
COPY . .

# Vite picks up production behavior from NODE_ENV.
ENV NODE_ENV=production

# Type-check + bundle.
RUN pnpm build


# -----------------------------------------------------------------------------
# Stage 2: ship only `dist/` behind nginx.
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Static bundle.
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default vhost with our SPA-aware config (gzip, long-cache
# hashed assets, security headers, history-mode fallback).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Basic liveness probe — succeeds when nginx serves the entry HTML.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
