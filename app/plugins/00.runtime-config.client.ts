/**
 * Apply runtime configuration injected by the container before the app boots.
 *
 * This is a static SPA (ssr: false), so build-time runtimeConfig cannot read the
 * deployment environment. The Docker image writes /config.js from env vars on
 * start (see docker/docker-entrypoint.d/40-render-runtime-config.sh), which the
 * browser loads before the bundle (see app.head.script in nuxt.config.ts) and
 * exposes as window.__APP_CONFIG__.
 *
 * Numeric prefix (00.) makes this run first so useApi/useAuthStore read the
 * resolved baseURL. In local dev /config.js is empty, so NUXT_PUBLIC_API_BASE_URL
 * from .env keeps precedence.
 */
declare global {
  interface Window {
    __APP_CONFIG__?: { API_BASE_URL?: string, TIME_ZONE?: string }
  }
}

export default defineNuxtPlugin(() => {
  const apiBaseUrl = window.__APP_CONFIG__?.API_BASE_URL
  if (apiBaseUrl) {
    useRuntimeConfig().public.apiBaseUrl = apiBaseUrl
  }
  // Hub plan competitive-commission-rules, Fase A — same precedent as apiBaseUrl
  // above. `~/utils/timezone.ts` reads window.__APP_CONFIG__ directly (works
  // from anywhere, no Nuxt context needed); this mirrors it into runtimeConfig
  // too so code that already has a `useRuntimeConfig()` handy can read it there.
  const timeZone = window.__APP_CONFIG__?.TIME_ZONE
  if (timeZone) {
    useRuntimeConfig().public.timeZone = timeZone
  }
})
