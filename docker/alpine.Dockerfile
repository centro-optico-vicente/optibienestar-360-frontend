# syntax=docker/dockerfile:1
# Multi-stage build for the OptiSalud Plus admin/portals SPA (Nuxt 4, ssr: false).
# Stage 1 builds the static SPA with pnpm; stage 2 serves it with Nginx (Alpine).

# Global build args (declared before the first FROM so both stages' FROM lines can use them).
ARG NODE_VERSION=22
ARG NGINX_VERSION=1.31.0

# ---------- Stage 1: build ----------
FROM node:${NODE_VERSION}-alpine AS build

# Enable pnpm via corepack and pin the version declared in package.json.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install dependencies first so the layer is cached unless the lockfile changes.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy the rest of the sources and generate the static SPA into .output/public.
COPY . .
RUN pnpm generate

# ---------- Stage 2: serve ----------
ARG NGINX_VERSION=1.31.0
FROM nginx:${NGINX_VERSION}-alpine

ARG BUILD_VERSION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="optisalud-plus-frontend" \
	org.opencontainers.image.description="Panel admin y portales OptiSalud Plus (Nuxt SPA) servido por Nginx (Alpine)" \
	org.opencontainers.image.version="${BUILD_VERSION}" \
	org.opencontainers.image.created="${BUILD_DATE}" \
	org.opencontainers.image.base.name="nginx:${NGINX_VERSION}-alpine"

# Default backend API base URL. Points to the TEST environment on purpose so an
# unconfigured container never hits production. NOT baked into the JS bundle (this
# is the serve stage, after the build); the entrypoint reads it at container start
# to render /config.js. Set production explicitly with `-e NUXT_PUBLIC_API_BASE_URL=...`.
ENV NUXT_PUBLIC_API_BASE_URL="https://api-test.centroopticovicente.com"

COPY docker/default.conf /etc/nginx/conf.d/default.conf
# Runtime config renderer: writes /usr/share/nginx/html/config.js from env vars
# before Nginx starts (Nginx official images run /docker-entrypoint.d/*.sh).
COPY docker/docker-entrypoint.d/40-render-runtime-config.sh /docker-entrypoint.d/40-render-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-render-runtime-config.sh

COPY --from=build /app/.output/public/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
