// Types for the Partners vertical (/v1/admin/allies, /v1/public/allies, /v1/allies/me),
// aligned with the backend integration guide (V11–V12, PRs #57–#67).
//
// The admin list is paged (Page<AllyListItemDto>, compact) with RSQL + `q`; the
// detail (AllyDto, backend AllyDetailDto) includes professions[] and allyTypes[]
// (both M:N) but does NOT inline its offers. Sub-resources: products (offers of
// the products catalog, hub ADR 0026 — paged), agreements
// (ALLY_AGREEMENT_VIEW_ALL/CREATE/UPDATE/DELETE) and users (staff with
// OWNER/STAFF/VIEWER membership, ALLY_USER_VIEW_ALL/CREATE/UPDATE/DELETE).
// PUT uses PATCH semantics.

import type { CatalogRef, CityRef } from '~/types/members'
import type { ProductType } from '~/types/products'
import type { PublicImageDto } from '~/types/media'

// ---- Partner ----

export interface AllyDto {
  uuid: string
  name: string
  allyTypes?: CatalogRef[]
  /** Sequential "Nº de Aliado", assigned by the backend (V179) — read-only. */
  allyNumber?: number | null
  /**
   * Agreement file number "[CÓDIGO DE ASESOR]-[Nº DE ALIADO]" (e.g. `ABC123-0007`);
   * just the zero-padded number (`0007`) when no promoter captured the ally. Read-only.
   */
  fileNumber?: string | null
  /** Promoter (advisor) who captured the ally — ADR 0014 FK pair. */
  capturedByPromoter_Uuid?: string | null
  capturedByPromoter_Display?: string | null
  /** Legal representative / physician who signs the agreement. */
  representativeName?: string | null
  representativeDocumentType?: string | null
  representativeDocumentNumber?: string | null
  taxDocumentType?: string
  taxDocumentNumber?: string
  email?: string
  phone?: string
  website?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  city?: CityRef
  googleMapsUrl?: string
  /** Promotion code the ally hands out (hub ADR 0018); attribution only. */
  referralCode?: string | null
  description?: string
  joinedAt?: string
  published?: boolean
  publishedAt?: string | null
  status?: string
  /** Soft-delete/reactivation flag — distinct from `status` (a business workflow value). */
  active?: boolean
  professions?: CatalogRef[]
  /** Active offers (products and services) of the ally. */
  activeProductsCount?: number | null
  createdAt?: string
}

/**
 * Row of the admin list `GET /v1/admin/allies` (`Page<AllyListItemDto>`).
 *
 * Pilot for the `_Display` convention (hub ADR 0014): every foreign key
 * travels as the pair `<rel>_Uuid` + `<rel>_Display`, and every
 * presentational scalar as the raw, typed value + a server-resolved,
 * locale-aware `<field>_Display` sibling. Render the `_Display` string
 * directly (`row.city_Display ?? t('common.empty')`); keep the raw value
 * for sorting and logic. `_Display` fields are read-only — never sent back.
 * `allyType` is M:N, so it breaks from the pilot's single-FK pattern: it
 * travels as a plain, backend-formatted `allyTypeNames: string[]` instead.
 *
 * Compact projection: omits email, tax ID, website, professions… The edit
 * form loads the full {@link AllyDto} via `GET /v1/admin/allies/{uuid}`.
 */
export interface AllyListItemDto {
  uuid: string
  name: string
  /** Sequential "Nº de Aliado" (V179). */
  allyNumber?: number | null

  /** Backend-formatted names of every ally type this partner belongs to (M:N). */
  allyTypeNames?: string[]
  city_Uuid: string | null
  city_Display: string | null

  taxDocumentType?: string | null
  taxDocumentNumber?: string | null

  logoUrl?: string | null
  phone?: string | null

  published: boolean
  published_Display: string | null
  publishedAt?: string | null
  publishedAt_Display: string | null

  active: boolean
  active_Display: string | null
  status?: string | null
  status_Display: string | null

  createdAt?: string | null
  createdAt_Display: string | null
}

export interface CreateAllyRequest {
  name: string
  allyTypeUuids: string[]
  taxDocumentType?: string
  taxDocumentNumber?: string
  email?: string
  phone?: string
  website?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  cityUuid?: string
  googleMapsUrl?: string
  referralCode?: string
  description?: string
  joinedAt?: string
  published?: boolean
  professionUuids?: string[]
  /** Promoter (advisor) who captured the ally. `allyNumber` is never sent — the backend assigns it. */
  capturedByPromoterUuid?: string
  representativeName?: string
  representativeDocumentType?: string
  representativeDocumentNumber?: string
}

