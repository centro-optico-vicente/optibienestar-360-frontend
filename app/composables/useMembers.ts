import type { Page } from '~/types/admin'
import type { Option } from '~/types/options'
import type {
  BeneficiaryDto,
  CreateBeneficiaryRequest,
  CreateMemberRequest,
  MedicalRecordDto,
  MemberDto,
  UpdateBeneficiaryRequest,
  UpdateMemberRequest,
  UpsertMedicalRecordRequest,
} from '~/types/members'

interface ListParams {
  page?: number
  size?: number
  sort?: string
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
    useApi<Page<MemberDto>>('/v1/admin/members', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'enrolledAt,desc',
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

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/members/${uuid}`, { method: 'DELETE' })

  // ---- Beneficiarios (sub-recurso) ----
  const listBeneficiaries = (memberUuid: string) =>
    useApi<BeneficiaryDto[]>(`/v1/admin/members/${memberUuid}/beneficiaries`)

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

  return {
    list,
    options,
    get,
    create,
    update,
    remove,
    listBeneficiaries,
    createBeneficiary,
    updateBeneficiary,
    removeBeneficiary,
    getMedicalRecord,
    upsertMedicalRecord,
    removeMedicalRecord,
    me,
  }
}
