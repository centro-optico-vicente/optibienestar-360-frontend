import type { InjectionKey } from 'vue'
import type {
  AffiliationRequestPaymentRequest,
  MyAffiliationFamilyMember,
  MyAffiliationRequestDto,
  MyAffiliationStepRequest,
} from '~/types/affiliationRequests'

/**
 * What a member registration step needs to save itself. The wizard steps of `/completar-registro` call
 * the person's own flow (`/v1/me/affiliation-request/{step}`); the advisor's "Afiliar persona" screen provides
 * the same shape bound to one of their assisted drafts, so the step components are shared.
 */
export interface MemberRegistrationApi {
  savePersonal: (body: Pick<MyAffiliationStepRequest, 'firstName' | 'lastName' | 'birthDate' | 'phone' | 'documentType' | 'documentNumber' | 'email'>) => Promise<MyAffiliationRequestDto>
  savePlan: (planUuid: string, termsVersionUuid: string) => Promise<MyAffiliationRequestDto>
  savePayment: (body: AffiliationRequestPaymentRequest, support?: File | null) => Promise<MyAffiliationRequestDto>
  saveFamily: (family: MyAffiliationFamilyMember[]) => Promise<MyAffiliationRequestDto>
  submit: () => Promise<MyAffiliationRequestDto>
  /** The cédula and email are editable in the personal step (an assisted draft without login). */
  editableIdentity?: boolean
}

export const MEMBER_REGISTRATION_API: InjectionKey<MemberRegistrationApi> = Symbol('memberRegistrationApi')

/** The api given by an ancestor (advisor's assisted draft), else the person's own registration. */
export const useMemberRegistrationApi = (): MemberRegistrationApi =>
  inject(MEMBER_REGISTRATION_API, null) ?? useMyAffiliationRequest()
