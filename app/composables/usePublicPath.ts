import { toLocaleCode } from '~/composables/useAppLocale'

/**
 * Links between public screens stay in the active language: returns a function
 * that maps a canonical (Spanish) public path to the current locale's pair
 * (`publicPath('/recuperar-clave')` → `/en/forgot-password` while in English).
 * Non-public targets pass through unchanged.
 */
export const usePublicPath = () => {
  const { locale } = useI18n()
  return (to: string): string => toPublicLocalePath(to, toLocaleCode(locale.value))
}

/**
 * Login screen in the active UI language (`/` or `/en`), for redirects outside a
 * component (middleware, logout, expired session).
 */
export function currentLoginPath(): string {
  const locale = tryUseNuxtApp()?.$i18n.locale.value
  return toPublicLocalePath('/', toLocaleCode(locale))
}
