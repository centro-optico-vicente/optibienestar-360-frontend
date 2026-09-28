// Types for the Competitive Commission Rules vertical
// (/v1/admin/competitive-commission-rules, /competitive-commission-awards,
// /competitive-commission-winners), aligned with the backend (hub plan
// competitive-commission-rules, Fases 1-2c: CompetitiveCommissionRule(Dto|Request),
// CompetitiveCommissionAward(Settlement)?Dto, CompetitiveTieDto,
// CompetitiveManualDecisionDto).
//
// FIRST_TO_REACH ("first one to N wins") or RANKING ("top N by metric") prizes —
// deliberately NOT a CommissionTier/BonusRule/etc. variant (different semantics:
// positions, not bands). PUT is a full replace (Request used for both create/update).

import type { DisplayRefItem } from './options'

export type CompetitiveMetric =
  | 'NEW_SUBSCRIBERS' | 'ACTIVE_SUBSCRIBERS'
  | 'SALES_COUNT' | 'SALES_AMOUNT'
  | 'COLLECTION_COUNT' | 'COLLECTION_AMOUNT'
  | 'ADVANCE_COUNT' | 'ADVANCE_AMOUNT'
  | 'COMMISSION_EARNED'
  | 'OVERDUE_SETTLED_COUNT' | 'OVERDUE_SETTLED_AMOUNT'

export type CompetitionType = 'FIRST_TO_REACH' | 'RANKING'
export type AchievementDateBasis = 'PAYMENT_DATE' | 'REGISTERED_AT' | 'APPROVED_AT'
export type TiePolicy = 'STRICT' | 'SHARED_FULL' | 'SHARED_SPLIT' | 'MANUAL'
export type CompetitiveRewardType = 'FLAT' | 'PERCENTAGE'
export type AwardStatus = 'PROVISIONAL' | 'PENDING' | 'PAID' | 'VOIDED'
export type SettlementCutKind = 'PARTIAL' | 'RETROACTIVE' | 'FINAL'
export type SettlementStatus = 'PENDING' | 'PAID' | 'VOIDED'
export type TieStatus = 'OPEN' | 'RESOLVED' | 'STALE'
export type DecisionKind = 'TIE_RESOLUTION' | 'REDIRECT' | 'DISQUALIFY'
export type DecisionReasonCategory = 'TIE_BREAK' | 'UNSPORTSMANLIKE_CONDUCT' | 'DATA_ERROR' | 'POLICY' | 'OTHER'
export type DecisionStatus = 'ACTIVE' | 'STALE' | 'REVERTED'

/**
 * Every axis on this rule accepts END_DATE ("al final de la fecha") in addition
 * to the 7 legacy periodic values (D8/D14/D15) — unlike CommissionTier et al.,
 * where only the 7 periodic values are legal.
 */
export type CompetitivePeriodAxisStrategy =
  'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'END_DATE'

export const COMPETITIVE_METRIC_OPTIONS: { label: string, value: CompetitiveMetric, labelKey: string }[] = [
  { label: 'Nuevos suscriptores', value: 'NEW_SUBSCRIBERS', labelKey: 'commissionRules.competitiveRules.metrics.NEW_SUBSCRIBERS' },
  { label: 'Suscriptores activos', value: 'ACTIVE_SUBSCRIBERS', labelKey: 'commissionRules.competitiveRules.metrics.ACTIVE_SUBSCRIBERS' },
  { label: 'Cantidad de ventas', value: 'SALES_COUNT', labelKey: 'commissionRules.competitiveRules.metrics.SALES_COUNT' },
  { label: 'Monto de ventas', value: 'SALES_AMOUNT', labelKey: 'commissionRules.competitiveRules.metrics.SALES_AMOUNT' },
  { label: 'Cantidad de cobros', value: 'COLLECTION_COUNT', labelKey: 'commissionRules.competitiveRules.metrics.COLLECTION_COUNT' },
  { label: 'Monto cobrado', value: 'COLLECTION_AMOUNT', labelKey: 'commissionRules.competitiveRules.metrics.COLLECTION_AMOUNT' },
  { label: 'Cantidad de anticipos', value: 'ADVANCE_COUNT', labelKey: 'commissionRules.competitiveRules.metrics.ADVANCE_COUNT' },
  { label: 'Monto de anticipos', value: 'ADVANCE_AMOUNT', labelKey: 'commissionRules.competitiveRules.metrics.ADVANCE_AMOUNT' },
  { label: 'Comisión ganada', value: 'COMMISSION_EARNED', labelKey: 'commissionRules.competitiveRules.metrics.COMMISSION_EARNED' },
  { label: 'Cantidad de vencidas saldadas', value: 'OVERDUE_SETTLED_COUNT', labelKey: 'commissionRules.competitiveRules.metrics.OVERDUE_SETTLED_COUNT' },
  { label: 'Monto de vencidas saldadas', value: 'OVERDUE_SETTLED_AMOUNT', labelKey: 'commissionRules.competitiveRules.metrics.OVERDUE_SETTLED_AMOUNT' },
]

