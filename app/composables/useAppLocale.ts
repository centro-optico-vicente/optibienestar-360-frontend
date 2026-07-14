import type { AuthUser } from '~/types/auth'

/**
 * UI locale codes actually bundled (`i18n/locales/{es,en}.json`). The backend may
 * persist regional variants (e.g. `es-VE`); those fold onto a bundled code the same
 * way the backend's ResourceBundle falls back `es-VE → es`.
 */
export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type LocaleCode = typeof SUPPORTED_LOCALES[number]

const DEFAULT_LOCALE: LocaleCode = 'es'
// Pre-login hint: survives logout (unlike the JWT) so the login screen keeps the
// last chosen language until an authenticated preference takes over.
const HINT_KEY = 'op_locale'

const isSupported = (v: string): v is LocaleCode =>
  (SUPPORTED_LOCALES as readonly string[]).includes(v)

/** Folds a backend locale tag (es | es-VE | en) onto a bundled UI code. */
export function toLocaleCode(raw: string | null | undefined): LocaleCode {
  if (!raw) return DEFAULT_LOCALE
  const base = raw.toLowerCase().split('-')[0] ?? ''
  return isSupported(base) ? base : DEFAULT_LOCALE
}

/**
 * Central locale logic shared by the switcher and app bootstrap. Named
 * `useAppLocale` to avoid colliding with Nuxt UI's built-in `useLocale`.
 * - `changeLocale` is the user-driven switch (persists to the backend when signed in).
 * - `syncFromUser` mirrors the authenticated preference into the UI (wins over the hint).
 * - `applyHint` restores the pre-login choice before any session exists.
 */
export const useAppLocale = () => {
  const { locale, setLocale } = useI18n()
  const { updateLocale, isAuthenticated } = useAuth()

  const current = computed<LocaleCode>(() => toLocaleCode(locale.value))

  function readHint(): LocaleCode | null {
    if (!import.meta.client) return null
    const v = localStorage.getItem(HINT_KEY)
    return v && isSupported(v) ? v : null
  }

  function saveHint(code: LocaleCode): void {
    if (import.meta.client) localStorage.setItem(HINT_KEY, code)
  }

  async function apply(code: LocaleCode): Promise<void> {
    if (code !== locale.value) await setLocale(code)
  }

  /** Applies the persisted pre-login hint, if any (called once on app init). */
  async function applyHint(): Promise<void> {
    const hint = readHint()
    if (hint) await apply(hint)
  }

  /** Mirrors the signed-in user's stored preference into the UI locale. */
  async function syncFromUser(user: Pick<AuthUser, 'locale'> | null | undefined): Promise<void> {
    if (!user?.locale) return
    const code = toLocaleCode(user.locale)
    saveHint(code)
    await apply(code)
  }

  /**
   * User-driven locale change from the switcher. When authenticated it persists the
   * preference to the backend first (Option C: reissued access token, refresh kept),
   * so a failed request leaves the UI language unchanged. Without a session
   * (login / recover) it only switches locally and stores the hint.
   */
  async function changeLocale(code: LocaleCode): Promise<void> {
    if (code === current.value) return
    if (isAuthenticated.value) await updateLocale(code)
    saveHint(code)
    await apply(code)
  }

  return { current, changeLocale, applyHint, syncFromUser }
}
