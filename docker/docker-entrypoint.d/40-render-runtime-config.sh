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

# Same-origin API proxy (optional). When API_PROXY_UPSTREAM is set
# (scheme://host[:port], no path — e.g. http://optibienestar_backend:8080 on the
# Docker network, or https://api.centroopticovicente.com), Nginx forwards
# /api/* to it and the SPA calls /api instead of the API's own origin. Same
# origin means no CORS preflight (OPTIONS) before every authenticated request.
# Unset: no proxy, the SPA calls NUXT_PUBLIC_API_BASE_URL directly (as before).
API_PROXY_UPSTREAM="${API_PROXY_UPSTREAM:-}"
API_PROXY_CONF="/etc/nginx/api-proxy/api.conf"
rm -f "$API_PROXY_CONF"
if [ -n "$API_PROXY_UPSTREAM" ]; then
  API_PROXY_UPSTREAM="${API_PROXY_UPSTREAM%/}"
  case "$API_PROXY_UPSTREAM" in
    http://*|https://*) ;;
    *) echo "[runtime-config] API_PROXY_UPSTREAM must start with http:// or https:// (got '${API_PROXY_UPSTREAM}')" >&2; exit 1 ;;
  esac
  case "${API_PROXY_UPSTREAM#*://}" in
    */*) echo "[runtime-config] API_PROXY_UPSTREAM must not have a path (got '${API_PROXY_UPSTREAM}')" >&2; exit 1 ;;
  esac
  # proxy_pass uses a variable so Nginx resolves the upstream per request
  # (with `resolver`) instead of once at startup: Nginx still starts when the
  # backend container is not up yet, and follows its IP when it is recreated.
  RESOLVER="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)"
  case "$RESOLVER" in *:*) RESOLVER="[${RESOLVER}]" ;; esac
  mkdir -p "$(dirname "$API_PROXY_CONF")"
  cat > "$API_PROXY_CONF" <<EOF
# Generated at container start from API_PROXY_UPSTREAM — do not edit.
location ^~ /api/ {
	resolver ${RESOLVER:-127.0.0.11} valid=30s;
	set \$api_upstream "${API_PROXY_UPSTREAM}";
	rewrite ^/api/(.*)\$ /\$1 break;
	proxy_pass \$api_upstream;

	proxy_http_version 1.1;
	proxy_set_header Connection "";
	# Append to the chain received from Traefik so the backend (Jetty, forward
	# headers NATIVE) keeps resolving the real client IP.
	proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
	proxy_ssl_server_name on;

	# Uploads: the backend accepts multipart requests up to 22 MB.
	client_max_body_size 25m;
	# PDF/XLSX reports can take several seconds to render.
	proxy_read_timeout 120s;
	proxy_send_timeout 120s;
	access_log off;
}
EOF
  API_BASE_URL="/api"
  echo "[runtime-config] wrote ${API_PROXY_CONF} (/api/ -> ${API_PROXY_UPSTREAM}, resolver ${RESOLVER:-127.0.0.11})"
fi

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

# Release identity for quick verification: curl /version.json
# Read from the image (written at build time), never from env, so a container
# recreated with a stale env still reports the release it actually runs.
BUILD_INFO_PATH="/etc/app-build-info"
VERSION=""
BUILD_DATE=""
if [ -r "$BUILD_INFO_PATH" ]; then
  VERSION="$(sed -n 's/^version=//p' "$BUILD_INFO_PATH")"
  BUILD_DATE="$(sed -n 's/^buildDate=//p' "$BUILD_INFO_PATH")"
fi
VERSION="${VERSION:-0.0.1-dev}"
VERSION_PATH="/usr/share/nginx/html/version.json"
printf '{"version":"%s","buildDate":"%s"}\n' "$VERSION" "$BUILD_DATE" > "$VERSION_PATH"
echo "[runtime-config] wrote ${VERSION_PATH} (version='${VERSION}', buildDate='${BUILD_DATE}')"
