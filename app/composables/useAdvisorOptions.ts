import type { SelectItem } from '~/types/options'

/**
 * The advisors as select items, for the "Asesor" filters and the ally advisor modal. Fed by
 * `GET /v1/admin/advisors/options` (any session): it does NOT need PROMOTER_VIEW_ALL, which also opens the
 * advisors screen, so whoever manages allies can pick an advisor without seeing that screen.
 * The search (`q`) always runs on the server. The system advisor (INSTITUCION) is left out by the backend: it
 * is not a person who brings allies in.
 */
export const useAdvisorOptions = () => {
  const { t } = useI18n()
  const promotersApi = usePromoters()

  /** One server search: the first `DROPDOWN_PAGE_SIZE` advisors matching `q` ('' = no filter). */
  async function search(q = ''): Promise<SelectItem[]> {
    try {
      const res = await promotersApi.options({ q })
      return res.map(p => ({ label: `${p.label} (${p.code || t('common.noCode')})`, value: p.uuid }))
    }
    catch {
      return []
    }
  }

  return { search }
}
