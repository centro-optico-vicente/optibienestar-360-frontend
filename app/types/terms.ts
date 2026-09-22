// Types for the Terms & Conditions vertical (/v1/admin/terms, /v1/public/terms,
// /v1/me/terms) — see terms-and-conditions.md at the workspace root for the
// full design. Versioned per role, never overwritten (a "current" version is
// the latest `validFrom <= now`); one modal accept covers all pending types.

export type TermType = 'AFILIADO' | 'PROMOTOR' | 'ALIADO'

export interface TermsVersionDto {
  uuid: string
  termType: TermType
  title: string
  contentMarkdown: string
  isPublic: boolean
  validFrom: string
  /** Server-computed: `validFrom <= now`. `false` = still scheduled. */
  isVigent: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface TermsVersionCreateRequest {
  termType: TermType
  title: string
  contentMarkdown: string
  isPublic?: boolean
  /** ISO instant. Future = scheduled (only one allowed per type at a time). */
  validFrom: string
}

/** PATCH semantics — only allowed while the target row's `validFrom` is still in the future. */
export type TermsVersionUpdateRequest = Partial<TermsVersionCreateRequest>

/** One T&C the caller has not yet accepted — GET /v1/me/terms/pending. */
export interface PendingTermDto {
  termsVersionUuid: string
  termType: TermType
  title: string
  contentMarkdown: string
}
