// Types for the Bonus Rules vertical (/v1/admin/bonus-rules), aligned with the
// backend (V37, CommissionBonusRule / BonusRuleDto / BonusRuleRequest).
//
// A BonusRule rewards a promoter for crossing a subscriber-count goal within a
// window (ADR 0013 §2) — additive to the per-payment commissions. PUT is a full
// replace (BonusRuleRequest is used for both create and update).

export type BonusMetric = 'NEW_SUBSCRIBERS' | 'ACTIVE_SUBSCRIBERS'
export type AccrualMode = 'PER_BLOCK' | 'THRESHOLD'
export type WindowStrategy = 'LIFETIME' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CAMPAIGN'
export type RewardType = 'FLAT' | 'PERCENTAGE'

export const BONUS_METRIC_OPTIONS: { label: string, value: BonusMetric, labelKey: string }[] = [
  { label: 'Nuevos suscriptores', value: 'NEW_SUBSCRIBERS', labelKey: 'commissionRules.bonusMetrics.NEW_SUBSCRIBERS' },
  { label: 'Suscriptores activos', value: 'ACTIVE_SUBSCRIBERS', labelKey: 'commissionRules.bonusMetrics.ACTIVE_SUBSCRIBERS' },
]

export const ACCRUAL_MODE_OPTIONS: { label: string, value: AccrualMode, labelKey: string }[] = [
  { label: 'Por bloque (repite)', value: 'PER_BLOCK', labelKey: 'commissionRules.accrualModes.PER_BLOCK' },
  { label: 'Umbral (una vez)', value: 'THRESHOLD', labelKey: 'commissionRules.accrualModes.THRESHOLD' },
]

export const WINDOW_STRATEGY_OPTIONS: { label: string, value: WindowStrategy, labelKey: string }[] = [
  { label: 'De por vida', value: 'LIFETIME', labelKey: 'commissionRules.windowStrategies.LIFETIME' },
  { label: 'Diario', value: 'DAILY', labelKey: 'commissionRules.windowStrategies.DAILY' },
  { label: 'Semanal', value: 'WEEKLY', labelKey: 'commissionRules.windowStrategies.WEEKLY' },
  { label: 'Quincenal', value: 'BIWEEKLY', labelKey: 'commissionRules.windowStrategies.BIWEEKLY' },
  { label: 'Mensual', value: 'MONTHLY', labelKey: 'commissionRules.windowStrategies.MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY', labelKey: 'commissionRules.windowStrategies.QUARTERLY' },
  { label: 'Semestral', value: 'SEMIANNUAL', labelKey: 'commissionRules.windowStrategies.SEMIANNUAL' },
  { label: 'Anual', value: 'ANNUAL', labelKey: 'commissionRules.windowStrategies.ANNUAL' },
  { label: 'Campaña (rango fijo)', value: 'CAMPAIGN', labelKey: 'commissionRules.windowStrategies.CAMPAIGN' },
]

export const REWARD_TYPE_OPTIONS: { label: string, value: RewardType, labelKey: string }[] = [
  { label: 'Monto fijo', value: 'FLAT', labelKey: 'commissionRules.rewardTypes.FLAT' },
  { label: 'Porcentaje', value: 'PERCENTAGE', labelKey: 'commissionRules.rewardTypes.PERCENTAGE' },
]

export interface BonusRuleDto {
  uuid: string
  name: string
  description?: string | null
  metric: BonusMetric
  accrual: AccrualMode
  thresholdCount: number
  windowStrategy: WindowStrategy
  campaignStart?: string | null
  campaignEnd?: string | null
  rewardType: RewardType
  flatAmount?: number | string | null
  rewardPct?: number | string | null
  rewardCurrency: string
  includeSystemPromoters: boolean
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  promoterType_Code?: string | null
  /** ASSUMPTION: optional link to a commission campaign (campaign_id FK, distinct from windowStrategy CAMPAIGN) — not yet confirmed by backend. */
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  active: boolean
  createdAt?: string
}

/** Used for both create (POST) and replace (PUT) — the backend does a full replace, not a PATCH. */
export interface BonusRuleRequest {
  name: string
  description?: string
  metric: BonusMetric
  accrual: AccrualMode
  thresholdCount: number
  windowStrategy: WindowStrategy
  campaignStart?: string | null
  campaignEnd?: string | null
  rewardType: RewardType
  flatAmount?: string | null
  rewardPct?: string | null
  rewardCurrency?: string
  includeSystemPromoters?: boolean
  promoterTypeUuid?: string | null
  /** ASSUMPTION: sets the owning campaign when created from the campaign ficha's "Add rule" flow. */
  campaignUuid?: string | null
}
