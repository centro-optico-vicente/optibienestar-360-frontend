// Types for the Plans vertical (/v1/admin/plans), aligned with the backend
// (V13__plans.sql / V14__seed_plans.sql, PlanDto / PlanCreateRequest / PlanUpdateRequest).
//
// A Plan is the subscription catalog product: it defines pricing (enrollment,
// monthly fee, extra-beneficiary charge), included/maximum beneficiaries and the
// grace period. Memberships reference a Plan and take a "snapshot" of its pricing
// at enrollment time. The admin list is paged (Page<PlanDto>) with RSQL + `q`.
// PUT uses PATCH semantics (only the fields present are applied).

// ---- Plan type (family) ----
// The backend only models the `type` dimension (Individual/Familiar/Corporativo,
// the flyer taxonomy). The "Premium/1+/2+/3+" axis is a TBD, not yet implemented.
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export type PlanType = 'INDIVIDUAL' | 'FAMILIAR' | 'CORPORATIVO'

export const PLAN_TYPE_OPTIONS: { label: string, value: PlanType, labelKey: string }[] = [
  { label: 'Individual', value: 'INDIVIDUAL', labelKey: 'plans.types.INDIVIDUAL' },
  { label: 'Familiar', value: 'FAMILIAR', labelKey: 'plans.types.FAMILIAR' },
  { label: 'Corporativo', value: 'CORPORATIVO', labelKey: 'plans.types.CORPORATIVO' },
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
  gracePeriodDays?: number
  published?: boolean
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdatePlanRequest extends Partial<CreatePlanRequest> {
  active?: boolean
  status?: string
}
