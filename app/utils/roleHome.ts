import { ROLES, type UserRole } from '~/types/auth'

/** Route of the "Completar registro" wizard (hub ADR 0037 §3). */
export const COMPLETE_REGISTRATION_PATH = '/completar-registro'

/**
 * Where a signed-in person lands: the login screen, a bare `/dashboard` and the
 * "completion portal" closing all send them here. `portalOpen` is the
 * `showCompletionPortal` flag of the registration progress.
 *
 * Roles with a portal of their own (member, ally, advisor) land on it instead of the panel.
 *
 * A pending role (hub ADR 0036 / 0037) has no panel: its home is the wizard while
 * it exists, otherwise its own portal (the ally profile, or the member card once
 * the request is approved).
 */
export function roleHome(role: UserRole | null | undefined, portalOpen = true): string {
  switch (role) {
    case ROLES.MEMBER_PENDING:
      return portalOpen ? COMPLETE_REGISTRATION_PATH : '/members'
    case ROLES.ALLY_PENDING:
      return portalOpen ? COMPLETE_REGISTRATION_PATH : '/allies'
    // Home page per role (hub ADR 0037 §5): the portal each one uses all day.
    case ROLES.MEMBER:
      return '/members'
    case ROLES.ALLY:
      return '/allies/validator'
    case ROLES.ADVISOR:
      return '/advisors/portfolio'
    default:
      return '/dashboard'
  }
}
