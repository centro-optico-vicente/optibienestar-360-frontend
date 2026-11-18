import type { PublicOrganizationContactDto } from '~/types/organizations'

/** Used while the organization has no WhatsApp configured or the request fails. */
const FALLBACK_WHATSAPP = '584122925608'

/**
 * Public company contact data (`GET /v1/public/organization/contact`), fetched once per page
 * load and shared through `useState`. Fails soft: if the request fails the
 * contact helpers fall back to the default WhatsApp, so contact buttons never disappear.
 */
export const usePublicOrganization = () => {
  const organization = useState<PublicOrganizationContactDto | null>('public-organization-contact', () => null)
  const loaded = useState<boolean>('public-organization-contact-loaded', () => false)

  async function load(force = false): Promise<PublicOrganizationContactDto | null> {
    if (loaded.value && !force) return organization.value
    try {
      organization.value = await useApi<PublicOrganizationContactDto>('/v1/public/organization/contact', {
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
