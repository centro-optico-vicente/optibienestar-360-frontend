// Types for the Terms & Conditions vertical (/v1/admin/terms, /v1/public/terms,
// /v1/me/terms) — see terms-and-conditions.md at the workspace root for the
// full design. Versioned per contract kind, never overwritten (a "current"
// version is the latest `validFrom <= now` of its stream); one modal accept
// covers all pending versions. ALIADO contracts are accepted once per ally
// agreement (backend V189) and every acceptance keeps the text as accepted.
//
// Audience (backend `TermsAcceptanceService`), by linked entity, never by
// role: MEMBER → every user; ADVISOR → users with an active, non-system
// advisor record (any rank); ALLY → users of an ally whose active agreement
// links the template. `isPublic` only means "served by the
// public web endpoint", never "must be accepted".
//
// ALLY templates carry an optional scope (backend V183): ally type, segment,
// specific ally — all empty = general template. Each scope combination is its
// own stream with its own current/scheduled version.

/**
 * Contract kinds. English keys, Spanish values: the value is the backend
 * `termType` code (`/v1/public/terms/{type}`, JSON). Advisor is `ASESOR`
 * since backend V185 (it was `PROMOTOR`).
 */
export const TERM_TYPES = {
  MEMBER: 'AFILIADO',
  ADVISOR: 'ASESOR',
  ALLY: 'ALIADO',
} as const

export type TermType = typeof TERM_TYPES[keyof typeof TERM_TYPES]

/** Ally segment — mirrors backend `AllyType.Segment` (V179). */
export type AllySegment = 'B2B' | 'B2P'

export interface TermsVersionDto {
  uuid: string
  termType: TermType
  title: string
  /** Raw stored template — `{{...}}` placeholders unresolved (what the editor edits). */
  contentMarkdown: string
  /**
   * Preview (admin endpoints only): placeholders resolved with the real
   * organization and sample member/advisor/ally values.
   */
  contentRendered?: string
  /** Only "visible on the public website" (`/v1/public/terms`); acceptance is requested either way. */
  isPublic: boolean
  validFrom: string
  /** Server-computed: `validFrom <= now`. `false` = still scheduled. */
  isVigent: boolean
  /** ALIADO scope (V183) — `null` when not restricted (ADR 0014 `_Uuid` / `_Display` pairs). */
  allyType_Uuid?: string | null
  allyType_Display?: string | null
  segment?: AllySegment | null
  segment_Display?: string | null
  ally_Uuid?: string | null
  ally_Display?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface TermsVersionCreateRequest {
  termType: TermType
  title: string
  contentMarkdown: string
  isPublic?: boolean
  /** ISO instant. Future = scheduled (only one allowed per stream at a time). */
  validFrom: string
  /** ALIADO only (422 otherwise) — optional scope narrowing which allies can use the template. */
  allyTypeUuid?: string
  segment?: AllySegment
  allyUuid?: string
}

/**
 * PATCH semantics — only allowed while the target row's `validFrom` is still in
 * the future. `termType` is ignored by the backend; a scope field sets it, an
 * omitted one leaves it unchanged.
 */
export type TermsVersionUpdateRequest = Partial<TermsVersionCreateRequest>

/**
 * The acceptance a pending item replaces (backend V189): the text the user
 * accepted last for the same agreement (else the same ally; for AFILIADO /
 * ASESOR, the same type). Drives the "Cambios" diff tab.
 */
export interface PreviousTermsAcceptance {
  termsVersionUuid: string
  versionNumber: number
  acceptedAt: string
  acceptedAt_Display?: string | null
  /** Text as accepted (pre-V189 rows: that version re-rendered with current data). */
  renderedContent: string
}

/**
 * One T&C the caller has not yet accepted — GET /v1/me/terms/pending.
 * `contentMarkdown` is served already rendered. ALIADO items come one per
 * ally agreement (V189): the same template shared by two allies is two items,
 * each with its ally's data; `allyAgreementUuid` goes back in the accept call.
 */
export interface PendingTermDto {
  termsVersionUuid: string
  termType: TermType
  title: string
  contentMarkdown: string
  /** 1-based position of the version in its stream. */
  versionNumber: number
  allyUuid: string | null
  allyName: string | null
  allyAgreementUuid: string | null
  previousAcceptance: PreviousTermsAcceptance | null
}

/** One accepted pending item — POST /v1/me/terms/accept `items[]`. */
export interface TermsAcceptItem {
  termsVersionUuid: string
  /** ALIADO only. */
  allyAgreementUuid?: string | null
}

/** Stable key of a pending item: version + agreement (one version may be pending for several agreements). */
export const pendingTermKey = (term: Pick<PendingTermDto, 'termsVersionUuid' | 'allyAgreementUuid'>) =>
  `${term.termsVersionUuid}:${term.allyAgreementUuid ?? ''}`

/** One contract the caller accepted — GET /v1/me/terms/acceptances ("Mis contratos"), newest first. */
export interface TermsAcceptanceHistoryDto {
  uuid: string
  termType: TermType
  termsVersionUuid: string
  versionNumber: number
  title: string
  allyUuid: string | null
  allyName: string | null
  allyAgreementUuid: string | null
  acceptedAt: string
  acceptedAt_Display?: string | null
  channel: TermsAcceptanceChannel
  /** Text as accepted. */
  renderedContent: string
  /** `true` for pre-V189 acceptances: no stored text, re-rendered with current data. */
  contentReconstructed: boolean
}

/**
 * Anonymous projection — GET /v1/public/terms/{type}. `contentMarkdown` is
 * served already rendered; `uuid` is what the public affiliation form sends
 * back as `termsVersionUuid`.
 */
export interface PublicTermsDto {
  uuid: string
  termType: TermType
  title: string
  contentMarkdown: string
  validFrom: string
}

/** How an acceptance was given — mirrors backend `TermsAcceptance.Channel` (V181). */
export type TermsAcceptanceChannel = 'PORTAL' | 'SELF_SERVICE' | 'ASSISTED' | 'ADMIN'

/**
 * One variable a template of a given kind may use — GET
 * /v1/admin/terms/variables?type=. `key` goes between double braces
 * (`{{member.fullName}}`); `description` comes localized from the backend.
 * Saving a template with any other placeholder is a 422 whose problem body
 * carries `invalidVariables`.
 */
export interface TermsVariableDto {
  key: string
  description: string
  /**
   * How the value is written in the contract (backend `TermsVariables.Kind`).
   * MONEY = amount in its own currency plus "o su equivalente en bolívares a
   * la tasa oficial del BCV vigente el día del pago" when it is not the
   * official one — never a converted figure.
   */
  kind?: 'TEXT' | 'DATE' | 'NUMBER' | 'MONEY' | 'BOOLEAN'
}

/** `{{key}}` — the token inserted in the editor for a variable. */
export const termsVariableToken = (key: string) => `{{${key}}}`
