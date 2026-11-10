import type { ApiError } from '~/types/auth'

// What is missing when a registration is submitted (hub ADR 0037). The backend answers 422
// `affiliation_request.submit.incomplete` / `ally_request.submit.incomplete` with a top-level `missing` list of
// stable keys. Member: birthDate, plan, contract. Ally: allyType, city, taxDocument, profession.

export type RegistrationKind = 'MEMBER' | 'ALLY'

/** Wizard step that holds each missing key (the keys of MEMBER_WIZARD_STEPS / ALLY_WIZARD_STEPS). */
const MEMBER_STEP_OF: Readonly<Record<string, string>> = {
  birthDate: 'personal',
  plan: 'plan',
  contract: 'plan',
}
const ALLY_STEP_OF: Readonly<Record<string, string>> = {
  city: 'location',
  allyType: 'fiscal',
  taxDocument: 'fiscal',
  profession: 'fiscal',
}

export interface MissingItem {
  key: string
  /** Wizard step to jump to; null for a key this version does not know. */
  step: string | null
}

/** The `missing` keys of an incomplete-submit 422 thrown by `useApi`; null for any other error. */
export function missingFromError(error: unknown): string[] | null {
  const problem = (error as Partial<ApiError> | null)?.problem
  const missing = problem?.missing
  if (!Array.isArray(missing)) return null
  const keys = missing.filter((k): k is string => typeof k === 'string' && k.length > 0)
  return keys.length ? keys : null
}

/** Each key with the step that holds it, in the order the backend listed them. */
export function missingItems(kind: RegistrationKind, keys: readonly string[]): MissingItem[] {
  const stepOf = kind === 'ALLY' ? ALLY_STEP_OF : MEMBER_STEP_OF
  return keys.map(key => ({ key, step: stepOf[key] ?? null }))
}
