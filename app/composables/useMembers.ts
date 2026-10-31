import type { Page } from '~/types/admin'
import type { Option } from '~/types/options'
import type {
  AssignPromoterRequest,
  BeneficiaryDto,
  BulkAssignPromoterRequest,
  CreateBeneficiaryRequest,
  CreateMemberRequest,
  MedicalRecordDto,
  MemberConfirmationDto,
  MemberDto,
  MemberListItemDto,
  MemberPromoterAssignmentDto,
  MyAdvisorDto,
  PortfolioToSupervisorRequest,
  UpdateBeneficiaryRequest,
  UpdateMemberRequest,
  UpsertMedicalRecordRequest,
} from '~/types/members'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['fullName,asc', 'active,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

interface OptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
}

/**
 * Acceso al vertical de Miembros/Afiliados (/v1/admin/members + /v1/me/member).
 * Permisos del backend por acción:
 * - list/get → MEMBER_VIEW_ALL · create → MEMBER_CREATE · update → MEMBER_UPDATE · remove → MEMBER_DELETE
 * - beneficiaries: mismos permisos MEMBER_* del padre
 * - medical record: get → MEDICAL_RECORD_VIEW · upsert/remove → MEDICAL_RECORD_UPDATE
 * - me() → MEMBER_VIEW_OWN (404 si el usuario no está afiliado)
 */
