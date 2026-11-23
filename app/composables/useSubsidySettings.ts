import type { SubsidySettingsDto } from '~/types/subsidies'

/**
 * Subsidy settings for the signed-in user (hub ADR 0041 §6, `GET /v1/admin/subsidies/settings`): the
 * organization's subsidy mode (which fees manual subsidies may cover) and the user's discount cap.
 * Shared through `useState` by the menu (hides "Subsidios y exoneraciones" in `DISABLED`) and the
 * subsidies screen (enabled % fields, cap warning).
 *
 * The cap and `canExceedCap` belong to the user and the active role, so the cache is keyed by both.
 * Fails open: without the permission, or if the request fails (e.g. a backend that predates ADR 0041),
 * `settings` stays `null` and the screen behaves as before (both fees, no cap). The backend is the wall.
 */
export const useSubsidySettings = () => {
  const settings = useState<SubsidySettingsDto | null>('subsidy-settings', () => null)
  /** `<userUuid>:<activeRole>` the cached settings belong to; `null` = not loaded. */
  const loadedFor = useState<string | null>('subsidy-settings-key', () => null)

  const sessionKey = (): string => {
    const auth = useAuthStore()
    return `${auth.user?.uuid ?? ''}:${auth.activeRole ?? ''}`
  }

  async function load(force = false): Promise<SubsidySettingsDto | null> {
    const key = sessionKey()
    if (!force && loadedFor.value === key) return settings.value
    loadedFor.value = key // before the await: concurrent callers share this attempt
    const { can } = usePermissions()
    if (!can('SUBSIDY_VIEW_ALL') && !can('SUBSIDY_CREATE')) {
      settings.value = null
      return null
    }
    try {
      settings.value = await useApi<SubsidySettingsDto>('/v1/admin/subsidies/settings', { silent: true })
    }
    catch {
      settings.value = null
    }
    return settings.value
  }

  /** Manual subsidies are off for the organization (menu entry hidden, screen shows an explanation). */
  const disabled = computed(() => settings.value?.mode === 'DISABLED')
  /** Fee enabled by the mode; `true` while the settings are unknown (fail open). */
  const monthlyEnabled = computed(() => settings.value?.monthlyEnabled ?? true)
  const inscriptionEnabled = computed(() => settings.value?.inscriptionEnabled ?? true)
  /** User's cap in %, `null` = no cap (or unknown). */
  const discountCap = computed<number | null>(() => {
    const raw = settings.value?.discountCapPct
    if (raw === null || raw === undefined || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })
  const canExceedCap = computed(() => settings.value?.canExceedCap ?? false)

  return { settings, load, disabled, monthlyEnabled, inscriptionEnabled, discountCap, canExceedCap }
}