/** Metrics measured by count (`thresholdCount`) vs. by amount (`thresholdAmount`+currency) — mutually exclusive per rule. */
export function isCountMetric(metric: CompetitiveMetric | undefined): boolean {
  return metric === 'NEW_SUBSCRIBERS' || metric === 'ACTIVE_SUBSCRIBERS'
    || metric === 'SALES_COUNT' || metric === 'COLLECTION_COUNT' || metric === 'ADVANCE_COUNT'
    || metric === 'OVERDUE_SETTLED_COUNT'
}

export const COMPETITION_TYPE_OPTIONS: { label: string, value: CompetitionType, labelKey: string }[] = [
  { label: 'Primero en llegar', value: 'FIRST_TO_REACH', labelKey: 'commissionRules.competitiveRules.competitionTypes.FIRST_TO_REACH' },
  { label: 'Ranking por posición', value: 'RANKING', labelKey: 'commissionRules.competitiveRules.competitionTypes.RANKING' },
]

export const ACHIEVEMENT_DATE_BASIS_OPTIONS: { label: string, value: AchievementDateBasis, labelKey: string }[] = [
  { label: 'Fecha del pago', value: 'PAYMENT_DATE', labelKey: 'commissionRules.competitiveRules.dateBases.PAYMENT_DATE' },
  { label: 'Fecha de registro', value: 'REGISTERED_AT', labelKey: 'commissionRules.competitiveRules.dateBases.REGISTERED_AT' },
  { label: 'Fecha de aprobación', value: 'APPROVED_AT', labelKey: 'commissionRules.competitiveRules.dateBases.APPROVED_AT' },
]

export const TIE_POLICY_OPTIONS: { label: string, value: TiePolicy, labelKey: string }[] = [
  { label: 'Estricto (arbitrario, estable)', value: 'STRICT', labelKey: 'commissionRules.competitiveRules.tiePolicies.STRICT' },
  { label: 'Comparten el premio completo', value: 'SHARED_FULL', labelKey: 'commissionRules.competitiveRules.tiePolicies.SHARED_FULL' },
  { label: 'Reparten el premio', value: 'SHARED_SPLIT', labelKey: 'commissionRules.competitiveRules.tiePolicies.SHARED_SPLIT' },
  { label: 'Decisión manual', value: 'MANUAL', labelKey: 'commissionRules.competitiveRules.tiePolicies.MANUAL' },
]

export const COMPETITIVE_REWARD_TYPE_OPTIONS: { label: string, value: CompetitiveRewardType, labelKey: string }[] = [
  { label: 'Monto fijo', value: 'FLAT', labelKey: 'commissionRules.rewardTypes.FLAT' },
  { label: 'Porcentaje', value: 'PERCENTAGE', labelKey: 'commissionRules.rewardTypes.PERCENTAGE' },
]

export const COMPETITIVE_PERIOD_AXIS_OPTIONS: { label: string, value: CompetitivePeriodAxisStrategy, labelKey: string }[] = [
  { label: 'Diario', value: 'DAILY', labelKey: 'commissionRules.windowStrategies.DAILY' },
  { label: 'Semanal', value: 'WEEKLY', labelKey: 'commissionRules.windowStrategies.WEEKLY' },
  { label: 'Quincenal', value: 'BIWEEKLY', labelKey: 'commissionRules.windowStrategies.BIWEEKLY' },
  { label: 'Mensual', value: 'MONTHLY', labelKey: 'commissionRules.windowStrategies.MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY', labelKey: 'commissionRules.windowStrategies.QUARTERLY' },
  { label: 'Semestral', value: 'SEMIANNUAL', labelKey: 'commissionRules.windowStrategies.SEMIANNUAL' },
  { label: 'Anual', value: 'ANNUAL', labelKey: 'commissionRules.windowStrategies.ANNUAL' },
  { label: 'Al final de la fecha', value: 'END_DATE', labelKey: 'commissionRules.competitiveRules.periodAxis.END_DATE' },
]

