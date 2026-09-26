/**
 * The app's own timezone (hub plan competitive-commission-rules, Fase A),
 * read from `window.__APP_CONFIG__.TIME_ZONE` — the browser-side equivalent
 * of the backend's `core/util/AppTimeZone` (env `TZ`, ADR 0010, falls back to
 * `America/Caracas`). The container writes `TIME_ZONE` into `/config.js`
 * (see `docker/docker-entrypoint.d/40-render-runtime-config.sh` and
 * `app/plugins/00.runtime-config.client.ts`) from the same `TZ` env var
 * `deployment/docker-compose.yaml` already sets, so changing the deployed
 * timezone needs no rebuild here either.
 *
 * Read directly from `window` (not `useRuntimeConfig()`) so these plain
 * functions keep working from anywhere — components, composables, stores —
 * without depending on being called inside an active Nuxt app context; same
 * precedent as the rest of `~/utils/date.ts`.
 */
export function appTimeZone(): string {
  return (typeof window !== 'undefined' && window.__APP_CONFIG__?.TIME_ZONE) || 'America/Caracas'
}

/**
 * The UTC offset (`+HH:mm` / `-HH:mm`) {@link zone} observes on the calendar
 * date of `localDateTime` (a naive `yyyy-MM-dd[THH:mm[:ss]]` string) — e.g.
 * `-04:00` for `America/Caracas`, which never changes (no DST), but computed
 * properly per-date so a DST-observing zone (a different deployment's `TZ`)
 * also gets the right offset instead of a value frozen at the moment the
 * app booted. Replaces the old hardcoded `CARACAS_OFFSET` constant.
 *
 * Anchored at UTC noon on that calendar date (rather than at the exact local
 * time requested) to sidestep the one-hour window around a DST transition,
 * where the "same" wall-clock time can be ambiguous — irrelevant for the
 * fixed-offset default, but keeps this correct for a zone that does observe it.
 */
export function offsetFor(localDateTime: string, zone: string = appTimeZone()): string {
  const datePart = localDateTime.slice(0, 10)
  const noonUtc = new Date(`${datePart}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(noonUtc)
  const gmt = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = gmt.match(/GMT([+-]\d{2}:\d{2})/)
  return match?.[1] ?? '+00:00'
}
