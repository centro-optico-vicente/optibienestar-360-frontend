import { toLocaleCode } from '~/composables/useAppLocale'

// Public screens take their language from the URL (hub URL convention): the
// English pairs (`/en`, `/en/...`) render in English, the canonical Spanish paths
// in Spanish. Authenticated pages keep the stored preference: the URL never sets
// it there, and leaving a public screen restores the signed-in user's locale.
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { $i18n } = useNuxtApp()

  const urlLocale = publicPathLocale(to.path)
  if (urlLocale) {
    if ($i18n.locale.value !== urlLocale) await $i18n.setLocale(urlLocale)
    return
  }

  if (from && publicPathLocale(from.path)) {
    const stored = useAuthStore().user?.locale
    if (!stored) return
    const code = toLocaleCode(stored)
    if ($i18n.locale.value !== code) await $i18n.setLocale(code)
  }
})
