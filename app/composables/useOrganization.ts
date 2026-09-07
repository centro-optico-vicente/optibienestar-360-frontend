import type { OrganizationDto, OrganizationUpdateRequest } from '~/types/organizations'

/**
 * The single `organizations` row (ADR 0015 §4, `GET/PUT /v1/admin/organizations/me`).
 * `ensureLoaded` caches it in SSR-safe shared state (`useState`) so every
 * caller across the app — notably `useFormatters.formatCurrency`, which
 * reads `referenceCurrency_Code` as its default instead of a hardcoded
 * `'USD'` — hits the network at most once per session.
 *
 * Requires `ORGANIZATION_VIEW`; a session without it (e.g. a promoter/member
 * self-service portal) degrades to `null` silently (`silent: true` on the
 * fetch) — callers must treat a `null` organization as "unknown", never as
 * an error to surface.
 */
export const useOrganization = () => {
  const organization = useState<OrganizationDto | null>('organization', () => null)
  const loaded = useState<boolean>('organization-loaded', () => false)

  async function ensureLoaded(): Promise<OrganizationDto | null> {
    if (loaded.value) return organization.value
    loaded.value = true // set before the await: concurrent callers share this one in-flight attempt, not one each
    try {
      organization.value = await useApi<OrganizationDto>('/v1/admin/organizations/me', { silent: true })
    }
    catch {
      organization.value = null
    }
    return organization.value
  }

  const update = (payload: OrganizationUpdateRequest) =>
    useApi<OrganizationDto>('/v1/admin/organizations/me', { method: 'PUT', body: payload })
      .then((result) => {
        organization.value = result
        return result
      })

  return { organization, ensureLoaded, update }
}
