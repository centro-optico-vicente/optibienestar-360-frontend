import type { CatalogItem } from '~/types/catalogs'

// Bank catalog (GET /v1/me/banks) loaded ONCE per session and shared, so any screen can show a bank's
// official / legal name on hover (hub ADR 0030): the DTOs only carry code + commercial name. Fails silently —
// without a session (public pages) or on an error there is simply no official name, never a toast.
let inFlight: Promise<void> | null = null

export function useBankCatalog() {
  const banks = useState<CatalogItem[] | null>('bank-catalog', () => null)
  const auth = useAuthStore()

  function ensureLoaded(): Promise<void> {
    if (banks.value || !import.meta.client || !auth.isAuthenticated) return Promise.resolve()
    if (!inFlight) {
      inFlight = useApi<CatalogItem[]>('/v1/me/banks', { silent: true })
        .then((items) => { banks.value = items ?? [] })
        .catch(() => { /* no official names; the commercial one is still shown */ })
        .finally(() => { inFlight = null })
    }
    return inFlight
  }

  /** Official name of a bank, matched by uuid first and then by SUDEBAN code; `null` when unknown. */
  function officialName(uuid?: string | null, code?: string | null): string | null {
    const list = banks.value
    if (!list) return null
    const bank = (uuid ? list.find(b => b.uuid === uuid) : undefined)
      ?? (code ? list.find(b => b.code === code) : undefined)
    return bank?.name ?? null
  }

  return { banks, ensureLoaded, officialName }
}
