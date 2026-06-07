import type { Page } from '~/types/admin'
import type { CatalogRef } from '~/types/members'
import type {
  AllyAgreementDto,
  AllyDto,
  AllyServiceDto,
  AllyUserDto,
  AssignAllyUserRequest,
  CreateAllyAgreementRequest,
  CreateAllyRequest,
  CreateAllyServiceRequest,
  ProposeAllyServiceRequest,
  PublicAllyDto,
  UpdateAllyAgreementRequest,
  UpdateAllyRequest,
  UpdateAllyServiceRequest,
  UpdateAllyUserRequest,
} from '~/types/allies'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
}

/**
 * Acceso al vertical de Aliados (/v1/admin/allies + sub-recursos).
 * Permisos del backend por acción:
 * - list/get y sub-recursos (read) → ALLY_VIEW_ALL
 * - create → ALLY_CREATE · update → ALLY_UPDATE · remove → ALLY_DELETE
 * - agreements (CRUD completo) → ALLY_AGREEMENT_MANAGE
 * - proposeService → isAuthenticated() con membresía OWNER/STAFF en el ally
 */
export const useAllies = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AllyDto>>('/v1/admin/allies', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'name,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<AllyDto>(`/v1/admin/allies/${uuid}`)

  const create = (body: CreateAllyRequest) =>
    useApi<AllyDto>('/v1/admin/allies', { method: 'POST', body })

  const update = (uuid: string, body: UpdateAllyRequest) =>
    useApi<AllyDto>(`/v1/admin/allies/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/allies/${uuid}`, { method: 'DELETE' })

  // ---- Especialidades (ManyToMany: añadir/quitar sin body) ----
  const listSpecialties = (allyUuid: string) =>
    useApi<CatalogRef[]>(`/v1/admin/allies/${allyUuid}/specialties`)

  const addSpecialty = (allyUuid: string, specialtyUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/specialties/${specialtyUuid}`, { method: 'POST' })

  const removeSpecialty = (allyUuid: string, specialtyUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/specialties/${specialtyUuid}`, { method: 'DELETE' })

  // ---- Servicios ----
  const listServices = (allyUuid: string) =>
    useApi<AllyServiceDto[]>(`/v1/admin/allies/${allyUuid}/services`)

  const createService = (allyUuid: string, body: CreateAllyServiceRequest) =>
    useApi<AllyServiceDto>(`/v1/admin/allies/${allyUuid}/services`, { method: 'POST', body })

  const updateService = (allyUuid: string, uuid: string, body: UpdateAllyServiceRequest) =>
    useApi<AllyServiceDto>(`/v1/admin/allies/${allyUuid}/services/${uuid}`, { method: 'PUT', body })

  const removeService = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/services/${uuid}`, { method: 'DELETE' })

  // ---- Acuerdos (ALLY_AGREEMENT_MANAGE) ----
  const listAgreements = (allyUuid: string) =>
    useApi<AllyAgreementDto[]>(`/v1/admin/allies/${allyUuid}/agreements`)

  const createAgreement = (allyUuid: string, body: CreateAllyAgreementRequest) =>
    useApi<AllyAgreementDto>(`/v1/admin/allies/${allyUuid}/agreements`, { method: 'POST', body })

  const updateAgreement = (allyUuid: string, uuid: string, body: UpdateAllyAgreementRequest) =>
    useApi<AllyAgreementDto>(`/v1/admin/allies/${allyUuid}/agreements/${uuid}`, { method: 'PUT', body })

  const removeAgreement = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/agreements/${uuid}`, { method: 'DELETE' })

  // ---- Staff (usuarios del aliado) ----
  const listUsers = (allyUuid: string) =>
    useApi<AllyUserDto[]>(`/v1/admin/allies/${allyUuid}/users`)

  const assignUser = (allyUuid: string, body: AssignAllyUserRequest) =>
    useApi<AllyUserDto>(`/v1/admin/allies/${allyUuid}/users`, { method: 'POST', body })

  const updateUser = (allyUuid: string, uuid: string, body: UpdateAllyUserRequest) =>
    useApi<AllyUserDto>(`/v1/admin/allies/${allyUuid}/users/${uuid}`, { method: 'PUT', body })

  const removeUser = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/users/${uuid}`, { method: 'DELETE' })

  // ---- Como aliado (panel /aliado/*) ----
  /** Propone un servicio para mi ally (queda en reviewStatus=PROPOSED). */
  const proposeService = (body: ProposeAllyServiceRequest) =>
    useApi<AllyServiceDto>('/v1/aliado/services', { method: 'POST', body })

  return {
    list,
    get,
    create,
    update,
    remove,
    listSpecialties,
    addSpecialty,
    removeSpecialty,
    listServices,
    createService,
    updateService,
    removeService,
    listAgreements,
    createAgreement,
    updateAgreement,
    removeAgreement,
    listUsers,
    assignUser,
    updateUser,
    removeUser,
    proposeService,
  }
}

interface PublicDirectoryParams {
  page?: number
  size?: number
  q?: string
  cityUuid?: string
  specialtyUuid?: string
}

/**
 * Directorio público de aliados (/v1/public/allies), sin autenticación.
 * Solo devuelve aliados PUBLISHED + ACTIVE con datos sanitizados.
 */
export const usePublicAllies = () => {
  const list = (params: PublicDirectoryParams = {}) =>
    useApi<Page<PublicAllyDto>>('/v1/public/allies', {
      skipAuth: true,
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
        ...(params.cityUuid ? { cityUuid: params.cityUuid } : {}),
        ...(params.specialtyUuid ? { specialtyUuid: params.specialtyUuid } : {}),
      },
    })

  /** Detalle público (incluye specialties + servicios APPROVED/PUBLISHED/ACTIVE). */
  const get = (uuid: string) =>
    useApi<PublicAllyDto>(`/v1/public/allies/${uuid}`, { skipAuth: true })

  return { list, get }
}
