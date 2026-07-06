// Tipos del vertical de Planes (/v1/admin/plans), alineados con el backend
// (V13__plans.sql / V14__seed_plans.sql, PlanDto / PlanCreateRequest / PlanUpdateRequest).
//
// Un Plan es el producto-catálogo de suscripción: define pricing (inscripción,
// mensualidad, cargo por beneficiario extra), beneficiarios incluidos/máximos y el
// periodo de gracia. Las membresías (afiliaciones) referencian un Plan y toman una
// "foto" de su pricing al momento de la afiliación. El listado admin es paginado
// (Page<PlanDto>) con RSQL + `q`. Los PUT usan semántica PATCH (solo campos presentes).

// ---- Tipo de plan (familia) ----
// El backend modela solo la dimensión `type` (Individual/Familiar/Corporativo, la
// taxonomía del flyer). El eje "Premium/1+/2+/3+" es un TBD aún no implementado.
export type PlanType = 'INDIVIDUAL' | 'FAMILIAR' | 'CORPORATIVO'

export const PLAN_TYPE_OPTIONS: { label: string, value: PlanType }[] = [
  { label: 'Individual', value: 'INDIVIDUAL' },
  { label: 'Familiar', value: 'FAMILIAR' },
  { label: 'Corporativo', value: 'CORPORATIVO' },
]

export function planTypeLabel(value?: string | null): string {
  return PLAN_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value ?? '—'
}

// ---- Plan ----

/**
 * Respuesta del backend. Los montos (BigDecimal) pueden serializarse como número o
 * como string según el ObjectMapper; se tipan como `number | string` y se formatean
 * siempre pasando por `Number()`.
 */
export interface PlanDto {
  uuid: string
  code: string
  name: string
  description?: string | null
  type: PlanType | string
  inscriptionFee: number | string
  monthlyFee: number | string
  includedBeneficiaries: number
  /** null = sin tope de beneficiarios. */
  maxBeneficiaries?: number | null
  /** null = el plan no admite beneficiarios adicionales. */
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
 * Body de POST /v1/admin/plans. Montos como string (BigDecimal acepta string y así
 * se evita pérdida de precisión); conteos como número entero.
 */
export interface CreatePlanRequest {
  /** UPPER_SNAKE_CASE, llave natural única. */
  code: string
  name: string
  description?: string
  type: PlanType
  inscriptionFee: string
  monthlyFee: string
  includedBeneficiaries?: number
  /** null = sin tope. */
  maxBeneficiaries?: number | null
  /** null = sin adicionales. */
  extraBeneficiaryInscriptionFee?: string | null
  gracePeriodDays?: number
  published?: boolean
}

/** PUT con semántica PATCH: solo se aplican los campos presentes. */
export interface UpdatePlanRequest extends Partial<CreatePlanRequest> {
  active?: boolean
  status?: string
}
