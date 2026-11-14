import type { Option } from '~/types/options'
import type { Page } from '~/types/admin'
import type {
  CampaignAllyBenefitRowDto,
  CampaignAudienceDto,
  CampaignCloseRequest,
  CampaignDto,
  CampaignEffectivenessDto,
  CampaignExceptionDto,
  CampaignExceptionRequest,
  CampaignPaymentsDto,
  CampaignQuotaDto,
  CampaignRelaunchRequest,
  CampaignRemindPendingResultDto,
  CampaignReopenRequest,
  CampaignSlotDto,
  CampaignSlotIssueDto,
  CampaignSlotStatus,
  CampaignTransactionLinkDto,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '~/types/campaign'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  /** RSQL over the allow-listed fields (`scope`, `mode`, `enabled`, `startsAt`, `endsAt`…), e.g. `scope==TARGETED`. */
  filter?: string
  includeInactive?: boolean
  /** Validity range `yyyy-MM-dd`, inclusive (campaigns whose period overlaps it). */
  dateFrom?: string
  dateTo?: string
  /** Only campaigns currently within [startsAt, endsAt] — used by the rule-form campaign picker. */
  onlyActiveWindow?: boolean
  /** Only TARGETED campaigns currently vigent — used by the payment/enrollment registration form. */
  onlyTargetedVigent?: boolean
}

/**
 * Access to commission campaigns (/v1/admin/campaigns — hub plan "commission
 * campaigns"). Confirmed against the real backend contract
 * (AdminCampaignController, optibienestar-360-backend modules/campaign).
 */
