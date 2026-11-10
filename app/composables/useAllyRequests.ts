import type { Page } from '~/types/admin'
import type { AllyRegistrationStatus } from '~/types/allies'
import type {
  AllyImportDelimiter,
  AllyImportResultDto,
  AllyRegistrationChannel,
  AllyRequestApproveRequest,
  AllyRequestDetailDto,
  AllyRequestInviteRequest,
  AllyRequestListItemDto,
  AllyRequestStatusFilter,
} from '~/types/allyRequests'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  status?: AllyRequestStatusFilter
  channel?: AllyRegistrationChannel
}

const BASE = '/v1/admin/ally-requests'

/**
 * Ally requests (hub ADR 0036): review queue of self-registered and imported
 * allies at /v1/admin/ally-requests — approve (with the agreement), reject,
 * reopen, invite to the portal and bulk import from the template.
 */
export const useAllyRequests = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AllyRequestListItemDto>>(BASE, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.channel ? { channel: params.channel } : {}),
      },
    })

  /** Pending count for the menu badge. Silent: the badge simply hides on error. */
  const count = (status: AllyRegistrationStatus = 'PENDING') =>
    useApi<{ count: number }>(`${BASE}/count`, { query: { status }, silent: true })

  const get = (uuid: string) => useApi<AllyRequestDetailDto>(`${BASE}/${uuid}`)

  /**
   * Approves the request. With a signed agreement file it goes as multipart
   * (`request` JSON part + `support`), same technique as afiliarse.vue.
   */
  const approve = (uuid: string, body: AllyRequestApproveRequest, support?: File | null) => {
    let payload: AllyRequestApproveRequest | FormData = body
    if (support) {
      const form = new FormData()
      form.append('request', new Blob([JSON.stringify(body)], { type: 'application/json' }))
      form.append('support', support)
      payload = form
    }
    return useApi<AllyRequestDetailDto>(`${BASE}/${uuid}/approve`, { method: 'POST', body: payload })
  }

  const reject = (uuid: string, reason: string) =>
    useApi<AllyRequestDetailDto>(`${BASE}/${uuid}/reject`, { method: 'POST', body: { reason } })

  const reopen = (uuid: string) =>
    useApi<AllyRequestDetailDto>(`${BASE}/${uuid}/reopen`, { method: 'POST' })

  const invite = (uuid: string, body: AllyRequestInviteRequest) =>
    useApi<AllyRequestDetailDto | void>(`${BASE}/${uuid}/invite`, { method: 'POST', body })

  const agreementSupportUrl = (uuid: string, agreementUuid: string) =>
    useApi<{ url: string, expiresAt?: string }>(`${BASE}/${uuid}/agreements/${agreementUuid}/support-url`)

  /** Uploads the template; `dryRun` only validates. */
  const importFile = (file: File, dryRun: boolean, delimiter: AllyImportDelimiter = 'auto') => {
    const form = new FormData()
    form.append('file', file)
    return useApi<AllyImportResultDto>(`${BASE}/import`, {
      method: 'POST',
      query: { dryRun: String(dryRun), delimiter },
      body: form,
    })
  }

  /** Empty template as a Blob, through the authenticated client. */
  const downloadTemplate = (format: 'xlsx' | 'csv') =>
    useApi<Blob>(`${BASE}/import/template`, {
      query: { format },
      responseType: 'blob',
      headers: { Accept: '*/*' },
    })

  return { list, count, get, approve, reject, reopen, invite, agreementSupportUrl, importFile, downloadTemplate }
}