export interface CompetitiveRulePositionDto {
  uuid: string
  positionFrom: number
  positionTo: number
  label?: string | null
  rewardType: CompetitiveRewardType
  flatAmount?: number | string | null
  rewardPct?: number | string | null
  rewardCurrency_Uuid?: string | null
  rewardCurrency_Display?: string | null
  rewardMinAmount?: number | string | null
  rewardMaxAmount?: number | string | null
  minThresholdCount?: number | null
  minThresholdAmount?: number | string | null
}

export interface CompetitiveRulePositionRequest {
  positionFrom: number
  positionTo: number
  label?: string | null
  rewardType: CompetitiveRewardType
  flatAmount?: string | null
  rewardPct?: string | null
  rewardCurrencyUuid: string
  rewardMinAmount?: string | null
  rewardMaxAmount?: string | null
  minThresholdCount?: number | null
  minThresholdAmount?: string | null
}

export interface CompetitiveRuleDto {
  uuid: string
  name: string
  description?: string | null
  metric: CompetitiveMetric
  competitionType: CompetitionType
  thresholdCount?: number | null
  thresholdAmount?: number | string | null
  thresholdCurrency_Uuid?: string | null
  thresholdCurrency_Display?: string | null
  achievementDateBasis: AchievementDateBasis
  tiePolicy: TiePolicy
  /** "Same type of bonus" grouping (D16) — null = independent rule. */
  competitionGroup?: string | null
  groupPriority?: number | null
  accrualPeriodStrategy: CompetitivePeriodAxisStrategy
  partialSettlementPeriodStrategy: CompetitivePeriodAxisStrategy
  finalSettlementPeriodStrategy: CompetitivePeriodAxisStrategy
  retroactiveSettlementPeriodStrategy: CompetitivePeriodAxisStrategy
  accrualPeriodAnchor?: number | null
  partialSettlementPeriodAnchor?: number | null
  finalSettlementPeriodAnchor?: number | null
  retroactiveSettlementPeriodAnchor?: number | null
  confirmationDelayDays: number
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  startsAt?: string | null
  endsAt?: string | null
  includeSystemPromoters: boolean
  promoterTypes: DisplayRefItem[]
  ranks: DisplayRefItem[]
  positions: CompetitiveRulePositionDto[]
  /** Derived — max(positionTo) across positions (D3, never a stored column). */
  maxWinners: number
  /** True once the rule has a PENDING/PAID award — most fields freeze; offer "Clonar" instead. */
  hasFrozenAwards: boolean
  active: boolean
  createdAt?: string
}

/** Compact list projection — GET / returns this, not CompetitiveRuleDto (list vs. detail convention). */
export interface CompetitiveRuleListItemDto {
  uuid: string
  name: string
  metric: CompetitiveMetric
  competitionType: CompetitionType
  thresholdCount?: number | null
  thresholdAmount?: number | string | null
  thresholdCurrency_Display?: string | null
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  startsAt?: string | null
  endsAt?: string | null
  /** Server-built summary, e.g. "1°: $100 · 2–5: $10". */
  positionsSummary: string
  maxWinners: number
  active: boolean
}

/** Used for both create (POST) and replace (PUT) — the backend does a full replace, not a PATCH. */
export interface CompetitiveRuleRequest {
  name: string
  description?: string | null
  metric: CompetitiveMetric
  competitionType: CompetitionType
  thresholdCount?: number | null
  thresholdAmount?: string | null
  thresholdCurrencyUuid?: string | null
  achievementDateBasis?: AchievementDateBasis | null
  tiePolicy?: TiePolicy | null
  competitionGroup?: string | null
  groupPriority?: number | null
  accrualPeriodStrategy: CompetitivePeriodAxisStrategy
  partialSettlementPeriodStrategy?: CompetitivePeriodAxisStrategy | null
  finalSettlementPeriodStrategy?: CompetitivePeriodAxisStrategy | null
  retroactiveSettlementPeriodStrategy?: CompetitivePeriodAxisStrategy | null
  accrualPeriodAnchor?: number | null
  partialSettlementPeriodAnchor?: number | null
  finalSettlementPeriodAnchor?: number | null
  retroactiveSettlementPeriodAnchor?: number | null
  confirmationDelayDays?: number | null
  campaignUuid?: string | null
  startsAt?: string | null
  endsAt?: string | null
  includeSystemPromoters?: boolean
  promoterTypeUuids?: string[] | null
  rankUuids?: string[] | null
  positions: CompetitiveRulePositionRequest[]
  /** Update only. */
  active?: boolean
}

