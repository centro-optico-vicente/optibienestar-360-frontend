import type { Page } from '~/types/admin'
import type { CatalogRef } from '~/types/members'
import type {
  AllyAgreementDto,
  AllyDto,
  AllyListItemDto,
  AllyProductCreateRequest,
  AllyProductDto,
  AllyProductReviewLogDto,
  AllyProductUpdateRequest,
  AllyUserDto,
  AssignAllyUserRequest,
  CreateAllyAgreementRequest,
  CreateAllyRequest,
  MyAllyDto,
  ProposeAllyProductRequest,
  PublicAllyDetailDto,
  PublicAllyListItemDto,
  UpdateAllyAgreementRequest,
  UpdateAllyRequest,
  UpdateAllyUserRequest,
  UserAllyDto,
} from '~/types/allies'
import type { ProductListItemDto, ProductType } from '~/types/products'
import type { TermsVersionDto } from '~/types/terms'

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
 * - products (offers, hub ADR 0026) → ALLY_PRODUCT_VIEW_ALL/CREATE/UPDATE/DELETE; review → ALLY_PRODUCT_APPROVE
 * - proposeProduct → isAuthenticated() con membresía OWNER/STAFF en el ally
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

  // ---- Products and services (offers of the products catalog, hub ADR 0026) ----
  const listProducts = (allyUuid: string, params: { page?: number, size?: number, sort?: string[], q?: string, type?: ProductType } = {}) =>
    useApi<Page<AllyProductDto>>(`/v1/admin/allies/${allyUuid}/products`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
    })

  const getProduct = (allyUuid: string, uuid: string) =>
    useApi<AllyProductDto>(`/v1/admin/allies/${allyUuid}/products/${uuid}`)

  const createProduct = (allyUuid: string, body: AllyProductCreateRequest) =>
    useApi<AllyProductDto>(`/v1/admin/allies/${allyUuid}/products`, { method: 'POST', body })

  const updateProduct = (allyUuid: string, uuid: string, body: AllyProductUpdateRequest) =>
    useApi<AllyProductDto>(`/v1/admin/allies/${allyUuid}/products/${uuid}`, { method: 'PUT', body })

  const removeProduct = (allyUuid: string, uuid: string) =>
    useApi<null>(`/v1/admin/allies/${allyUuid}/products/${uuid}`, { method: 'DELETE' })

  // ---- Offer review workflow (ALLY_PRODUCT_APPROVE; log → ALLY_PRODUCT_VIEW_ALL) ----
  const listPendingProducts = (params: { allyUuid?: string, productCategoryUuid?: string, q?: string, page?: number, size?: number } = {}) =>
    useApi<Page<AllyProductDto>>('/v1/admin/ally-products/pending', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.allyUuid ? { allyUuid: params.allyUuid } : {}),
        ...(params.productCategoryUuid ? { productCategoryUuid: params.productCategoryUuid } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const approveProduct = (uuid: string, comment?: string) =>
    useApi<AllyProductDto>(`/v1/admin/ally-products/${uuid}/approve`, { method: 'POST', body: comment ? { comment } : {} })

  /** `reason` is mandatory (shown to the ally). */
  const rejectProduct = (uuid: string, reason: string) =>
    useApi<AllyProductDto>(`/v1/admin/ally-products/${uuid}/reject`, { method: 'POST', body: { reason } })

  /** Takes an APPROVED offer down (REMOVED); `reason` is mandatory. */
  const withdrawProduct = (uuid: string, reason: string) =>
    useApi<AllyProductDto>(`/v1/admin/ally-products/${uuid}/remove`, { method: 'POST', body: { reason } })

  const productReviewLog = (uuid: string) =>
    useApi<AllyProductReviewLogDto[]>(`/v1/admin/ally-products/${uuid}/log`)

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

  /**
   * Current ALIADO contract templates this ally may sign — general ones plus
   * those scoped to the ally, one of its types or their segment — most specific
   * first. Gated by ALLY_AGREEMENT_CREATE / _UPDATE. Always 200, `[]` if none.
   */
  const listApplicableTerms = (allyUuid: string) =>
    useApi<TermsVersionDto[]>(`/v1/admin/allies/${allyUuid}/applicable-terms`)

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

  // ---- Como aliado (panel /allies/*) ----
  /**
   * Proposes an offer for my ally (lands in reviewStatus=PROPOSED): of an
   * existing general product (`productUuid`) or of a new item that becomes
   * exclusive to the ally.
   */
  const proposeProduct = (body: ProposeAllyProductRequest) =>
    useApi<AllyProductDto>('/v1/me/allies/products', { method: 'POST', body })

  /**
   * Products my ally may still offer — general ones plus its own exclusive
   * ones, minus those it already offers (membership-gated, no admin key).
   */
  const listOfferableProducts = (allyUuid: string, params: { q?: string, type?: string, size?: number } = {}) =>
    useApi<Page<ProductListItemDto>>('/v1/me/allies/products/offerable', {
      query: {
        allyUuid,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
    })

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
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    removeProduct,
    listPendingProducts,
    approveProduct,
    rejectProduct,
    withdrawProduct,
    productReviewLog,
    listAgreements,
    createAgreement,
    updateAgreement,
    removeAgreement,
    listApplicableTerms,
    listUsers,
    assignUser,
    updateUser,
    removeUser,
    listAlliesForUser,
    proposeProduct,
    listOfferableProducts,
  }
}

