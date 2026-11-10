import type { SelectItem } from '~/types/options'

/**
 * The advisors as select items, for the "Asesor" filters and the ally advisor modal. The list needs
 * PROMOTER_VIEW_ALL (`GET /v1/admin/advisors`); without it `available` is false and `options` stays empty, so the
 * callers hide the control. The system row (INSTITUCION) is left out: it is not a person who brings allies in.
 */
export const useAdvisorOptions = () => {
  const { t } = useI18n()
  const { can } = usePermissions()
  const promotersApi = usePromoters()
  const options = ref<SelectItem[]>([])
  const available = computed(() => can('PROMOTER_VIEW_ALL'))

  async function load() {
    if (!available.value || options.value.length > 0) return
    try {
      const res = await promotersApi.list({ size: 200, sort: ['displayName,asc'] })
      options.value = (res.content ?? [])
        .filter(p => !p.system)
        .map(p => ({ label: `${p.displayName} (${p.referralCode || t('common.noCode')})`, value: p.uuid }))
    }
    catch {
      options.value = []
    }
  }

  return { options, available, load }
}
