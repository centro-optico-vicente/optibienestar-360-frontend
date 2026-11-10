import type { Page } from '~/types/admin'
import type {
  AffiliationRequestListItemDto,
  AffiliationRequestPaymentRequest,
  AssistedDraftStartRequest,
  MemberRegistrationStep,
  MyAffiliationFamilyMember,
  MyAffiliationRequestDto,
  MyAffiliationStepRequest,
} from '~/types/affiliationRequests'
import type { MemberRegistrationApi } from '~/composables/useMemberRegistrationApi'

/**
 * Advisor portal: assisted affiliation saved as a DRAFT step by step (hub ADR 0037 §5, backend V234), under
 * `/v1/me/advisor/affiliation-requests/drafts`. The advisor only sees and edits their own drafts (another's is a 404).
 * `POST /drafts` starts it (AFFILIATION_REQUEST_CREATE_ASSISTED), `GET /drafts` and `GET /drafts/{uuid}` read
 * (AFFILIATION_REQUEST_VIEW_OWN), `PATCH /drafts/{uuid}/{step}` saves a step (AFFILIATION_REQUEST_DRAFT_UPDATE_ASSISTED)
 * and `POST /drafts/{uuid}/submit` sends it to review (AFFILIATION_REQUEST_DRAFT_SUBMIT_ASSISTED).
 */
export const useAdvisorAffiliationDrafts = () => {
  const BASE = '/v1/me/advisor/affiliation-requests/drafts'

  const list = (params: { page?: number, size?: number } = {}) =>
    useApi<Page<AffiliationRequestListItemDto>>(BASE, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  const start = (body: AssistedDraftStartRequest) =>
    useApi<MyAffiliationRequestDto>(BASE, { method: 'POST', body })

  const get = (uuid: string) => useApi<MyAffiliationRequestDto>(`${BASE}/${uuid}`)

  /** The step api of the shared registration step components, bound to one draft. */
  const forDraft = (uuid: string): MemberRegistrationApi => {
    const patchStep = (step: MemberRegistrationStep, body: MyAffiliationStepRequest | FormData) =>
      useApi<MyAffiliationRequestDto>(`${BASE}/${uuid}/${step}`, { method: 'PATCH', body })

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

    return {
      editableIdentity: true,
      savePersonal: body => patchStep('personal', body),
      savePlan: (planUuid: string, termsVersionUuid: string) =>
        patchStep('plan', { planUuid, termsVersionUuid, contractAccepted: true }),
      saveFamily: (family: MyAffiliationFamilyMember[]) => patchStep('family', { family }),
      savePayment,
      submit: () => useApi<MyAffiliationRequestDto>(`${BASE}/${uuid}/submit`, { method: 'POST' }),
    }
  }

  return { list, start, get, forDraft }
}
