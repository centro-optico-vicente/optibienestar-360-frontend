import type { ApiError, LoginResponse } from '~/types/auth'
import { ACCOUNT_EXISTS_CODE, ALLY_ACCOUNT_EXISTS_CODES } from '~/types/affiliationRequests'
import { COMPLETE_REGISTRATION_PATH } from '~/utils/roleHome'

/**
 * Shared tail of the public step 1 of both registrations (hub ADR 0037 §2): the POST returns the
 * session of the account just created, the person lands on the wizard. Falls back to a password
 * login, and finally to the emailed access link, when the response carries no session.
 */
export const useRegistrationStart = () => {
  const { login, requestMagicLink } = useAuth()
  const auth = useAuthStore()

  /**
   * `true` when the backend answered 422 "already has an account" (national ID or email already registered):
   * `code = ACCOUNT_EXISTS` on the member form, `ally_request.email.taken` / `ally_request.document.has_account` on
   * the ally form. The person then signs in and goes on from their own account (useJoinWithAccount).
   */
  const isAccountExists = (err: unknown): boolean => {
    const e = err as ApiError | null
    const code = e?.problem?.code
    return e?.status === 422 && typeof code === 'string'
      && (code === ACCOUNT_EXISTS_CODE || ALLY_ACCOUNT_EXISTS_CODES.includes(code))
  }

  /**
   * Opens the session and returns where to go next (the answer of step 1 carries the login session in `session`): the wizard, or `null` when no session could be
   * opened (no password and no tokens in the response): then the access link was requested instead.
   */
  async function openSession(
    session: Partial<LoginResponse> | null | undefined,
    credentials: { identifier: string, password?: string },
  ): Promise<string | null> {
    if (session?.accessToken && session.refreshToken && session.user) {
      auth.setSession(session as LoginResponse)
      return COMPLETE_REGISTRATION_PATH
    }
    if (credentials.password) {
      await login({ identifier: credentials.identifier, password: credentials.password })
      return COMPLETE_REGISTRATION_PATH
    }
    await requestMagicLink(credentials.identifier)
    return null
  }

  return { isAccountExists, openSession }
}