/**
 * Plain-word filters of the public directory (hub ADR 0026) — what a lead would
 * type, never ids: `q` matches name, RIF, ally number, description, city and
 * state; `city` a city or state name; `category` / `type` (`servicio`/`producto`)
 * keep allies publicly offering something of that category or type; `segment`
 * (`B2B` / `B2P`, hub ADR 0031) keeps only commercial or only professional allies.
 */
interface PublicDirectoryParams {
  page?: number
  size?: number
  q?: string
  city?: string
  category?: string
  type?: string
  segment?: string
}

/**
 * Directorio público de aliados (/v1/public/allies), sin autenticación.
 * Solo devuelve aliados PUBLISHED + ACTIVE con datos sanitizados.
 */
export const usePublicAllies = () => {
  const list = (params: PublicDirectoryParams = {}) =>
    useApi<Page<PublicAllyListItemDto>>('/v1/public/allies', {
      skipAuth: true,
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
        ...(params.city ? { city: params.city } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.segment ? { segment: params.segment } : {}),
      },
    })

  /** Detalle público (incluye professions + productos y servicios APPROVED/PUBLISHED/ACTIVE). */
  const get = (uuid: string) =>
    useApi<PublicAllyDetailDto>(`/v1/public/allies/${uuid}`, { skipAuth: true })

  return { list, get }
}

/**
 * Partner self-identification (GET /v1/me/allies, ALLY_VIEW_OWN).
 *
 * This is what lets the partner portal know its own `allyUuid` — required by
 * POST /v1/allies/me/benefit-usages and POST /v1/me/allies/products. Scoped by the JWT
 * subject: there is no way to ask for another user's allies.
 *
 * Always 200. A partner user not yet attached to an ally gets `[]`, which the
 * portal renders as an empty state rather than an error.
 */
export const useMyAllies = () => {
  /** Allies I operate on, primary first then alphabetical (order set by the backend). */
  const list = () => useApi<MyAllyDto[]>('/v1/me/allies')

  /** The ally's OWN offers in every review state (any active member may read). */
  const listProducts = (allyUuid: string, params: { q?: string, type?: string, page?: number, size?: number } = {}) =>
    useApi<Page<AllyProductDto>>(`/v1/me/allies/${allyUuid}/products`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.q ? { q: params.q } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
    })

  return { list, listProducts }
}