export const useMembers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<MemberListItemDto>>('/v1/admin/members', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        // Omitted entirely when empty — the backend applies its own default
        // sort (entity_config → system_configs → enrolledAt DESC) only when
        // no `sort=` is present at all.
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  /** Proyección liviana para selects/typeahead (`GET /v1/admin/members/options`), sin paginar. */
  const options = (params: OptionsParams = {}) =>
    useApi<Option[]>('/v1/admin/members/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<MemberDto>(`/v1/admin/members/${uuid}`)

  const create = (body: CreateMemberRequest) =>
    useApi<MemberDto>('/v1/admin/members', { method: 'POST', body })

  const update = (uuid: string, body: UpdateMemberRequest) =>
    useApi<MemberDto>(`/v1/admin/members/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/members/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/members/${uuid}/usage`)

  // ---- Beneficiarios (sub-recurso) ----
  const listBeneficiaries = (memberUuid: string, sort?: string[]) =>
    useApi<BeneficiaryDto[]>(`/v1/admin/members/${memberUuid}/beneficiaries`, {
      query: sort?.length ? { sort } : {},
    })

  const createBeneficiary = (memberUuid: string, body: CreateBeneficiaryRequest) =>
    useApi<BeneficiaryDto>(`/v1/admin/members/${memberUuid}/beneficiaries`, { method: 'POST', body })

  const updateBeneficiary = (memberUuid: string, uuid: string, body: UpdateBeneficiaryRequest) =>
    useApi<BeneficiaryDto>(`/v1/admin/members/${memberUuid}/beneficiaries/${uuid}`, { method: 'PUT', body })

  const removeBeneficiary = (memberUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/members/${memberUuid}/beneficiaries/${uuid}`, { method: 'DELETE' })

  // ---- Histórico médico (1:1) ----
  /** 404 si el miembro aún no tiene histórico (el caller decide cómo tratarlo). */
  const getMedicalRecord = (memberUuid: string) =>
    useApi<MedicalRecordDto>(`/v1/admin/members/${memberUuid}/medical-record`)

  /** Upsert: crea o actualiza (PATCH semantics). */
  const upsertMedicalRecord = (memberUuid: string, body: UpsertMedicalRecordRequest) =>
    useApi<MedicalRecordDto>(`/v1/admin/members/${memberUuid}/medical-record`, { method: 'PUT', body })

  const removeMedicalRecord = (memberUuid: string) =>
    useApi<null>(`/v1/admin/members/${memberUuid}/medical-record`, { method: 'DELETE' })

  // ---- Self-service del afiliado ----
  /** Mi registro de afiliado (MEMBER_VIEW_OWN). 404 si no estoy afiliado. */
  const me = () =>
    useApi<MemberDto>('/v1/me/member', { silent: true })

  /** My covered beneficiaries (GET /v1/me/family, MEMBER_VIEW_OWN). The member detail doesn't inline them. */
  const myFamily = () =>
    useApi<BeneficiaryDto[]>('/v1/me/family', { silent: true })

  /** Add a beneficiary to my own plan (POST /v1/me/family, MEMBER_BENEFICIARY_CREATE_OWN). */
  const addMyBeneficiary = (body: CreateBeneficiaryRequest) =>
    useApi<BeneficiaryDto>('/v1/me/family', { method: 'POST', body })

  /** Give a beneficiary their own portal login, or resend the invitation (BENEFICIARY_ACCESS_GRANT_OWN). */
  const grantBeneficiaryAccess = (uuid: string, email?: string) =>
    useApi<BeneficiaryDto>(`/v1/me/family/${uuid}/access`, { method: 'POST', body: { email } })

  /** Deactivate the beneficiary's login; granting again reactivates it (BENEFICIARY_ACCESS_REVOKE_OWN). */
  const revokeBeneficiaryAccess = (uuid: string) =>
    useApi<BeneficiaryDto>(`/v1/me/family/${uuid}/access`, { method: 'DELETE' })
  /** My current advisor and previous advisors (MEMBER_ADVISOR_VIEW_OWN). `exists=false` when I have no member record (advisors/allies). */
  const myAdvisor = () =>
    useApi<MyAdvisorDto>('/v1/me/member/advisor', { silent: true })

  // ---- Enlace permanente promotor (MEMBER_ASSIGN_PROMOTER) ----
  /** Reasigna o vincula (si el afiliado no tenía) el promotor. `body` trae promoterUuid XOR referralCode. */
  const assignPromoter = (memberUuid: string, body: AssignPromoterRequest) =>
    useApi<MemberPromoterAssignmentDto>(`/v1/admin/members/${memberUuid}/assign-advisor`, { method: 'POST', body })

  /** Histórico de reasignaciones del afiliado, más reciente primero. */
  const promoterHistory = (memberUuid: string) =>
    useApi<MemberPromoterAssignmentDto[]>(`/v1/admin/members/${memberUuid}/advisor-history`)

  /** Reasigna en lote los afiliados seleccionados a un promotor; omite los que ya son suyos. */
  const bulkAssignPromoter = (body: BulkAssignPromoterRequest) =>
    useApi<MemberPromoterAssignmentDto[]>('/v1/admin/members/advisor/bulk-assign', { method: 'POST', body })

  /** Pasa toda la cartera de un promotor a su supervisor activo más cercano (o a INSTITUCION si no tiene). */
  const portfolioToSupervisor = (body: PortfolioToSupervisorRequest) =>
    useApi<MemberPromoterAssignmentDto[]>('/v1/admin/members/advisor/portfolio-to-supervisor', { method: 'POST', body })

  // ---- Confirmación manual del afiliado (MEMBER_CONFIRM) ----
  /** Para afiliados cubiertos por subsidio que nunca generan pago (la confirmación normal ocurre al aprobar el primer pago). */
  const confirm = (memberUuid: string) =>
    useApi<MemberConfirmationDto>(`/v1/admin/members/${memberUuid}/confirm`, { method: 'POST' })

  // ---- Congelar el saldo a favor (PERSON_CREDIT_HOLD_UPDATE, hub ADR 0029) ----
  /** Freezes (`hold = true`, reason required) or releases the automatic use of a person's credit. */
  const setCreditHold = (memberUuid: string, hold: boolean, reason?: string) =>
    useApi<void>(`/v1/admin/members/${memberUuid}/credit-hold`, { method: 'PUT', body: { hold, ...(reason ? { reason } : {}) } })

  return {
    list,
    options,
    get,
    create,
    update,
    remove,
    usage,
    listBeneficiaries,
    createBeneficiary,
    updateBeneficiary,
    removeBeneficiary,
    getMedicalRecord,
    upsertMedicalRecord,
    removeMedicalRecord,
    me,
    myFamily,
    addMyBeneficiary,
    grantBeneficiaryAccess,
    revokeBeneficiaryAccess,
    myAdvisor,
    assignPromoter,
    bulkAssignPromoter,
    portfolioToSupervisor,
    promoterHistory,
    confirm,
    setCreditHold,
  }
}
