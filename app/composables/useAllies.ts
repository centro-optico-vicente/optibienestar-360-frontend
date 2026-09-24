import type { Page } from '~/types/admin'
import type { CatalogRef } from '~/types/members'
import type {
  AllyAgreementDto,
  AllyDto,
  AllyListItemDto,
  AllyServiceDto,
  AllyUserDto,
  AssignAllyUserRequest,
  CreateAllyAgreementRequest,
  CreateAllyRequest,
  CreateAllyServiceRequest,
  MyAllyDto,
  ProposeAllyServiceRequest,
  PublicAllyDto,
  UpdateAllyAgreementRequest,
  UpdateAllyRequest,
  UpdateAllyServiceRequest,
  UpdateAllyUserRequest,
  UserAllyDto,
} from '~/types/allies'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['name,asc', 'active,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

/**
 * Acceso al vertical de Aliados (/v1/admin/allies + sub-recursos).
 * Permisos del backend por acción:
 * - list/get y sub-recursos (read) → ALLY_VIEW_ALL
 * - create → ALLY_CREATE · update → ALLY_UPDATE · remove → ALLY_DELETE
 * - agreements → ALLY_AGREEMENT_VIEW_ALL/CREATE/UPDATE/DELETE (V79, decoupled from ALLY_VIEW_ALL)
 * - staff (users) → ALLY_USER_VIEW_ALL/CREATE/UPDATE/DELETE (V79, decoupled from ALLY_VIEW_ALL/ALLY_UPDATE)
 * - proposeService → isAuthenticated() con membresía OWNER/STAFF en el ally
 */
export const useAllies = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AllyListItemDto>>('/v1/admin/allies', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        // Omitted entirely when empty — the backend applies its own default
        // sort (entity_config → system_configs → createdAt DESC) only when
        // no `sort=` is present at all; sending a hardcoded default here
        // would fight the click-to-sort state (see allies/index.vue).
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<AllyDto>(`/v1/admin/allies/${uuid}`)

  const create = (body: CreateAllyRequest) =>
    useApi<AllyDto>('/v1/admin/allies', { method: 'POST', body })

  const update = (uuid: string, body: UpdateAllyRequest) =>
    useApi<AllyDto>(`/v1/admin/allies/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/allies/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** Reverses a soft-delete (sets `active` back to true). */
  const restore = (uuid: string) =>
    useApi<AllyDto>(`/v1/admin/allies/${uuid}/restore`, { method: 'POST' })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/allies/${uuid}/usage`)

  // ---- Profesiones (ManyToMany: añadir/quitar sin body) ----
  const listProfessions = (allyUuid: string, sort?: string[]) =>
    useApi<CatalogRef[]>(`/v1/admin/allies/${allyUuid}/professions`, {
      query: sort?.length ? { sort } : {},
    })

  const addProfession = (allyUuid: string, professionUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/professions/${professionUuid}`, { method: 'POST' })

  const removeProfession = (allyUuid: string, professionUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/professions/${professionUuid}`, { method: 'DELETE' })

  // ---- Tipos de aliado (ManyToMany: añadir/quitar sin body) ----
  const listAllyTypes = (allyUuid: string, sort?: string[]) =>
    useApi<CatalogRef[]>(`/v1/admin/allies/${allyUuid}/ally-types`, {
      query: sort?.length ? { sort } : {},
    })

  const addAllyType = (allyUuid: string, allyTypeUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/ally-types/${allyTypeUuid}`, { method: 'POST' })

  const removeAllyType = (allyUuid: string, allyTypeUuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/ally-types/${allyTypeUuid}`, { method: 'DELETE' })

  // ---- Servicios ----
  const listServices = (allyUuid: string, sort?: string[]) =>
    useApi<AllyServiceDto[]>(`/v1/admin/allies/${allyUuid}/services`, {
      query: sort?.length ? { sort } : {},
    })

  const createService = (allyUuid: string, body: CreateAllyServiceRequest) =>
    useApi<AllyServiceDto>(`/v1/admin/allies/${allyUuid}/services`, { method: 'POST', body })

  const updateService = (allyUuid: string, uuid: string, body: UpdateAllyServiceRequest) =>
    useApi<AllyServiceDto>(`/v1/admin/allies/${allyUuid}/services/${uuid}`, { method: 'PUT', body })

  const removeService = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/services/${uuid}`, { method: 'DELETE' })

  // ---- Acuerdos (ALLY_AGREEMENT_VIEW_ALL / _CREATE / _UPDATE / _DELETE) ----
  const listAgreements = (allyUuid: string, sort?: string[]) =>
    useApi<AllyAgreementDto[]>(`/v1/admin/allies/${allyUuid}/agreements`, {
      query: sort?.length ? { sort } : {},
    })

  const createAgreement = (allyUuid: string, body: CreateAllyAgreementRequest) =>
    useApi<AllyAgreementDto>(`/v1/admin/allies/${allyUuid}/agreements`, { method: 'POST', body })

  const updateAgreement = (allyUuid: string, uuid: string, body: UpdateAllyAgreementRequest) =>
    useApi<AllyAgreementDto>(`/v1/admin/allies/${allyUuid}/agreements/${uuid}`, { method: 'PUT', body })

  const removeAgreement = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/agreements/${uuid}`, { method: 'DELETE' })

  // ---- Staff (ALLY_USER_VIEW_ALL / _CREATE / _UPDATE / _DELETE) ----
  const listUsers = (allyUuid: string, sort?: string[]) =>
    useApi<AllyUserDto[]>(`/v1/admin/allies/${allyUuid}/users`, {
      query: sort?.length ? { sort } : {},
    })

  const assignUser = (allyUuid: string, body: AssignAllyUserRequest) =>
    useApi<AllyUserDto>(`/v1/admin/allies/${allyUuid}/users`, { method: 'POST', body })

  const updateUser = (allyUuid: string, uuid: string, body: UpdateAllyUserRequest) =>
    useApi<AllyUserDto>(`/v1/admin/allies/${allyUuid}/users/${uuid}`, { method: 'PUT', body })

  const removeUser = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/users/${uuid}`, { method: 'DELETE' })

  /** Inverse of listUsers: allies a given user belongs to (ALLY_VIEW_ALL). Always 200, `[]` if none. */
  const listAlliesForUser = (userUuid: string, sort?: string[]) =>
    useApi<UserAllyDto[]>(`/v1/admin/users/${userUuid}/allies`, {
      query: sort?.length ? { sort } : {},
    })

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
    restore,
    usage,
    listProfessions,
    addProfession,
    removeProfession,
    listAllyTypes,
    addAllyType,
    removeAllyType,
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
    listAlliesForUser,
    proposeService,
  }
}

interface PublicDirectoryParams {
  page?: number
  size?: number
  q?: string
  cityUuid?: string
  professionUuid?: string
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
        ...(params.professionUuid ? { professionUuid: params.professionUuid } : {}),
      },
    })

  /** Detalle público (incluye professions + servicios APPROVED/PUBLISHED/ACTIVE). */
  const get = (uuid: string) =>
    useApi<PublicAllyDto>(`/v1/public/allies/${uuid}`, { skipAuth: true })

  return { list, get }
}

/**
 * Partner self-identification (GET /v1/me/allies, ALLY_VIEW_OWN).
 *
 * This is what lets the partner portal know its own `allyUuid` — required by
 * POST /v1/ally/benefit-usage and POST /v1/aliado/services. Scoped by the JWT
 * subject: there is no way to ask for another user's allies.
 *
 * Always 200. A partner user not yet attached to an ally gets `[]`, which the
 * portal renders as an empty state rather than an error.
 */
export const useMyAllies = () => {
  /** Allies I operate on, primary first then alphabetical (order set by the backend). */
  const list = () => useApi<MyAllyDto[]>('/v1/me/allies')

  return { list }
}
