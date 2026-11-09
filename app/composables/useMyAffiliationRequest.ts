import type {
  AffiliationRequestPaymentRequest,
  AffiliationRequestStartRequest,
  MemberRegistrationStep,
  MyAffiliationFamilyMember,
  MyAffiliationRequestDto,
  MyAffiliationStepRequest,
  RegistrationStartResponse,
} from '~/types/affiliationRequests'

/**
 * The caller's own affiliation request, filled in steps (hub ADR 0037 §2):
 * `POST /v1/public/affiliation-requests` is step 1 (creates the account and a DRAFT),
 * `GET /v1/me/affiliation-request`, `PATCH /v1/me/affiliation-request/{step}` for
 * `personal`, `plan`, `payment` and `family`, and `POST .../submit`.
 */
export const useMyAffiliationRequest = () => {
  const BASE = '/v1/me/affiliation-request'

  /** Step 1. Anonymous; 422 `ACCOUNT_EXISTS` when the national ID or the email already has an account. */
  const start = (body: AffiliationRequestStartRequest) =>
    useApi<RegistrationStartResponse>('/v1/public/affiliation-requests', {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body,
    })

  const get = () => useApi<MyAffiliationRequestDto>(BASE)

  const patchStep = (step: MemberRegistrationStep, body: MyAffiliationStepRequest | FormData) =>
    useApi<MyAffiliationRequestDto>(`${BASE}/${step}`, { method: 'PATCH', body })

  const savePersonal = (body: Pick<MyAffiliationStepRequest, 'firstName' | 'lastName' | 'birthDate' | 'phone'>) =>
    patchStep('personal', body)
  /** Accepting the contract is part of the plan step. */
  const savePlan = (planUuid: string, termsVersionUuid: string) =>
    patchStep('plan', { planUuid, termsVersionUuid, contractAccepted: true })
  const saveFamily = (family: MyAffiliationFamilyMember[]) => patchStep('family', { family })

  /** The reported inscription payment; with a proof it goes as multipart (`request` JSON + `support`). */
  const savePayment = (body: AffiliationRequestPaymentRequest, support?: File | null) => {
    const request: MyAffiliationStepRequest = { payment: body }
    let payload: MyAffiliationStepRequest | FormData = request
    if (support) {
      const form = new FormData()
      form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
      form.append('support', support)
      payload = form
    }
    return patchStep('payment', payload)
  }

  /** Validates the essentials and moves the request from DRAFT to PENDING (the policy may approve it right away). */
  const submit = () => useApi<MyAffiliationRequestDto>(`${BASE}/submit`, { method: 'POST' })

  return { start, get, savePersonal, savePlan, savePayment, saveFamily, submit }
}
