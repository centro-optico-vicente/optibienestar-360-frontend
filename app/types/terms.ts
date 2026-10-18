// Types for the Terms & Conditions vertical (/v1/admin/terms, /v1/public/terms,
// /v1/me/terms) — see terms-and-conditions.md at the workspace root for the
// full design. Versioned per role, never overwritten (a "current" version is
// the latest `validFrom <= now`); one modal accept covers all pending types.

export type TermType = 'AFILIADO' | 'PROMOTOR' | 'ALIADO'

export interface TermsVersionDto {
  uuid: string
  termType: TermType
  title: string
  /** Raw stored template — `{{org.*}}` / `{{brand.name}}` placeholders unresolved (what the editor edits). */
  contentMarkdown: string
  /** Same text with the placeholders resolved from the organization, for preview (admin endpoints only). */
  contentRendered?: string
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

/** One T&C the caller has not yet accepted — GET /v1/me/terms/pending. `contentMarkdown` is served already rendered. */
export interface PendingTermDto {
  termsVersionUuid: string
  termType: TermType
  title: string
  contentMarkdown: string
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
 * Placeholders the backend resolves when serving a T&C (`TermsTemplateRenderer`).
 * Kept here, not in i18n, because `{` `}` are interpolation syntax in vue-i18n.
 */
export const TERMS_TEMPLATE_VARIABLES = [
  { token: '{{brand.name}}', key: 'brandName' },
  { token: '{{org.legalName}}', key: 'legalName' },
  { token: '{{org.taxId}}', key: 'taxId' },
  { token: '{{org.registryState}}', key: 'registryState' },
  { token: '{{org.city}}', key: 'city' },
  { token: '{{org.serviceArea}}', key: 'serviceArea' },
] as const
