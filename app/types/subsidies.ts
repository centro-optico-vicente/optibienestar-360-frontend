// Types for subsidies & exonerations (backend V41/V78: AdminSubsidyController `/v1/admin/subsidies`
// and MySubsidiesController `/v1/me/subsidies`), aligned with SubsidyDto / SubsidyBeneficiaryDto /
// SubsidyCreateRequest / SubsidyUpdateRequest / SubsidyAuditLogDto.
//
// Coverage is two independent percentages (`null` = that fee is not covered, 100 = full exoneration,
// 0 < X < 100 = partial). The backend computes solvency from them; the UI only shows and edits them.
// Money-like BigDecimals may serialize as number or string, so they are typed `number | string`.
// DisplayRefs arrive flattened as `<name>_Uuid` + `<name>_Display` (hub ADR 0014).

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
}

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
