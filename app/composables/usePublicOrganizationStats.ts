import type { PublicOrganizationStatsDto } from '~/types/organizations'

let inFlight: Promise<PublicOrganizationStatsDto | null> | null = null

/**
 * Public login counters (`GET /v1/public/organization/stats`, ADR 0042), fetched once
 * per page load and shared through `useState`, so the allies and members cards make a
 * single request. Fails soft: on error `stats` stays `null` and both cards hide
 * (they are decorative; never show a made-up number).
 */
export const usePublicOrganizationStats = () => {
  const stats = useState<PublicOrganizationStatsDto | null>('public-organization-stats', () => null)
  const loaded = useState<boolean>('public-organization-stats-loaded', () => false)

  async function load(force = false): Promise<PublicOrganizationStatsDto | null> {
    if (loaded.value && !force) return stats.value
    if (inFlight && !force) return inFlight
    inFlight = (async () => {
      try {
        stats.value = await useApi<PublicOrganizationStatsDto>('/v1/public/organization/stats', {
          skipAuth: true,
          silent: true,
        })
      }
      catch {
        stats.value = null
      }
      finally {
        loaded.value = true
        inFlight = null
      }
      return stats.value
    })()
    return inFlight
  }

  return { stats, loaded, load }
}
