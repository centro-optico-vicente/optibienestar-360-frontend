// Runtime configuration placeholder for local development.
//
// In the Docker image this file is overwritten at container start from
// environment variables (docker/docker-entrypoint.d/40-render-runtime-config.sh).
// Leaving API_BASE_URL empty here lets NUXT_PUBLIC_API_BASE_URL from .env take
// precedence during `pnpm dev`.
window.__APP_CONFIG__ = {
  API_BASE_URL: ""
};
