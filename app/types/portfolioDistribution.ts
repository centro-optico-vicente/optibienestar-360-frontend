// Portfolio distribution (backend `AdminMemberPromoterController`, MEMBER_ASSIGN_PROMOTER):
// move members from "no advisor" (null or the INSTITUCION system advisor) or from one advisor
// (even an inactive one) to one or several advisors, in equal parts or by count.
//
// - GET  /v1/admin/members/advisor/candidates          → Page<DistributionCandidateDto>
// - POST /v1/admin/members/advisor/distribute/preview  → DistributionResultDto (nothing is written)
// - POST /v1/admin/members/advisor/distribute          → DistributionResultDto (all or nothing)

/** Where the members come from: nobody (null or system advisor) or one advisor. */
export type DistributionSource = 'UNASSIGNED' | 'ADVISOR'

/** `EQUAL` = round-robin among the targets; `COUNT` = exact count per target (sum ≤ selected). */
export type DistributionMode = 'EQUAL' | 'COUNT'

/** Backend limits of one distribution, mirrored only to warn before sending. */
export const DISTRIBUTION_MAX_MEMBERS = 2000
export const DISTRIBUTION_MAX_TARGETS = 20

/** One row of the candidates table. */
export interface DistributionCandidateDto {
  uuid: string
  displayName: string
  document: string | null
  plan_Uuid: string | null
  plan_Display: string | null
  status: string | null
  promoter_Uuid: string | null
  promoter_Display: string | null
  createdAt: string | null
}

/** Same filter as the candidates list: "select all N results" sends it instead of the uuids. */
export interface DistributionFilter {
  source: DistributionSource
  /** Only with `source = ADVISOR`; inactive and system advisors are accepted. */
  sourcePromoterUuid?: string
  q?: string
  planUuid?: string
  status?: string
}

export interface DistributionCandidatesParams extends DistributionFilter {
  page?: number
  size?: number
  sort?: string[]
}

export interface DistributionTarget {
  promoterUuid: string
  /** Required (≥ 1) with `mode = COUNT`, omitted with `EQUAL`. */
  count?: number
}

/** Exactly one of `memberUuids` / `filter` (filter = every result minus `excludeMemberUuids`). */
export interface DistributeRequest {
  memberUuids?: string[]
  filter?: DistributionFilter
  excludeMemberUuids?: string[]
  targets: DistributionTarget[]
  mode: DistributionMode
  reason: string
}

export interface DistributionResultDto {
  /** Members that move. */
  total: number
  /** Members left as they were (already with that target). */
  skipped: number
  targets: { promoterUuid: string, promoterDisplay: string, count: number }[]
}