export const useCampaigns = () => {
  /** Lightweight projection for selects (`GET /v1/admin/campaigns/options`) — any session, no CAMPAIGN_VIEW_ALL needed. */
  const options = (params: { q?: string, limit?: number, currentValues?: string[] } = {}) =>
    useApi<Option[]>('/v1/admin/campaigns/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        limit: params.limit ?? DROPDOWN_PAGE_SIZE,
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      },
    })

  const list = (params: ListParams = {}) =>
    useApi<Page<CampaignDto>>('/v1/admin/campaigns', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
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

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}`, { method: 'DELETE' })

  /** Clones the campaign's config + anchored commission rules onto a fresh one with new dates. */
  const relaunch = (uuid: string, body: CampaignRelaunchRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/relaunch`, { method: 'POST', body })

  // ---- Lifecycle (hub ADR 0038) — every transition returns the updated CampaignDto ----
  /** DRAFT → ACTIVE (CAMPAIGN_UPDATE). */
  const activate = (uuid: string) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/activate`, { method: 'POST' })

  /** ACTIVE | SOLD_OUT → PAUSED (CAMPAIGN_PAUSE). */
  const pause = (uuid: string) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/pause`, { method: 'POST' })

  /** PAUSED → ACTIVE, or SOLD_OUT when still full (CAMPAIGN_PAUSE). */
  const resume = (uuid: string) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/resume`, { method: 'POST' })

  /** Any non-closed status → CLOSED / MANUAL (CAMPAIGN_CLOSE). */
  const close = (uuid: string, body: CampaignCloseRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/close`, { method: 'POST', body })

  /** CLOSED → ACTIVE (or SOLD_OUT) after enlarging the max and/or the end date (CAMPAIGN_REOPEN). */
  const reopen = (uuid: string, body: CampaignReopenRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/reopen`, { method: 'POST', body })

  /** Slot counters of the campaign and each promotion (CAMPAIGN_VIEW_ALL). */
  const quota = (uuid: string) =>
    useApi<CampaignQuotaDto>(`/v1/admin/campaigns/${uuid}/quota`)

  /** Ally-benefit vouchers per ally and promotion, for reconciliation (CAMPAIGN_VIEW_ALL). */
  const allyBenefits = (uuid: string) =>
    useApi<CampaignAllyBenefitRowDto[]>(`/v1/admin/campaigns/${uuid}/ally-benefits`)

  /** JSON effectiveness summary (GET /{uuid}/effectiveness) — NOT a file download. */
  const getEffectiveness = (uuid: string) =>
    useApi<CampaignEffectivenessDto>(`/v1/admin/campaigns/${uuid}/effectiveness`)

  // ---- Slot reconciliation with payments (hub ADR 0038 point 9) ----
  /** Slots of the campaign, filterable by status (CAMPAIGN_VIEW_ALL). */
  const slots = (uuid: string, params: { status?: CampaignSlotStatus | null, page?: number, size?: number } = {}) =>
    useApi<Page<CampaignSlotDto>>(`/v1/admin/campaigns/${uuid}/slots`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 25,
        ...(params.status ? { status: params.status } : {}),
      },
    })

  /** PENDING → CONFIRMED by hand, with a required note (PROMOTION_SLOT_CONFIRM). 422 when not PENDING. */
  const confirmSlot = (uuid: string, slotUuid: string, note: string) =>
    useApi<CampaignSlotDto>(`/v1/admin/campaigns/${uuid}/slots/${slotUuid}/confirm`, { method: 'POST', body: { note } })

  /** Frees a PENDING slot, or a CONFIRMED one not used yet, with a required note (PROMOTION_SLOT_RELEASE). */
  const releaseSlot = (uuid: string, slotUuid: string, note: string) =>
    useApi<CampaignSlotDto>(`/v1/admin/campaigns/${uuid}/slots/${slotUuid}/release`, { method: 'POST', body: { note } })

  /** Inconsistencies between slots and payments (CAMPAIGN_VIEW_ALL). */
  const slotIssues = (uuid: string) =>
    useApi<CampaignSlotIssueDto[]>(`/v1/admin/campaigns/${uuid}/slot-issues`)

  /** "Pagos" section: totals + one row per slot (CAMPAIGN_PAYMENT_VIEW). */
  const payments = (uuid: string, params: { slotStatus?: CampaignSlotStatus | null, paymentStatus?: string | null, page?: number, size?: number } = {}) =>
    useApi<CampaignPaymentsDto>(`/v1/admin/campaigns/${uuid}/payments`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 25,
        ...(params.slotStatus ? { slotStatus: params.slotStatus } : {}),
        ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
      },
    })

  /** Emails the advisor and the payment approvers (CAMPAIGN_PAYMENT_REMIND). 422 when reminded less than 1 h ago. */
  const remindPayment = (uuid: string, paymentUuid: string, note?: string | null) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}/payments/${paymentUuid}/remind`, { method: 'POST', body: { note: note || null } })

  /** Reminds every PENDING slot with a payment in review; skips those reminded less than 1 h ago. */
  const remindPending = (uuid: string, note?: string | null) =>
    useApi<CampaignRemindPendingResultDto>(`/v1/admin/campaigns/${uuid}/payments/remind-pending`, { method: 'POST', body: { note: note || null } })

  // ---- Audience (scope INCLUDE/EXCLUDE) ----
  const audience = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<CampaignAudienceDto>>(`/v1/admin/campaigns/${uuid}/audience`, {
      query: { page: params.page ?? 0, size: params.size ?? 50 },
    })

  const addAudienceMember = (uuid: string, promoterUuid: string) =>
    useApi<CampaignAudienceDto>(`/v1/admin/campaigns/${uuid}/audience`, { method: 'POST', body: { promoterUuid } })

  const removeAudienceMember = (uuid: string, promoterUuid: string) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}/audience/${promoterUuid}`, { method: 'DELETE' })

  // ---- Transactions (read-only) ----
  const transactions = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<CampaignTransactionLinkDto>>(`/v1/admin/campaigns/${uuid}/transactions`, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  // ---- Manual exceptions ----
  const exceptions = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<CampaignExceptionDto>>(`/v1/admin/campaigns/${uuid}/exceptions`, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  /** Returns the updated CampaignDto (not the exception row) — matches AdminCampaignController#createException. */
  const createException = (uuid: string, body: CampaignExceptionRequest) =>
    useApi<CampaignDto>(`/v1/admin/campaigns/${uuid}/exceptions`, { method: 'POST', body })

  const removeException = (uuid: string, exceptionUuid: string) =>
    useApi<null>(`/v1/admin/campaigns/${uuid}/exceptions/${exceptionUuid}`, { method: 'DELETE' })

  return {
    options,
    list,
    get,
    create,
    update,
    remove,
    relaunch,
    activate,
    pause,
    resume,
    close,
    reopen,
    quota,
    allyBenefits,
    slots,
    confirmSlot,
    releaseSlot,
    slotIssues,
    payments,
    remindPayment,
    remindPending,
    getEffectiveness,
    audience,
    addAudienceMember,
    removeAudienceMember,
    transactions,
    exceptions,
    createException,
    removeException,
  }
}
