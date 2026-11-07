import type { SelfRegistrationKind } from '~/types/onboardingPolicy'

/**
 * Sends the public self-registration pages (`/afiliarse`, `/solicitar-alianza`
 * and their English aliases) to the login screen while that registration is
 * switched off in the onboarding policy (hub ADR 0037 §1). The page declares
 * which registration it is with `definePageMeta({ selfRegistration: 'member' | 'ally' })`.
 *
 * The login page shows the "registration closed" notice from `?registration=`.
 * `ref` / `plan` are kept, so the same link works again once it is reopened.
 * UX layer only: the backend answers a closed registration with a 403.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const kind = to.meta.selfRegistration as SelfRegistrationKind | undefined
  if (!kind) return

  const { load } = usePublicOnboardingPolicy()
  const policy = await load()
  if (!policy) return

  const enabled = kind === 'member' ? policy.memberSelfRegistrationEnabled : policy.allySelfRegistrationEnabled
  if (enabled) return

  const query: Record<string, string> = { registration: kind }
  for (const key of ['ref', 'plan']) {
    const value = to.query[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  const english = to.path === '/en' || to.path.startsWith('/en/')
  return navigateTo({ path: english ? '/en' : '/', query }, { replace: true })
})
