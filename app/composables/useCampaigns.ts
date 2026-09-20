import type { Page } from '~/types/admin'
import type {
  CampaignAudienceMemberDto,
  CampaignDto,
  CampaignExceptionDto,
  CampaignTransactionDto,
  CreateCampaignExceptionRequest,
  CreateCampaignRequest,
  RelaunchCampaignRequest,
  UpdateCampaignRequest,
} from '~/types/campaign'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  includeInactive?: boolean
  /** Only campaigns currently within [startsAt, endsAt] — used by the rule-form campaign picker. */
  onlyActiveWindow?: boolean
  /** Only TARGETED campaigns currently vigent — used by the payment/enrollment registration form. */
  onlyTargetedVigent?: boolean
}

/**
 * Access to commission campaigns (/v1/admin/campaigns — hub plan "commission
 * campaigns"). See app/types/campaign.ts for the contract assumptions this
 * composable is built against pending backend confirmation.
 */
export const useCampaigns = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CampaignDto>>('/v1/admin/campaigns', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.onlyActiveWindow ? { onlyActiveWindow: 'true' } : {}),
        ...(params.onlyTargetedVigent ? { onlyTargetedVigent: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}`)

  const create = (body: CreateCampaignRequest) =>
    useApi<CampaignDto>('/v1/admin/campaigns', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCampaignRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/campaigns/${uuid}/usage`)

  /** Clones the campaign's associated rules onto a fresh one (new dates, same name/description by default). */
  const relaunch = (uuid: string, body: RelaunchCampaignRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/relaunch`, { method: 'POST', body })

  // ---- Audience (scope INCLUDE/EXCLUDE) ----
  const audience = (uuid: string) =>
    useApi<CampaignAudienceMemberDto[]>(`/v1/admin/campaigns/${uuid}/audience`)

  const addAudienceMember = (uuid: string, promoterUuid: string) =>
    useApi<CampaignAudienceMemberDto>(`/v1/admin/campaigns/${uuid}/audience`, { method: 'POST', body: { promoterUuid } })

  const removeAudienceMember = (uuid: string, audienceUuid: string) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}/audience/${audienceUuid}`, { method: 'DELETE' })

  // ---- Transactions (read-only) ----
  const transactions = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<CampaignTransactionDto>>(`/v1/admin/campaigns/${uuid}/transactions`, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  // ---- Manual exceptions ----
  const exceptions = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<CampaignExceptionDto>>(`/v1/admin/campaigns/${uuid}/exceptions`, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  const createException = (uuid: string, body: CreateCampaignExceptionRequest) =>
    useApi<CampaignExceptionDto>(`/v1/admin/campaigns/${uuid}/exceptions`, { method: 'POST', body })

  const removeException = (uuid: string, exceptionUuid: string) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}/exceptions/${exceptionUuid}`, { method: 'DELETE' })

  return {
    list,
    get,
    create,
    update,
    remove,
    usage,
    relaunch,
    audience,
    addAudienceMember,
    removeAudienceMember,
    transactions,
    exceptions,
    createException,
    removeException,
  }
}
