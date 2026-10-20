import type { LocaleCode } from '~/composables/useAppLocale'

/**
 * Public screens and their English pairs (hub URL convention, spec 12:
 * https://github.com/centro-optico-vicente/centro-optico-vicente/blob/main/.ai/specs/12-url-conventions.md).
 * The Spanish path is canonical; the English one renders the same page in English
 * (a route alias declared with `definePageMeta({ alias })`, not a redirect).
 * `prefix` pairs also map their subpaths (`/aliados/{uuid}` ↔ `/en/allies/{uuid}`).
 *
 * Matching is exact or `base/`, so the authenticated portal `/allies` is never
 * public: only `/en/allies` is.
 */
interface PublicRoutePair {
  es: string
  en: string
  prefix?: boolean
}

export const PUBLIC_ROUTE_PAIRS: readonly PublicRoutePair[] = [
  { es: '/', en: '/en' },
  { es: '/aliados', en: '/en/allies', prefix: true },
  { es: '/afiliarse', en: '/en/join' },
  { es: '/recuperar-clave', en: '/en/forgot-password' },
  { es: '/restablecer-clave', en: '/en/reset-password' },
]

interface PublicRouteMatch {
  pair: PublicRoutePair
  locale: LocaleCode
  /** Subpath after the pair's base (`/{uuid}`), empty for an exact match. */
  rest: string
}

const LOCALES: readonly LocaleCode[] = ['es', 'en']

/** Drops a trailing slash (`/en/` → `/en`) but keeps the root `/`. */
function normalize(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

function matchPublicPath(rawPath: string): PublicRouteMatch | null {
  const path = normalize(rawPath)
  for (const pair of PUBLIC_ROUTE_PAIRS) {
    for (const locale of LOCALES) {
      const base = pair[locale]
      if (path === base) return { pair, locale, rest: '' }
      if (pair.prefix && path.startsWith(`${base}/`)) return { pair, locale, rest: path.slice(base.length) }
    }
  }
  return null
}

/** Language a public URL is written in (`/en/...` → `en`, Spanish path → `es`); `null` when not public. */
export function publicPathLocale(path: string): LocaleCode | null {
  return matchPublicPath(path)?.locale ?? null
}

/** True for the public screens in either language. */
export function isPublicPath(path: string): boolean {
  return matchPublicPath(path) !== null
}

/** The same public screen in `locale` (`/aliados/x` + `en` → `/en/allies/x`); `null` when not public. */
export function localizePublicPath(path: string, locale: LocaleCode): string | null {
  const match = matchPublicPath(path)
  return match ? `${match.pair[locale]}${match.rest}` : null
}

/**
 * Link target in `locale`: localizes the path part of a public link and keeps its
 * query and hash (`/#contact` + `en` → `/en#contact`). Non-public targets are
 * returned unchanged.
 */
export function toPublicLocalePath(to: string, locale: LocaleCode): string {
  const [, path = '/', suffix = ''] = /^([^?#]*)(.*)$/.exec(to) ?? []
  return `${localizePublicPath(path || '/', locale) ?? path}${suffix}`
}
