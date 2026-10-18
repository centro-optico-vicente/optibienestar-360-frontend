import type { Page } from '~/types/admin'
import type {
  CollectionScoreDto,
  CommissionPeriodSummaryDto,
  PromoterCreateRequest,
  PromoterDashboardDto,
  PromoterDossierUpdateRequest,
  PromoterDto,
  PromoterMemberContactDto,
  PromoterPaymentPromiseRequest,
  PromoterPayoutAccountDto,
  PromoterPayoutAccountRequest,
  PromoterReferenceDto,
  PromoterReferenceRequest,
  PromoterReminderRequest,
  PromoterUpdateRequest,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['displayName,asc', 'active,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

/**
 * Acceso al vertical de Promotores (/v1/admin/promoters).
 * Permisos del backend por acción:
 * - list/get → PROMOTER_VIEW_ALL · create → PROMOTER_CREATE
 * - update → PROMOTER_UPDATE · remove → PROMOTER_DELETE
 *
 * La fila del sistema INSTITUCION aparece en el listado (`system: true`) pero no se
 * puede crear, editar ni eliminar (el backend responde 422).
 */
export const usePromoters = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<PromoterDto>>('/v1/admin/promoters', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`)

  const create = (body: PromoterCreateRequest) =>
    useApi<PromoterDto>('/v1/admin/promoters', { method: 'POST', body })

  const update = (uuid: string, body: PromoterUpdateRequest | PromoterDossierUpdateRequest) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/promoters/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/promoters/${uuid}/usage`)

  /** Cartera de afiliados + salud de cobranza + comisiones del mes en curso. */
  const portfolio = (uuid: string) =>
    useApi<PromoterDashboardDto>(`/v1/admin/promoters/${uuid}/portfolio`)

  /** Historial de comisiones por período, más reciente primero. */
  const commissionsSummary = (uuid: string) =>
    useApi<CommissionPeriodSummaryDto[]>(`/v1/admin/promoters/${uuid}/commissions/summary`)

  /**
   * Self-service dashboard of the logged-in promoter (GET /v1/promoter/me,
   * PROMOTER_VIEW_OWN) — same shape as `portfolio()` but resolved from the
   * JWT instead of a path uuid. Used to populate the member picker on the
   * "Cobros de mis afiliados" registration form without a separate search
   * endpoint scoped to the caller's own downline.
   */
  const me = () => useApi<PromoterDashboardDto>('/v1/promoter/me')

  // ---- Advisor dossier (backend V180) — same PROMOTER_VIEW_ALL / PROMOTER_UPDATE permissions ----

  /** Personal references (1..n). */
  const listReferences = (uuid: string) =>
    useApi<PromoterReferenceDto[]>(`/v1/admin/promoters/${uuid}/references`)

  const createReference = (uuid: string, body: PromoterReferenceRequest) =>
    useApi<PromoterReferenceDto>(`/v1/admin/promoters/${uuid}/references`, { method: 'POST', body })

  const updateReference = (uuid: string, referenceUuid: string, body: PromoterReferenceRequest) =>
    useApi<PromoterReferenceDto>(`/v1/admin/promoters/${uuid}/references/${referenceUuid}`, { method: 'PUT', body })

  const removeReference = (uuid: string, referenceUuid: string) =>
    useApi<null>(`/v1/admin/promoters/${uuid}/references/${referenceUuid}`, { method: 'DELETE' })

  /** Advisor payout accounts (V184), default first. PROMOTER_PAYOUT_ACCOUNT_VIEW_ALL. */
  const listPayoutAccounts = (uuid: string, opts: { silent?: boolean } = {}) =>
    useApi<PromoterPayoutAccountDto[]>(`/v1/admin/promoters/${uuid}/payout-accounts`, { silent: opts.silent })

  /** PROMOTER_PAYOUT_ACCOUNT_CREATE. The advisor's first account becomes the default. */
  const createPayoutAccount = (uuid: string, body: PromoterPayoutAccountRequest) =>
    useApi<PromoterPayoutAccountDto>(`/v1/admin/promoters/${uuid}/payout-accounts`, { method: 'POST', body })

  /** PROMOTER_PAYOUT_ACCOUNT_UPDATE — full replace (blank fields are cleared). */
  const updatePayoutAccount = (uuid: string, accountUuid: string, body: PromoterPayoutAccountRequest) =>
    useApi<PromoterPayoutAccountDto>(`/v1/admin/promoters/${uuid}/payout-accounts/${accountUuid}`, { method: 'PUT', body })

  /** PROMOTER_PAYOUT_ACCOUNT_UPDATE — unsets the previous default in the same request. */
  const setDefaultPayoutAccount = (uuid: string, accountUuid: string) =>
    useApi<PromoterPayoutAccountDto>(`/v1/admin/promoters/${uuid}/payout-accounts/${accountUuid}/default`, { method: 'PUT' })

  /** PROMOTER_PAYOUT_ACCOUNT_DELETE (soft delete). */
  const removePayoutAccount = (uuid: string, accountUuid: string) =>
    useApi<null>(`/v1/admin/promoters/${uuid}/payout-accounts/${accountUuid}`, { method: 'DELETE' })

  /** Read-only own payout accounts of the logged-in advisor (PROMOTER_PAYOUT_ACCOUNT_VIEW_OWN). */
  const myPayoutAccounts = () => useApi<PromoterPayoutAccountDto[]>('/v1/promoter/me/payout-accounts')

  // ---- Portfolio management of the logged-in advisor (PromoterContactsController) ----
  // Reads → PROMOTER_VIEW_OWN · writes → PROMOTER_CONTACT_OWN. The backend
  // answers 404 (promoter.member.not_in_portfolio) for a member outside the
  // caller's own portfolio.

  /** Up-to-date share of the advisor's portfolio. */
  const myCollectionScore = () => useApi<CollectionScoreDto>('/v1/promoter/me/collection-score')

  /** Contact history with one affiliate of the advisor's portfolio, newest first. */
  const myMemberContacts = (memberUuid: string) =>
    useApi<PromoterMemberContactDto[]>('/v1/promoter/me/contacts', { query: { memberUuid } })

  /** Logs a payment reminder sent to the affiliate (note optional). */
  const registerReminder = (memberUuid: string, body: PromoterReminderRequest = {}) =>
    useApi<PromoterMemberContactDto>(`/v1/promoter/me/contacts/${memberUuid}/reminder`, { method: 'POST', body })

  /** Logs the affiliate's commitment to pay `promisedAmount` by `promisedAtDate`. */
  const registerPaymentPromise = (memberUuid: string, body: PromoterPaymentPromiseRequest) =>
    useApi<PromoterMemberContactDto>(`/v1/promoter/me/contacts/${memberUuid}/payment-promise`, { method: 'POST', body })

  return {
    list, get, create, update, remove, usage, portfolio, commissionsSummary, me,
    listReferences, createReference, updateReference, removeReference,
    listPayoutAccounts, createPayoutAccount, updatePayoutAccount, setDefaultPayoutAccount, removePayoutAccount, myPayoutAccounts,
    myCollectionScore, myMemberContacts, registerReminder, registerPaymentPromise,
  }
}
