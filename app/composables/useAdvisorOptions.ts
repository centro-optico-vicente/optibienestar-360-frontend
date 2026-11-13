import type { SelectItem } from '~/types/options'

/**
 * The advisors as select items, for the "Asesor" filters and the ally advisor modal. Fed by
 * `GET /v1/admin/advisors/options` (any session): it does NOT need PROMOTER_VIEW_ALL, which also opens the
 * advisors screen, so whoever manages allies can pick an advisor without seeing that screen.
 */
export const useAdvisorOptions = () => {
  const { t } = useI18n()
  const promotersApi = usePromoters()
  const options = ref<SelectItem[]>([])

  async function load() {
    if (options.value.length > 0) return
    try {
      const res = await promotersApi.options({ limit: 200 })
      options.value = res.map(p => ({ label: `${p.label} (${p.code || t('common.noCode')})`, value: p.uuid }))
    }
    catch {
      options.value = []
    }
  }

  return { options, load }
}
