import {
  SELF_REGISTRATION_DISABLED_CODE,
  type OnboardingPolicyDto,
  type OnboardingPolicyUpdateRequest,
  type PublicOnboardingPolicyDto,
  type SelfRegistrationKind,
} from '~/types/onboardingPolicy'
import type { ApiError } from '~/types/auth'

/**
 * Admin read/update of the onboarding policy (`/v1/admin/onboarding-policy`,
 * hub ADR 0037). GET requires `ONBOARDING_POLICY_VIEW`, PUT requires
 * `ONBOARDING_POLICY_UPDATE`.
 */
export const useOnboardingPolicy = () => {
  const get = () => useApi<OnboardingPolicyDto>('/v1/admin/onboarding-policy')

  const update = (body: OnboardingPolicyUpdateRequest) =>
    useApi<OnboardingPolicyDto>('/v1/admin/onboarding-policy', { method: 'PUT', body })

  return { get, update }
}

/**
 * Public view of the policy (`GET /v1/public/onboarding-policy`), fetched once
 * per page load and shared through `useState`. Fails open: if the request
 * fails, both self-registrations count as enabled — the backend still rejects
 * a closed one with a 403, so a stale "open" only costs a redirect later.
 */
export const usePublicOnboardingPolicy = () => {
  const policy = useState<PublicOnboardingPolicyDto | null>('public-onboarding-policy', () => null)
  const loaded = useState<boolean>('public-onboarding-policy-loaded', () => false)

  async function load(force = false): Promise<PublicOnboardingPolicyDto | null> {
    if (loaded.value && !force) return policy.value
    try {
      policy.value = await useApi<PublicOnboardingPolicyDto>('/v1/public/onboarding-policy', {
        skipAuth: true,
        silent: true,
      })
    }
    catch {
      policy.value = null
    }
    finally {
      loaded.value = true
    }
    return policy.value
  }

  const memberSelfRegistrationEnabled = computed(() => policy.value?.memberSelfRegistrationEnabled ?? true)
  const allySelfRegistrationEnabled = computed(() => policy.value?.allySelfRegistrationEnabled ?? true)

  return { policy, load, memberSelfRegistrationEnabled, allySelfRegistrationEnabled }
}

/**
 * After a failed public sign-up submit: if the backend answered 403
 * `SELF_REGISTRATION_DISABLED` (switched off while the form was open), go to
 * the login screen with the "registration closed" notice and return `true`.
 * `useApi` has already shown the localized reason in a toast.
 */
export async function redirectIfSelfRegistrationClosed(err: unknown, kind: SelfRegistrationKind): Promise<boolean> {
  const e = err as ApiError | null
  if (e?.status !== 403 || e.problem?.code !== SELF_REGISTRATION_DISABLED_CODE) return false
  await usePublicOnboardingPolicy().load(true)
  await navigateTo({ path: currentLoginPath(), query: { registration: kind } }, { replace: true })
  return true
}