/** PUT with PATCH semantics; `professionUuids`/`allyTypeUuids` REPLACE the set when sent. */
export interface UpdateAllyRequest extends Partial<CreateAllyRequest> {
  status?: string
  active?: boolean
}

// ---- Partner products and services (offers — hub ADR 0026) ----


/** Offer review workflow; offers proposed by the ally (or created by admin) are born PROPOSED. */
export type ProductReviewStatus = 'PROPOSED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REMOVED'

/** Product category as nested in an offer (backend `ProductCategoryDto`). */
export interface ProductCategoryRef {
  uuid: string
  code?: string | null
  name: string
  description?: string | null
  active?: boolean
}

/**
 * An ally's offer of a product (backend `AllyProductDto`): the product's own
 * fields (type, category, name, description, appointment, image) flattened
 * next to the offer terms (price, discount, final price, exclusions) and the
 * review/publication state. `exclusive` → the product belongs to this ally,
 * so its item fields are editable from the offer; otherwise only the offer
 * terms are. Scalars carry a localized `_Display` sibling (hub ADR 0014).
 */
export interface AllyProductDto {
  uuid: string
  allyUuid?: string
  /** The offering ally — ADR 0014 FK pair; cross-ally lists show its name. */
  ally_Uuid?: string | null
  ally_Display?: string | null
  productUuid: string
  productType: ProductType | string
  productType_Display?: string | null
  exclusive: boolean
  exclusive_Display?: string | null
  productCategory?: ProductCategoryRef | null
  name: string
  description?: string | null
  requiresAppointment?: boolean
  requiresAppointment_Display?: string | null
  imageUrl?: string | null

  priceAmount?: number | string | null
  priceAmount_Display?: string | null
  discountPct?: number | string | null
  discountPct_Display?: string | null
  /** FLAT (amount in the price currency) or PERCENTAGE (V210, hub ADR 0031 §8). */
  discountType?: DiscountType | string | null
  discountType_Display?: string | null
  /** Amount off in the price currency; only for FLAT. */
  discountAmount?: number | string | null
  discountAmount_Display?: string | null
  /** The discount as a percentage whatever its type (display only). */
  effectiveDiscountPct?: number | string | null
  effectiveDiscountPct_Display?: string | null
  finalPrice?: number | string | null
  finalPrice_Display?: string | null
  /** Where the preferential rate does not apply (V179), free text. */
  exclusions?: string | null

  reviewStatus?: ProductReviewStatus | string
  reviewStatus_Display?: string | null
  reviewedByUuid?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
  reviewReason?: string | null

  published?: boolean
  published_Display?: string | null
  publishedAt?: string | null
  publishedAt_Display?: string | null

