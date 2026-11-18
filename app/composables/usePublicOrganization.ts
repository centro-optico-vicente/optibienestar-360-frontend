import type { PublicOrganizationDto } from '~/types/organizations'

/** Used while the organization has no WhatsApp configured or the request fails. */
const FALLBACK_WHATSAPP = '584122925608'

/**
 * Public company data (`GET /v1/public/organization`), fetched once per page
 * load and shared through `useState`. Fails soft: if the request fails the
 * contact helpers fall back to the default WhatsApp, so contact buttons never disappear.
 */
export const usePublicOrganization = () => {
  const organization = useState<PublicOrganizationDto | null>('public-organization', () => null)
  const loaded = useState<boolean>('public-organization-loaded', () => false)

  async function load(force = false): Promise<PublicOrganizationDto | null> {
    if (loaded.value && !force) return organization.value
    try {
      organization.value = await useApi<PublicOrganizationDto>('/v1/public/organization', {
        skipAuth: true,
        silent: true,
      })
    }
    catch {
      organization.value = null
    }
    finally {
      loaded.value = true
    }
    return organization.value
  }

  /** Digits `wa.me` expects: the organization's WhatsApp, else the default one. */
  const contactWhatsapp = computed(() => whatsappPhone(organization.value?.whatsapp) ?? FALLBACK_WHATSAPP)

  return { organization, load, contactWhatsapp }
}
