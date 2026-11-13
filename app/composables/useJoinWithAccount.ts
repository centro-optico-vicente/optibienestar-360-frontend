import type { LoginResponse } from '~/types/auth'
import { ROLES } from '~/types/auth'
import type { RegistrationStartResponse } from '~/types/affiliationRequests'
import type { MyAllyRequestCreateRequest } from '~/types/allyRequests'
import { roleHome } from '~/utils/roleHome'

const PENDING_ROLES: readonly string[] = [ROLES.MEMBER_PENDING, ROLES.ALLY_PENDING]

/**
 * One person, one account, several segments (backend#438): someone already signed in — an advisor or ally who
 * affiliates, a member with a business or practice who becomes an ally — starts the other registration on their own
 * account instead of the public step 1, which would answer "you already have an account".
 *
 * The backend adds the pending role next to the account's roles and answers with a session already switched to it,
 * so the person goes on with the usual wizard (/completar-registro).
 */
export const useJoinWithAccount = () => {
  const auth = useAuthStore()
  const { fetchMyRoles, switchActiveRole } = useAuth()

  function adopt(res: RegistrationStartResponse): RegistrationStartResponse {
    if (res.session?.accessToken && res.session.refreshToken && res.session.user) {
      auth.setSession(res.session as LoginResponse)
    }
    return res
  }

  /** POST /v1/me/affiliation-request: the affiliation DRAFT on the caller's own account. */
  const startAffiliation = async (referralCode?: string) =>
    adopt(await useApi<RegistrationStartResponse>('/v1/me/affiliation-request', {
      method: 'POST',
      silent: true,
      body: { referralCode: referralCode || undefined, refreshToken: auth.refreshToken },
    }))

  /** POST /v1/me/ally-requests: the PENDING ally held by the caller's own person. */
  const startAlly = async (body: Omit<MyAllyRequestCreateRequest, 'refreshToken'>) =>
    adopt(await useApi<RegistrationStartResponse>('/v1/me/ally-requests', {
      method: 'POST',
      silent: true,
      body: { ...body, refreshToken: auth.refreshToken },
    }))

  /**
   * After discarding a registration: an account that has other roles keeps them (only the pending one goes), so the
   * session moves to one of them and the person lands on its home. Returns that home, or `null` when the account had
   * nothing else (the login was closed): then the caller signs out.
   */
  async function leavePendingRole(): Promise<string | null> {
    try {
      const roles = await fetchMyRoles()
      const other = roles.find(r => r.isDefault && !PENDING_ROLES.includes(r.name))
        ?? roles.find(r => !PENDING_ROLES.includes(r.name))
      if (!other) return null
      await switchActiveRole(other.uuid)
      return roleHome(other.name)
    }
    catch {
      return null
    }
  }

  return { startAffiliation, startAlly, leavePendingRole }
}
