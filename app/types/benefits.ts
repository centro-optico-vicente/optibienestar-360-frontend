// Types for benefit usage (/v1/ally/benefit-usage + /v1/ally/usage-history),
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

/** Response of POST /v1/ally/benefit-usage and items of GET /v1/ally/usage-history. */
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

  // Where + what
  allyUuid: string
  allyName?: string | null
  allyServiceUuid?: string | null
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

  // Detail
  metadata?: Record<string, unknown> | null
  notes?: string | null

  // Audit
  status?: string | null
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/**
 * Body of POST /v1/ally/benefit-usage.
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
  allyServiceUuid?: string
  /** ISO date (yyyy-MM-dd). Defaults to today in the backend; never in the future. */
  usageDate?: string
  copayAmount?: string
  /** ISO 4217 (3 uppercase letters). */
  copayCurrency?: string
  metadata?: Record<string, unknown>
  notes?: string
}