  active?: boolean
  active_Display?: string | null
  status?: string
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/**
 * Body of `POST /v1/admin/allies/{allyUuid}/products`. Either `productUuid`
 * (offer an existing general product, or one exclusive to this ally) or —
 * when it is omitted — the item fields, which create a new product exclusive
 * to the ally. Decimals travel as strings to avoid precision loss.
 */
export interface AllyProductCreateRequest {
  productUuid?: string
  productCategoryUuid?: string
  productType?: ProductType
  name?: string
  description?: string
  requiresAppointment?: boolean
  priceAmount?: string
  discountPct?: string
  /** Omitted = PERCENTAGE. FLAT takes `discountAmount` instead of `discountPct`. */
  discountType?: DiscountType
  discountAmount?: string
  /** Free text; an empty string clears it on update. */
  exclusions?: string
}

/**
 * PUT with PATCH semantics. The item fields (category, type, name, description,
 * requiresAppointment) are only accepted when the product is exclusive to this
 * ally — the backend answers 422 otherwise. `reviewStatus` never changes this way.
 */
export interface AllyProductUpdateRequest {
  productCategoryUuid?: string
  productType?: ProductType
  name?: string
  description?: string
  requiresAppointment?: boolean
  priceAmount?: string
  discountPct?: string
  /** Omitted = PERCENTAGE. FLAT takes `discountAmount` instead of `discountPct`. */
  discountType?: DiscountType
  discountAmount?: string
  exclusions?: string
  published?: boolean
  active?: boolean
}

/** Body of `POST /v1/me/allies/products` (proposal made by the partner itself). */
export interface ProposeAllyProductRequest extends AllyProductCreateRequest {
  allyUuid: string
}

/** One transition of an offer's review workflow (`GET .../{uuid}/log`). */
export interface AllyProductReviewLogDto {
  fromStatus?: ProductReviewStatus | string | null
  fromStatus_Display?: string | null
  toStatus: ProductReviewStatus | string
  toStatus_Display?: string | null
  actorUuid?: string | null
  actionAt: string
  actionAt_Display?: string | null
  comment?: string | null
}

// ---- Agreements ----
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.

export type AgreementType = 'COMMERCIAL' | 'MEDICAL' | 'EXCLUSIVITY' | 'SUPPLY'

export const AGREEMENT_TYPE_OPTIONS: { label: string, value: AgreementType, labelKey: string }[] = [
  { label: 'Comercial', value: 'COMMERCIAL', labelKey: 'allies.agreements.types.COMMERCIAL' },
  { label: 'Médico', value: 'MEDICAL', labelKey: 'allies.agreements.types.MEDICAL' },
  { label: 'Exclusividad', value: 'EXCLUSIVITY', labelKey: 'allies.agreements.types.EXCLUSIVITY' },
  { label: 'Suministro', value: 'SUPPLY', labelKey: 'allies.agreements.types.SUPPLY' },
]

/** Scalars carry a localized `_Display` sibling (hub ADR 0014) — render it directly. */
export interface AllyAgreementDto {
  uuid: string
  agreementType: AgreementType | string
  agreementType_Display?: string | null
  startDate?: string
  startDate_Display?: string | null
  endDate?: string
  endDate_Display?: string | null
  terms?: string
  signedPdfUrl?: string
  /** Standard ALIADO terms version ("Convenio de Alianza Estratégica") — ADR 0014 FK pair. */
  termsVersion_Uuid?: string | null
  termsVersion_Display?: string | null
  /** Renews automatically at the end of its validity (default true). */
  autoRenew?: boolean
  autoRenew_Display?: string | null
  /** Days of notice required to rescind (default 30). */
  noticeDays?: number
  noticeDays_Display?: string | null
  active?: boolean
  active_Display?: string | null
  status?: string
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
}

export interface CreateAllyAgreementRequest {
  agreementType: AgreementType
  startDate?: string
  endDate?: string
  terms?: string
  signedPdfUrl?: string
  /** Must be an ALIADO terms version (422 otherwise). */
  termsVersionUuid?: string
  autoRenew?: boolean
  noticeDays?: number
}

export interface UpdateAllyAgreementRequest extends Partial<CreateAllyAgreementRequest> {
  status?: string
}

// ---- Partner staff ----
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.

export type AllyRole = 'OWNER' | 'STAFF' | 'VIEWER'

export const ALLY_ROLE_OPTIONS: { label: string, value: AllyRole, labelKey: string }[] = [
  { label: 'Propietario', value: 'OWNER', labelKey: 'allies.staff.roles.OWNER' },
  { label: 'Personal', value: 'STAFF', labelKey: 'allies.staff.roles.STAFF' },
  { label: 'Visor', value: 'VIEWER', labelKey: 'allies.staff.roles.VIEWER' },
]

/**
 * A staff membership under /v1/admin/allies/{allyUuid}/users.
 *
 * The backend flattens User + Person into `userUuid` / `userEmail` /
 * `userFullName` (see AllyUserDto + AllyMapper.toAllyUserDto) so the table
 * renders without round-trips. It does NOT send a nested `user` object.
 *
 * `uuid` is the membership row's, not the user's — `AssignAllyUserRequest.userUuid`
 * and the edit form both want `userUuid`.
 */
export interface AllyUserDto {
  uuid: string
  allyUuid?: string

  // User + Person, flattened by the backend mapper for display.
  userUuid: string
  userEmail?: string
  userFullName?: string

  allyRole: AllyRole | string
  primary?: boolean
  joinedAt?: string

