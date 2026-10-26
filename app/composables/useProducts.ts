import type { Page } from '~/types/admin'
import type { AllyProductDto } from '~/types/allies'
import type {
  ProductCreateRequest,
  ProductDto,
  ProductListItemDto,
  ProductType,
  ProductUpdateRequest,
  PublicProductDetailDto,
  PublicProductListItemDto,
  PublicProductSearchParams,
} from '~/types/products'

interface ProductListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['name,asc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  type?: ProductType
  /** `true` → only exclusive products, `false` → only general ones, omitted → both. */
  exclusive?: boolean
  includeInactive?: boolean
}

/**
 * Products catalog master (/v1/admin/products — hub ADR 0026).
 * Backend permissions per action:
 * - list/get → PRODUCT_VIEW_ALL · create → PRODUCT_CREATE · update → PRODUCT_UPDATE · remove → PRODUCT_DELETE
 * - image upload/publish/unpublish → PRODUCT_IMAGE_UPLOAD · image delete → PRODUCT_IMAGE_DELETE
 * - offers (every ally offering the product) → ALLY_PRODUCT_VIEW_ALL
 */
export const useProducts = () => {
  const list = (params: ProductListParams = {}) =>
    useApi<Page<ProductListItemDto>>('/v1/admin/products', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        // Omitted when empty so the backend's own default sort applies.
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.exclusive !== undefined ? { exclusive: String(params.exclusive) } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<ProductDto>(`/v1/admin/products/${uuid}`)

  const create = (body: ProductCreateRequest) =>
    useApi<ProductDto>('/v1/admin/products', { method: 'POST', body })

  const update = (uuid: string, body: ProductUpdateRequest) =>
    useApi<ProductDto>(`/v1/admin/products/${uuid}`, { method: 'PUT', body })

  /** Soft delete. */
  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/products/${uuid}`, { method: 'DELETE' })

  /** Every ally offering this product, in any review state. */
  const listOffers = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<AllyProductDto>>(`/v1/admin/products/${uuid}/offers`, {
      query: { page: params.page ?? 0, size: params.size ?? 50 },
    })

  // ---- Catalog image (uploaded private; published explicitly) ----
  const uploadImage = (uuid: string, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return useApi<unknown>(`/v1/admin/products/${uuid}/image`, { method: 'POST', body: form })
  }

  const publishImage = (uuid: string) =>
    useApi<null>(`/v1/admin/products/${uuid}/image/publish`, { method: 'POST' })

  const unpublishImage = (uuid: string) =>
    useApi<null>(`/v1/admin/products/${uuid}/image/unpublish`, { method: 'POST' })

  const deleteImage = (uuid: string) =>
    useApi<null>(`/v1/admin/products/${uuid}/image`, { method: 'DELETE' })

  return {
    list,
    get,
    create,
    update,
    remove,
    listOffers,
    uploadImage,
    publishImage,
    unpublishImage,
    deleteImage,
  }
}

/**
 * Public cross-ally catalog (/v1/public/products, no auth — hub ADR 0026).
 * Every filter takes plain words, as a lead would type them; the `*Uuid`
 * twins the backend still accepts are deliberately not exposed here.
 */
export const usePublicProducts = () => {
  const search = (params: PublicProductSearchParams = {}) =>
    useApi<Page<PublicProductListItemDto>>('/v1/public/products', {
      skipAuth: true,
      query: {
        page: params.page ?? 0,
        size: params.size ?? 12,
        ...(params.q ? { q: params.q } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.city ? { city: params.city } : {}),
        ...(params.ally ? { ally: params.ally } : {}),
      },
    })

  /** Product comparison across allies, best final price first; optional `city` (city or state name). */
  const get = (uuid: string, city?: string) =>
    useApi<PublicProductDetailDto>(`/v1/public/products/${uuid}`, {
      skipAuth: true,
      query: city ? { city } : {},
    })

  return { search, get }
}
