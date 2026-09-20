// Types for the commission-campaigns vertical (/v1/admin/campaigns — hub plan
// "commission campaigns"). A Campaign is a time-boxed promotion that can scope
// which promoters/rules it applies to and pre-fill the 4 commission-rule
// screens (bandas de inscripción, bonos por escala, comisión de cobranza,
// comisión jerárquica adicional) with its own start/end dates.
//
// ASSUMPTION (backend in parallel development, not yet confirmed): endpoint
// paths, exact field names and enum values below follow the REST pattern
// already used by useCommissionTiers/useHierarchyOverrideTiers and the field
// names given in the task brief (campaignId, startsAt, endsAt, scope, mode,
// exclusivityGroup, priority, targetAmount, targetCount, evaluateOnlyAtEnd,
// payOnlyAtEnd). Adjust here first if the real contract differs.

/** ALL: applies to every promoter. INCLUDE/EXCLUDE: applies the audience list below. */
export type CampaignScope = 'ALL' | 'INCLUDE' | 'EXCLUDE'

/** TARGETED: audience-limited promotion. GENERAL: open to everyone matching the rule criteria. */
export type CampaignMode = 'TARGETED' | 'GENERAL'

export type CampaignExceptionType = 'INCLUDE' | 'EXCLUDE'

export interface CampaignDto {
  uuid: string
  name: string
  description?: string | null
  startsAt: string
  endsAt: string
  scope: CampaignScope
  mode: CampaignMode
  /** Count of audience rows when scope is INCLUDE/EXCLUDE (list column "Alcance"). */
  audienceCount?: number
  evaluateOnlyAtEnd: boolean
  payOnlyAtEnd: boolean
  targetAmount?: number | string | null
  targetCount?: number | null
  exclusivityGroup?: string | null
  priority?: number | null
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateCampaignRequest {
  name: string
  description?: string | null
  startsAt: string
  endsAt: string
  scope: CampaignScope
  mode: CampaignMode
  evaluateOnlyAtEnd?: boolean
  payOnlyAtEnd?: boolean
  targetAmount?: string | null
  targetCount?: number | null
  exclusivityGroup?: string | null
  priority?: number | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  active?: boolean
}

/** A promoter explicitly included/excluded from a campaign's audience (scope != ALL). */
export interface CampaignAudienceMemberDto {
  uuid: string
  promoter_Uuid: string
  promoter_Display: string
}

/** A manual inclusion/exclusion exception over an already-registered payment/enrollment. */
export interface CampaignExceptionDto {
  uuid: string
  type: CampaignExceptionType
  transaction_Uuid: string
  transaction_Display: string
  reason: string
  createdAt?: string
  createdBy_Display?: string | null
}

export interface CreateCampaignExceptionRequest {
  type: CampaignExceptionType
  transactionUuid: string
  reason: string
}

/** A payment/enrollment transaction linked to the campaign (read-only tab). */
export interface CampaignTransactionDto {
  uuid: string
  transaction_Uuid: string
  transaction_Display: string
  automatic: boolean
  amount?: number | string | null
  registeredAt?: string
}

export interface RelaunchCampaignRequest {
  name: string
  description?: string | null
  startsAt: string
  endsAt: string
}

export const CAMPAIGN_SCOPE_OPTIONS: { value: CampaignScope, labelKey: string }[] = [
  { value: 'ALL', labelKey: 'campaigns.scope.ALL' },
  { value: 'INCLUDE', labelKey: 'campaigns.scope.INCLUDE' },
  { value: 'EXCLUDE', labelKey: 'campaigns.scope.EXCLUDE' },
]

export const CAMPAIGN_MODE_OPTIONS: { value: CampaignMode, labelKey: string }[] = [
  { value: 'TARGETED', labelKey: 'campaigns.mode.TARGETED' },
  { value: 'GENERAL', labelKey: 'campaigns.mode.GENERAL' },
]