export interface CompetitiveEvaluationOutcome {
  periodStart: string
  periodEnd: string
  created: number
  updated: number
  displaced: number
  openTie?: { positionFrom: number, slots: number, candidates: unknown[] } | null
  openTieUuid?: string | null
}

// ─── Awards ──────────────────────────────────────────────────────────────────

export interface CompetitiveAwardDto {
  uuid: string
  rule_Uuid?: string | null
  rule_Display?: string | null
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  periodStart: string
  periodEnd: string
  awardPosition: number
  tieGroupSize: number
  metricValue: number | string
  metricTransactionCount: number
  achievedAt?: string | null
  rewardType: CompetitiveRewardType
  amount: number | string
  currency_Uuid?: string | null
  currency_Display?: string | null
  paidAt?: string | null
  payoutReference?: string | null
  voidReason?: string | null
  adminNotes?: string | null
  selectionSource: 'AUTO' | 'MANUAL'
  status: AwardStatus
}

export interface CompetitiveAwardSettlementDto {
  uuid: string
  cutKind: SettlementCutKind
  cutSequence: number
  cutStart: string
  cutEnd: string
  awardPositionAtCut?: number | null
  entitlementCumulative: number | string
  alreadyPaidAmount: number | string
  amount: number | string
  currency_Uuid?: string | null
  currency_Display?: string | null
  paidAt?: string | null
  payoutReference?: string | null
  voidReason?: string | null
  status: SettlementStatus
}

export interface CompetitiveAwardPayRequest {
  payoutReference: string
  payoutPaymentUuid?: string | null
}

export interface CompetitiveAwardVoidRequest {
  reason: string
}

// ─── D16: ties & manual decisions (winners board) ──────────────────────────

export interface CompetitiveTieCandidateDto {
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  metricValue: number | string
  achievedAt?: string | null
  metricTransactionCount: number
  selected: boolean
}

export interface CompetitiveTieDto {
  uuid: string
  rule_Uuid?: string | null
  rule_Display?: string | null
  periodStart: string
  periodEnd: string
  positionFrom: number
  slots: number
  status: TieStatus
  reason?: string | null
  resolvedAt?: string | null
  candidates: CompetitiveTieCandidateDto[]
}

export interface CompetitiveManualDecisionDto {
  uuid: string
  kind: DecisionKind
  awardPosition?: number | null
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  replacedPromoter_Uuid?: string | null
  replacedPromoter_Display?: string | null
  excludeFromGroup: boolean
  reasonCategory: DecisionReasonCategory
  reason: string
  decidedAt: string
  revertedAt?: string | null
  revertReason?: string | null
  status: DecisionStatus
}

export interface CompetitiveTieResolveRequest {
  winnerPromoterUuids: string[]
  reason: string
}

export interface CompetitiveManualDecisionRequest {
  kind: DecisionKind
  awardPosition?: number | null
  promoterUuid: string
  replacementPromoterUuid?: string | null
  excludeFromGroup?: boolean
  reasonCategory?: DecisionReasonCategory | null
  reason: string
}

export interface CompetitiveDecisionRevertRequest {
  reason: string
}

export const DECISION_REASON_CATEGORY_OPTIONS: { label: string, value: DecisionReasonCategory, labelKey: string }[] = [
  { label: 'Empate', value: 'TIE_BREAK', labelKey: 'competitiveWinners.reasonCategories.TIE_BREAK' },
  { label: 'Conducta antideportiva', value: 'UNSPORTSMANLIKE_CONDUCT', labelKey: 'competitiveWinners.reasonCategories.UNSPORTSMANLIKE_CONDUCT' },
  { label: 'Error de datos', value: 'DATA_ERROR', labelKey: 'competitiveWinners.reasonCategories.DATA_ERROR' },
  { label: 'Política', value: 'POLICY', labelKey: 'competitiveWinners.reasonCategories.POLICY' },
  { label: 'Otro', value: 'OTHER', labelKey: 'competitiveWinners.reasonCategories.OTHER' },
]
