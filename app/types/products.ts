// Types for the products catalog master (/v1/admin/products — hub ADR 0026).
//
// A product (or service) is the catalog item; what an ally sells is an
// *offer* of it (`AllyProductDto`, see ~/types/allies). `ownerAlly` null means
// the product is **general** (any ally may offer it); set means it is
// **exclusive** to that ally. JSON follows the `_Display` convention (hub
// ADR 0014): FKs travel as `<rel>_Uuid` + `<rel>_Display`, presentational
// scalars carry a read-only `<field>_Display` sibling.

export type ProductType = 'SERVICE' | 'PRODUCT'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const PRODUCT_TYPE_OPTIONS: { label: string, value: ProductType, labelKey: string }[] = [
  { label: 'Servicio', value: 'SERVICE', labelKey: 'products.types.SERVICE' },
  { label: 'Producto', value: 'PRODUCT', labelKey: 'products.types.PRODUCT' },
]

/**
 * Row of `GET /v1/admin/products` (`AppliedSortPage<ProductListItemDto>`).
 * Compact projection: the edit form loads the full {@link ProductDto} via
 * `GET /v1/admin/products/{uuid}` — never reuse the row.
 */
export interface ProductListItemDto {
  uuid: string
  code?: string | null
  name: string
  productType: ProductType | string
  productType_Display?: string | null
  productCategory_Uuid?: string | null
  productCategory_Display?: string | null
  /** Null for a general product. */
  ownerAlly_Uuid?: string | null
  ownerAlly_Display?: string | null
  exclusive: boolean
  exclusive_Display?: string | null
  requiresAppointment: boolean
  requiresAppointment_Display?: string | null
  /** Public catalog image URL — only set once the image is published. */
  imageUrl?: string | null
  active: boolean
  active_Display?: string | null
  status?: string | null
  status_Display?: string | null
  createdAt?: string | null
  createdAt_Display?: string | null
}

/** Full product (`GET /v1/admin/products/{uuid}`). */
export interface ProductDto extends ProductListItemDto {
  description?: string | null
  updatedAt?: string | null
  updatedAt_Display?: string | null
}

export interface ProductCreateRequest {
  /** Optional — the backend derives one when omitted. */
  code?: string
  name: string
  description?: string
  productType: ProductType
  productCategoryUuid: string
  /** Set → exclusive to that ally; omitted → general. */
  ownerAllyUuid?: string
  requiresAppointment?: boolean
}

/** PUT with PATCH semantics: only the fields sent change. */
export interface ProductUpdateRequest {
  code?: string
  name?: string
  description?: string
  productType?: ProductType
  productCategoryUuid?: string
  /** Makes the product exclusive to this ally. */
  ownerAllyUuid?: string
  /** `true` turns an exclusive product back into a general one. */
  general?: boolean
  requiresAppointment?: boolean
  active?: boolean
}

/**
 * Row of the public cross-ally catalog `GET /v1/public/products` (backend
 * `PublicProductListItemDto`): one publicly visible OFFER (approved + published)
 * with its product and parent-ally slice. Only the fields read here are typed.
 */
export interface PublicProductListItemDto {
  /** Offer uuid. */
  uuid: string
  productUuid: string
  productType?: ProductType | string | null
  categoryName?: string | null
  name: string
  allyUuid?: string | null
  allyName?: string | null
}
