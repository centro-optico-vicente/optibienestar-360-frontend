// Types for subsidies & exonerations (backend V41/V78: AdminSubsidyController `/v1/admin/subsidies`
// and MySubsidiesController `/v1/me/subsidies`), aligned with SubsidyDto / SubsidyBeneficiaryDto /
// SubsidyCreateRequest / SubsidyUpdateRequest / SubsidyAuditLogDto.
//
// Coverage is two independent percentages (`null` = that fee is not covered, 100 = full exoneration,
// 0 < X < 100 = partial). The backend computes solvency from them; the UI only shows and edits them.
// Money-like BigDecimals may serialize as number or string, so they are typed `number | string`.
// DisplayRefs arrive flattened as `<name>_Uuid` + `<name>_Display` (hub ADR 0014).

/**
 * Who created the subsidy (hub ADR 0041 §2): `MANUAL` (a person) or `REFERRAL_REWARD` (created by the
 * referral reward of a promotion). The organization's subsidy mode only governs `MANUAL` ones.
 */
export type SubsidyOrigin = 'MANUAL' | 'REFERRAL_REWARD'

/** Per-beneficiary exoneration line of a subsidy. */
export interface SubsidyBeneficiaryDto {
  uuid: string
  beneficiaryUuid: string | null
  beneficiaryName: string | null
  monthlyPercentage: number | string | null
  monthlyPercentage_Display?: string | null
  inscriptionPercentage: number | string | null
  inscriptionPercentage_Display?: string | null
}

export interface SubsidyDto {
  uuid: string
  /** The member (titular) the subsidy applies to. */
  member_Uuid?: string | null
  member_Display?: string | null
  monthlyPercentage: number | string | null
  monthlyPercentage_Display?: string | null
  inscriptionPercentage: number | string | null
  inscriptionPercentage_Display?: string | null
  maxExoneratedBeneficiaries: number | null
  reason: string | null
  authorizedByUuid: string | null
  /** `yyyy-MM-dd`. */
  validFrom: string
  validFrom_Display?: string | null
  /** `yyyy-MM-dd`; `null` = indefinite. */
  validUntil: string | null
  validUntil_Display?: string | null
  active: boolean
  active_Display?: string | null
  status?: string | null
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  updatedAt?: string | null
  updatedAt_Display?: string | null
  beneficiaries: SubsidyBeneficiaryDto[]
  /** Optional until the backend of hub ADR 0041 ships; absent = `MANUAL`. */
  origin?: SubsidyOrigin | null
  origin_Display?: string | null
}

export interface SubsidyBeneficiaryRequest {
  beneficiaryUuid: string
  monthlyPercentage?: number | null
  inscriptionPercentage?: number | null
}

/** `POST /v1/admin/subsidies` — at least one percentage must be present (`subsidy.coverage.required`). */
export interface SubsidyCreateRequest {
  memberUuid: string
  monthlyPercentage?: number | null
  inscriptionPercentage?: number | null
  maxExoneratedBeneficiaries?: number | null
  reason: string
  validFrom: string
  validUntil?: string | null
  beneficiaries?: SubsidyBeneficiaryRequest[]
  /** Explicit confirmation to go over the caller's discount cap (needs `SUBSIDY_EXCEED_DISCOUNT_CAP`, hub ADR 0041 §5). */
  acknowledgeCapExceeded?: boolean
}

/**
 * `PUT /v1/admin/subsidies/{uuid}` — PATCH-style: `null`/absent = leave unchanged. The percentages can be
 * adjusted but not cleared here (revoke + re-create for that); `beneficiaries` absent keeps the current list.
 */
export interface SubsidyUpdateRequest {
  monthlyPercentage?: number | null
  inscriptionPercentage?: number | null
  maxExoneratedBeneficiaries?: number | null
  reason?: string | null
  validFrom?: string | null
  validUntil?: string | null
  active?: boolean | null
  beneficiaries?: SubsidyBeneficiaryRequest[] | null
  /** Explicit confirmation to go over the caller's discount cap (needs `SUBSIDY_EXCEED_DISCOUNT_CAP`, hub ADR 0041 §5). */
  acknowledgeCapExceeded?: boolean
}

/**
 * `GET /v1/admin/subsidies/settings` (hub ADR 0041 §6): the organization's subsidy mode resolved for the
 * screen plus the current user's discount cap. `mode` takes the same values as `OrganizationDto.subsidyMode`.
 */
export interface SubsidySettingsDto {
  mode: 'DISABLED' | 'MONTHLY' | 'INSCRIPTION' | 'MONTHLY_AND_INSCRIPTION'
  monthlyEnabled: boolean
  inscriptionEnabled: boolean
  /** Current user's cap in % (0–100); `null` = no cap (administrative staff). */
  discountCapPct: number | string | null
  /** Whether the current user holds `SUBSIDY_EXCEED_DISCOUNT_CAP` (may go over the cap after confirming). */
  canExceedCap: boolean
}

/** 422 `code`s of the subsidy write endpoints (hub ADR 0041 §6), mapped to i18n messages by the screen. */
export const SUBSIDY_ERROR_CODES = {
  disabledForOrganization: 'subsidy.disabled_for_organization',
  feeTypeDisabled: 'subsidy.fee_type_disabled',
  exceedsDiscountCap: 'subsidy.exceeds_discount_cap',
  exceedsDiscountCapAckRequired: 'subsidy.exceeds_discount_cap_ack_required',
} as const

export const SUBSIDY_AUDIT_ACTIONS = ['CREATED', 'MODIFIED', 'REVOKED'] as const
export type SubsidyAuditAction = typeof SUBSIDY_AUDIT_ACTIONS[number]

/** One immutable line of `GET /v1/admin/subsidies/{uuid}/log`, newest first. */
export interface SubsidyAuditLogDto {
  uuid: string
  action: SubsidyAuditAction
  action_Display?: string | null
  actorUuid: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  at: string
  at_Display?: string | null
}

/** Percentage as shown in the UI (`100 %`), preferring the backend's localized `_Display`; `null` when not covered. */
export function subsidyPercentLabel(value: number | string | null | undefined, display?: string | null): string | null {
  if (value === null || value === undefined || value === '') return null
  return `${display ?? value} %`
}