  active?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface AssignAllyUserRequest {
  userUuid: string
  allyRole: AllyRole
  /** Only valid with allyRole=OWNER and if there's no other active primary OWNER. */
  primary?: boolean
  joinedAt?: string
}

export interface UpdateAllyUserRequest {
  allyRole?: AllyRole
  primary?: boolean
  joinedAt?: string
  status?: string
}

// ---- Partner self-service ----

/**
 * Response item of GET /v1/me/allies — "which allies do I operate on?".
 *
 * `uuid` is the ALLY's uuid (not the staff-membership pivot's): it is what
 * POST /v1/allies/me/benefit-usages and POST /v1/me/allies/products expect as
 * `allyUuid`, and reading it straight off this record is the whole point of
 * the endpoint. `allyRole` is the caller's authority inside this ally, so the
 * portal can hide write actions from a VIEWER instead of letting them 403 at
 * the counter. `joinedAt` is when the CALLER joined the ally.
 *
 * The backend returns primary membership first, then alphabetical — the portal
 * preselects the head of the list, so the order is contract, not cosmetic.
 */
export interface MyAllyDto {
  uuid: string
  name: string
  allyTypeNames?: string[]
  logoUrl?: string | null
  phone?: string | null
  allyRole: AllyRole | string
  primary: boolean
  joinedAt?: string | null
}

/** Roles allowed to write at the counter (validate + register usage). VIEWER is read-only. */
/** How an offer's preferential rate is expressed (backend `AllyProduct.DiscountType`, V210). */
export type DiscountType = 'FLAT' | 'PERCENTAGE'

export function canOperateAtCounter(role?: AllyRole | string | null): boolean {
  return role === 'OWNER' || role === 'STAFF'
}

/**
 * Response item of GET /v1/admin/users/{userUuid}/allies — the inverse of
 * `AllyUserDto`: "which allies does this user belong to?", from the user's side.
 * Gated by ALLY_VIEW_ALL. Always 200, `[]` if the user has no ally memberships.
 */
export interface UserAllyDto {
  allyUuid: string
  allyName: string
  allyRole: AllyRole | string
  primary?: boolean
  joinedAt?: string
  active?: boolean
}

// ---- Public directory ----

/**
 * Card of the public directory (GET /v1/public/allies — backend
 * `PublicAllyListItemDto`). Only PUBLISHED + ACTIVE partners; labels travel as
 * plain strings, there are no nested catalog refs and no email.
 */
export interface PublicAllyListItemDto {
  uuid: string
  name: string
  allyTypeNames?: string[]
  /** Distinct segments (`B2B` / `B2P`) of the partner's active types (V179). */
  allySegments?: string[]
  cityName?: string | null
  logoUrl?: string | null
  description?: string | null
  website?: string | null
  phone?: string | null
  whatsapp?: string | null
  instagram?: string | null
  facebook?: string | null
  googleMapsUrl?: string | null
}

/**
 * @deprecated Legacy shape of `PublicAllyDetailDto.services`, kept while the
 * public pages move to {@link PublicAllyProductDto} (`products`).
 */
export interface PublicAllyServiceDto {
  uuid: string
  categoryName?: string | null
  name: string
  description?: string | null
  priceAmount?: number | string | null
  discountPct?: number | string | null
  /** Where the preferential rate does NOT apply (V179). */
  exclusions?: string | null
  requiresAppointment?: boolean
}

/** Approved, published offer of a public partner (backend `PublicAllyProductDto`). */
export interface PublicAllyProductDto {
  /** The offer's uuid (what `BenefitUsageRegisterRequest.allyProductUuid` expects). */
  uuid: string
  productUuid?: string | null
  productType?: ProductType | string | null
  productType_Display?: string | null
  categoryName?: string | null
  name: string
  description?: string | null
  priceAmount?: number | string | null
  discountPct?: number | string | null
  discountType?: DiscountType | string | null
  discountAmount?: number | string | null
  effectiveDiscountPct?: number | string | null
  finalPrice?: number | string | null
  exclusions?: string | null
  requiresAppointment?: boolean
  imageUrl?: string | null
  /** Ordered gallery of the offer (own images, else the product's); hub ADR 0027. */
  images?: PublicImageDto[]
  /**
   * The product is published in the GENERAL catalog (`/v1/public/products`).
   * Only then does a comparison page `/catalogo/{productUuid}` exist; an
   * unpublished product's offer still shows on its ally's own page.
   */
  inCatalog?: boolean
}

/** Public partner profile (GET /v1/public/allies/{uuid} — backend `PublicAllyDetailDto`). */
export interface PublicAllyDetailDto extends PublicAllyListItemDto {
  address?: string | null
  professionNames?: string[]
  /** Ordered gallery, primary first (hub ADR 0027). */
  images?: PublicImageDto[]
  products?: PublicAllyProductDto[]
  /** @deprecated Use `products` (hub ADR 0026); still sent during the transition. */
  services?: PublicAllyServiceDto[]
}
