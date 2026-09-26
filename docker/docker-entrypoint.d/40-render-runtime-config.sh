#!/bin/sh
# Render the SPA runtime configuration from environment variables.
#
# The Nuxt app is a static SPA (ssr: false), so there is no server runtime to
# read env vars. Instead this script — run by the Nginx official image entrypoint
# (/docker-entrypoint.d/*.sh) before Nginx starts — writes /config.js, which the
# browser loads before the app boots (see app/plugins/runtime-config.client.ts).
#
# This lets a single image serve any environment: set NUXT_PUBLIC_API_BASE_URL on
# the container and restart — no rebuild required.
set -eu

CONFIG_PATH="/usr/share/nginx/html/config.js"
API_BASE_URL="${NUXT_PUBLIC_API_BASE_URL:-}"
# Hub plan competitive-commission-rules, Fase A — same TZ env var
# deployment/docker-compose.yaml already sets on every container (from
# TIME_ZONE, ADR 0010), read here so the SPA follows the deployed timezone
# instead of a hardcoded America/Caracas literal (see ~/utils/timezone.ts).
TIME_ZONE="${TZ:-America/Caracas}"

cat > "$CONFIG_PATH" <<EOF
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}",
  TIME_ZONE: "${TIME_ZONE}"
};
EOF

echo "[runtime-config] wrote ${CONFIG_PATH} (API_BASE_URL='${API_BASE_URL}', TIME_ZONE='${TIME_ZONE}')"
