// Registration progress (hub ADR 0037 §3): GET /v1/me/registration-progress.
// Drives the login notice and the "Completar registro" portal.

export interface RegistrationStepDto {
  key: string
  done: boolean
  essential: boolean
}

export interface RegistrationProgressDto {
  /** `MEMBER` / `ALLY` (affiliate or ally registration); any value naming an ally counts as the ally variant. */
  kind: string
  steps: RegistrationStepDto[]
  percent: number
  /** Sent to review (DRAFT -> PENDING for a member, registration_submitted_at for an ally). */
  submitted: boolean
  /** A staff member confirmed it with a MANUAL approval. */
  confirmedByOperator: boolean
  /** The "Completar registro" route and menu entry exist only while this is true. */
  showCompletionPortal: boolean
}

/** Ally variant of the wizard (otherwise the affiliate one). */
export function isAllyRegistration(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').toUpperCase()
  return k.includes('ALLY') || k.includes('ALIAD')
}

/** Wizard steps per variant, in order. The last one is always the review/send step. */
export const MEMBER_WIZARD_STEPS = ['personal', 'plan', 'payment', 'family', 'submit'] as const
export const ALLY_WIZARD_STEPS = ['location', 'fiscal', 'profile', 'submit'] as const

/** Default "essential" flags, used while the progress endpoint does not say otherwise. */
export const DEFAULT_ESSENTIAL_STEPS: Readonly<Record<string, boolean>> = {
  personal: true,
  plan: true,
  payment: false,
  family: false,
  submit: true,
  location: true,
  fiscal: true,
  profile: false,
}

/** How a wizard step was left: "Siguiente" (saves), "Guardar y seguir después" (saves), "Omitir" or back. */
export type StepExit = 'next' | 'later' | 'skip' | 'back'

/** Plan as listed by GET /v1/public/plans (only what the wizard needs). */
export interface PublicPlan {
  uuid: string
  name: string
  type?: string | null
  monthlyFee?: number | string | null
  inscriptionFee?: number | string | null
  currency_Code?: string | null
  minMembers?: number | null
}

/** Public AFILIADO contract version (GET /v1/public/terms/AFILIADO). */
export interface PublicTerms {
  uuid: string
  title: string
  contentMarkdown: string
}
