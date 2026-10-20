/**
 * SEO links for the public screens (hub URL convention, spec 12): every public
 * page exists in Spanish (canonical) and English, so the head carries
 * `rel="alternate"` for `es`, `en` and `x-default` (→ Spanish) plus a
 * `rel="canonical"` pointing at the URL of the language being shown. Query
 * strings (`?token=`, `?ref=`) are left out on purpose. Authenticated pages get
 * no links. Called once from app.vue; it follows route changes.
 */
export const usePublicRouteHead = () => {
  const route = useRoute()
  const origin = useRequestURL().origin

  const link = computed(() => {
    const current = publicPathLocale(route.path)
    const es = localizePublicPath(route.path, 'es')
    const en = localizePublicPath(route.path, 'en')
    if (!current || !es || !en) return []
    return [
      { key: 'canonical', rel: 'canonical', href: `${origin}${current === 'en' ? en : es}` },
      { key: 'alternate-es', rel: 'alternate', hreflang: 'es', href: `${origin}${es}` },
      { key: 'alternate-en', rel: 'alternate', hreflang: 'en', href: `${origin}${en}` },
      { key: 'alternate-x-default', rel: 'alternate', hreflang: 'x-default', href: `${origin}${es}` },
    ]
  })

  useHead({ link })
}
