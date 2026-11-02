// Types for benefit usage (/v1/allies/me/benefit-usages + /v1/allies/me/usage-history),
// aligned with the backend (V24__benefit_usages.sql, BenefitUsageDto /
// BenefitUsageRegisterRequest).
//
// Counter flow: validate the document -> the validator returns the membershipUuid
// of an ACTIVE membership -> the operator confirms the consumed service -> POST
// here. The backend re-checks the membership is still ACTIVE, so a stale
// validation (or a race with an admin cancel) is rejected rather than recorded.
//
// Money (BigDecimal) may serialize as number or string depending on the
// ObjectMapper; typed as `number | string` and always formatted through Number().

/** Response of POST /v1/allies/me/benefit-usages and items of GET /v1/allies/me/usage-history. */
export interface BenefitUsageDto {
  uuid: string

  // Subject (flat refs resolved by the mapper)
  membershipUuid: string
  memberUuid?: string | null
  memberFullName?: string | null
  memberDocumentType?: string | null
  memberDocumentNumber?: string | null
  planUuid?: string | null
  planCode?: string | null
  /** Beneficiary who consumed; null = the holder consumed (GET /v1/me/usage-history). */
  beneficiaryUuid?: string | null
  /** Name of whoever consumed: the beneficiary, or the holder. */
  consumedByName?: string | null
  /** Beneficiary's relationship to the holder (`BeneficiaryRelationship`); null for the holder. */
  beneficiaryRelationship?: string | null

  // Where + what
  allyUuid: string
  allyName?: string | null
  /** The offer (ally product) consumed, if catalogued. */
  allyProductUuid?: string | null
  /** Name of the consumed product/service; null when the usage isn't catalogued. */
  allyProductName?: string | null
  allyUserUuid?: string | null

  // When
  usageDate: string
  usageDate_Display?: string | null
  usageDatetime?: string | null
  usageDatetime_Display?: string | null

  // Co-pay — both sides set or both null (mirrors the V24 CHECK). `copayAmount`
  // intentionally has NO `_Display` consumed anywhere — the backend's MONEY
  // formatter is hardcoded to VES, but the frontend's `money()` helper already
  // renders it in the record's own `copayCurrency`.
  copayAmount?: number | string | null
  copayCurrency?: string | null

  // Consumption amount (V171) — same pairing rule as the co-pay.
  consumptionAmount?: number | string | null
  consumptionCurrency?: string | null
  productCategoryUuid?: string | null
  productCategoryName?: string | null

  // Detail
  metadata?: Record<string, unknown> | null
  notes?: string | null

  // Member's rating (PUT /v1/me/usage-history/{uuid}/rating). All null until rated.
  /** 1–5 stars given to the ally. */
  allyRating?: number | null
  /** 1–5 stars given to the product/service; only when `allyProductUuid` is set. */
  productRating?: number | null
  ratingComment?: string | null
  /** ISO instant of the last (re)rating. */
  ratedAt?: string | null
  ratedAt_Display?: string | null

  // Audit
  status?: string | null
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/**
 * Body of POST /v1/allies/me/benefit-usages.
 *
 * `membershipUuid` comes from the validator response, `allyUuid` from
 * GET /v1/me/allies — neither is ever typed by the operator.
 *
 * Co-pay is optional, but if one side is set the other must be too (the backend
 * mirrors the V24 chk_benefit_usages_copay_paired CHECK and answers 422).
 * `copayAmount` travels as a string to avoid precision loss.
 */
export interface BenefitUsageRegisterRequest {
  membershipUuid: string
  allyUuid: string
  /** Optional — non-catalogued usage is allowed. */
  allyProductUuid?: string
  /** Required when no `allyProductUuid` is sent (an offer already carries its category). */
  productCategoryUuid?: string
  /** ISO date (yyyy-MM-dd). Defaults to today in the backend; never in the future. */
  usageDate?: string
  copayAmount?: string
  /** ISO 4217 (3 uppercase letters). */
  copayCurrency?: string
  metadata?: Record<string, unknown>
  notes?: string
  /** Who consumed (V195): one of the membership's beneficiaries; omitted = the holder. */
  beneficiaryUuid?: string
}

/** Only REGISTERED usages can be rated (reversed / disputed ones answer 422). */
export const RATABLE_USAGE_STATUS = 'REGISTERED'

/** Max length of the rating comment (backend validation). */
export const RATING_COMMENT_MAX = 500

/**
 * Body of PUT /v1/me/usage-history/{usageUuid}/rating (MEMBER_RATE_USAGE).
 * Idempotent upsert: calling it again edits the existing rating.
 *
 * `productRating` is only accepted when the usage has an `allyProductUuid`;
 * otherwise omit it (the backend answers 422 `benefit_usage.rating.product_not_applicable`).
 */
export interface BenefitUsageRatingRequest {
  /** 1–5, required. */
  allyRating: number
  /** 1–5, only for catalogued usages. */
  productRating?: number | null
  /** Optional, max 500 chars. */
  comment?: string | null
}

/**
 * One service in the member's consumption summary
 * (GET /v1/me/usage-history/summary), most used first. Uncatalogued usages group
 * by their category, with `productUuid` / `productName` null.
 */
export interface UsageServiceSummaryDto {
  /** Catalog product (not the ally offer); null for uncatalogued usages. */
  productUuid: string | null
  productName: string | null
  productCategoryName: string
  usageCount: number
  lastUsageDate: string
  lastUsageDate_Display?: string | null
}

/**
 * Consumption of one family member (GET /v1/me/usage-history/by-person):
 * the holder (`beneficiaryUuid` null) or a beneficiary. People without usages are absent.
 */
export interface UsagePersonSummaryDto {
  beneficiaryUuid: string | null
  usageCount: number
  lastUsageDate: string
  lastUsageDate_Display?: string | null
}

/**
 * "Who consumed" filter of the member's history/summary. `holder` and
 * `beneficiaryUuid` are mutually exclusive; neither = whole family group.
 */
export interface MyUsageScope {
  holder?: boolean
  beneficiaryUuid?: string
}
