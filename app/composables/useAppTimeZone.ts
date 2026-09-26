import { appTimeZone, offsetFor } from '~/utils/timezone'

/**
 * Component-friendly wrapper over `~/utils/timezone` (hub plan
 * competitive-commission-rules, Fase A) — the zone id never changes at
 * runtime (it's baked into `/config.js` before the app boots), so `zone` is
 * a plain value, not a ref: destructure it directly, no `.value` needed.
 */
export function useAppTimeZone() {
  return {
    zone: appTimeZone(),
    offsetFor,
  }
}
