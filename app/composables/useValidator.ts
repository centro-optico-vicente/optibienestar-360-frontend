import type { ValidationResultDto } from '~/types/validator'

/**
 * Realtime affiliate validator (GET /v1/ally/validate/{document},
 * ALLY_VALIDATE_MEMBER).
 *
 * The product's moment of truth: the operator types the affiliate's document at
 * the counter and the answer must be immediate (the backend targets p95 < 200ms,
 * served from a 60s Redis cache that is evicted whenever a payment is
 * approved/rejected or a membership changes status).
 *
 * `silent: true` — a "not found" document is an ordinary outcome of typing at a
 * counter, not an error to toast: the page renders the result panel for every
 * status, including NOT_FOUND. Errors surface there rather than as a toast, so
 * the operator's eyes stay on one place.
 */
export const useValidator = () => {
  /**
   * Validate by document number. Never 404s on an unknown document — the
   * backend answers 200 with `status: NOT_FOUND`.
   *
   * @param document the affiliate's document number, as typed/scanned.
   */
  const validate = (document: string) =>
    useApi<ValidationResultDto>(`/v1/ally/validate/${encodeURIComponent(document.trim())}`, {
      silent: true,
    })

  return { validate }
}
