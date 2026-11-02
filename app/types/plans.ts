// Types for the Plans vertical (/v1/admin/plans), aligned with the backend
// (V13__plans.sql / V14__seed_plans.sql, PlanDto / PlanCreateRequest / PlanUpdateRequest).
//
// A Plan is the subscription catalog product: it defines pricing (enrollment,
// monthly fee, extra-beneficiary charge), included/maximum beneficiaries and the
// grace period. Memberships reference a Plan and take a "snapshot" of its pricing
// at enrollment time. The admin list is paged (Page<PlanDto>) with RSQL + `q`.
// PUT uses PATCH semantics (only the fields present are applied).

// ---- Plan type (family) ----
// The backend only models the `type` dimension (Individual [shown as "Único"]/Familiar/Corporativo,
// the flyer taxonomy). The "Premium/1+/2+/3+" axis is a TBD, not yet implemented.
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
// English keys, Spanish values: the value is the backend `type` code (JSON, RSQL `type==FAMILIAR`).
export const PLAN_TYPES = {
  INDIVIDUAL: 'INDIVIDUAL',
  FAMILY: 'FAMILIAR',
  CORPORATE: 'CORPORATIVO',
} as const

export type PlanType = typeof PLAN_TYPES[keyof typeof PLAN_TYPES]

export const PLAN_TYPE_OPTIONS: { label: string, value: PlanType, labelKey: string }[] = [
  { label: 'Único', value: PLAN_TYPES.INDIVIDUAL, labelKey: `plans.types.${PLAN_TYPES.INDIVIDUAL}` },
  { label: 'Familiar', value: PLAN_TYPES.FAMILY, labelKey: `plans.types.${PLAN_TYPES.FAMILY}` },
  { label: 'Corporativo', value: PLAN_TYPES.CORPORATE, labelKey: `plans.types.${PLAN_TYPES.CORPORATE}` },
]

// ---- Term (hub ADR 0034) ----
// A term only exists when the plan requires re-inscription. The expiry is either a fixed
// annual date (month 1-12 + day 1-28) or a period of N months after enrollment.
export const TERM_MODES = {
  FIXED_DATE: 'FIXED_DATE',
  PERIOD: 'PERIOD',
} as const

export type TermMode = typeof TERM_MODES[keyof typeof TERM_MODES]

export const TERM_MODE_OPTIONS: { label: string, value: TermMode, labelKey: string }[] = [
  { label: 'Fecha fija anual', value: TERM_MODES.FIXED_DATE, labelKey: 'plans.term.modes.FIXED_DATE' },
  { label: 'Período en meses', value: TERM_MODES.PERIOD, labelKey: 'plans.term.modes.PERIOD' },
]

// ---- Plan ----

/**
 * Backend response. Amounts (BigDecimal) may be serialized as a number or a string
 * depending on the ObjectMapper; they are typed as `number | string` and always
 * formatted through `Number()`.
 */
export interface PlanDto {
  uuid: string
  code: string
  name: string
  description?: string | null
  type: PlanType | string
  inscriptionFee: number | string
  monthlyFee: number | string
  /** Real denomination of both fees (ADR 0015); every money field's `_Display` uses it. */
  currency_Code?: string | null
  /** FK pair (hub ADR 0014) — quick-link to `/dashboard/catalogs/currencies`. */
  currency_Uuid?: string | null
  currency_Display?: string | null
  /** Server-formatted `inscriptionFee` (hub ADR 0014) — no conversion tooltip pair (ADR 0015 §6 only covers `monthlyFee`). */
  inscriptionFee_Display?: string | null
  /** Server-formatted `monthlyFee` (hub ADR 0014). */
  monthlyFee_Display?: string | null
  // Live conversion of `monthlyFee` ONLY (ADR 0015 §6 Caso B) — null together
  // when no exchange rate is available. `inscriptionFee` has no counterpart.
  amountConverted?: number | string | null
  amountConverted_Display?: string | null
  convertedCurrency_Code?: string | null
  exchangeRateUsed?: number | string | null
  exchangeRateDate?: string | null
  includedBeneficiaries: number
  /** null = no beneficiary cap. */
  maxBeneficiaries?: number | null
  /** null = the plan doesn't allow additional beneficiaries. */
  extraBeneficiaryInscriptionFee?: number | string | null
  /** Minimum number of people the plan requires (V177); null = no minimum. */
  minMembers?: number | null
  /** The plan requires re-inscription each term (V220); only then does the term rule apply. */
  reinscriptionRequired?: boolean
  reinscriptionRequired_Display?: string | null
  termMode?: TermMode | null
  termMode_Display?: string | null
  /** FIXED_DATE: month (1-12) and day (1-28). */
  termFixedMonth?: number | null
  termFixedDay?: number | null
  /** PERIOD: months after enrollment. */
  termPeriodMonths?: number | null
  gracePeriodDays: number
  published: boolean
  publishedAt?: string | null
  active?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Body of POST /v1/admin/plans. Amounts as string (BigDecimal accepts string and
 * this avoids precision loss); counts as integers.
 */
export interface CreatePlanRequest {
  /** UPPER_SNAKE_CASE, unique natural key. */
  code: string
  name: string
  description?: string
  type: PlanType
  inscriptionFee: string
  monthlyFee: string
  includedBeneficiaries?: number
  /** null = no cap. */
  maxBeneficiaries?: number | null
  /** null = no additional beneficiaries. */
  extraBeneficiaryInscriptionFee?: string | null
  /** Minimum number of people (≥ 1); only meaningful for corporate plans. */
  minMembers?: number | null
  gracePeriodDays?: number
  published?: boolean
  /** Term (hub ADR 0034). On update, `false` clears the rule; sending a mode clears the other mode's fields. */
  reinscriptionRequired?: boolean
  termMode?: TermMode
  termFixedMonth?: number
  termFixedDay?: number
  termPeriodMonths?: number
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdatePlanRequest extends Partial<CreatePlanRequest> {
  active?: boolean
  status?: string
}
