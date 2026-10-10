# 04 — API client (composable `useApi`)

> **Reescrito 2026-10-09** (ver [auditoría 2026-09-23](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/notes/2026-09-23_audit.md) hallazgo F-SPEC-04): el diseño original describía `useApi()` devolviendo `{ apiFetch }` (un wrapper de `$fetch.create`). La implementación real (`app/composables/useApi.ts`) es **una función async que se llama directo**, sin destructuring, y su manejo de errores es bastante distinto. Este documento ya refleja el código real.

> Función central para toda llamada HTTP al backend. Single source of truth.

## Composable

```typescript
// composables/useApi.ts (forma real, resumida — ver el archivo fuente para el detalle completo)
export const useApi = async <T = unknown>(
  url: string,
  options: UseApiOptions = {}, // extiende las opciones de $fetch + skipAuth?/silent?/_retried?
): Promise<T> => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const toast = useToast() // Nuxt UI — no hay un store de notificaciones separado
  const { skipAuth = false, silent = false, _retried = false, headers, ...rest } = options

  // Pre-flight: si el accessToken está por expirar, refresca ANTES de mandar la request
  // (cubre tabs en background; single-flight si hay requests concurrentes).
  if (!skipAuth && !_retried && auth.refreshToken && auth.isAccessExpiringSoon()) {
    await auth.tryRefresh()
  }

  const finalHeaders: Record<string, string> = {
    'Accept': 'application/json',
    // El backend resuelve locale: claim JWT > Accept-Language > es-VE.
    'Accept-Language': activeLocale,
    ...(headers as Record<string, string> | undefined),
  }
  if (!skipAuth && auth.accessToken) {
    finalHeaders.Authorization = `Bearer ${auth.accessToken}`
  }

  try {
    return await $fetch<T>(url, { baseURL: config.public.apiBaseUrl, headers: finalHeaders, ...rest })
  }
  catch (err) {
    const status = (err as FetchError).response?.status ?? 0
    const problem = (err as FetchError).response?._data ?? null // RFC 7807 problem+json

    // 401 → refresca UNA vez y reintenta la request original (recursivo con _retried: true)
    if (status === 401 && !skipAuth && !_retried) {
      const refreshed = await auth.tryRefresh()
      if (refreshed) return useApi<T>(url, { ...options, _retried: true })
      auth.clearSession()
      if (import.meta.client) await navigateTo('/')
    }

    // Toast global (salvo silent/400/404/401/network) usando el mensaje localizado
    // del backend (problem.detail/title) o un fallback i18n por código de status.
    if (!silent && status !== 400 && status !== 404 && status !== 401 && status !== 0) {
      toast.add({ title: /* mensaje resuelto de problem o errors.byStatus.<code> */ '…', color: 'error' })
    }

    throw { status, problem, message: /* …mismo mensaje resuelto… */ '…' } as ApiError
  }
}
```

**Sin `credentials: 'include'`** — no se usan cookies (el token vive en `sessionStorage`/`localStorage`, ver [`03-state-management.md`](03-state-management.md)). **Sin `X-Trace-Id`** — no implementado. **Sin store de notificaciones Pinia** — usa `useToast()` de Nuxt UI directo.

## Uso típico

### GET

```typescript
const member = await useApi<MemberDto>(`/v1/admin/members/${uuid}`);
```

### POST con body

```typescript
const result = await useApi<PaymentDto>('/v1/admin/payments', {
  method: 'POST',
  body: paymentData,
});
```

### Paginación con query params

El patrón real omite parámetros vacíos en vez de mandarlos siempre (para no pisar el sort/filtro por defecto del backend) — ver `useAllies.ts`:

```typescript
const page = await useApi<Page<MemberListItemDto>>('/v1/admin/members', {
  query: {
    page: 0,
    size: 20,
    ...(sort?.length ? { sort } : {}),       // array → se repite como sort=a&sort=b
    ...(filter ? { filter } : {}),           // RSQL
    ...(q ? { q } : {}),
    ...(includeInactive ? { includeInactive: 'true' } : {}),
  },
});
```

### POST multipart (upload de archivo junto con un JSON)

Patrón real (`usePayments.ts`) — el JSON va como `Blob` con su propio part, `ofetch` detecta el `FormData` y setea el boundary automático; `useApi` no fuerza `Content-Type`:

```typescript
const register = (payload: PaymentCreateRequest, support?: File | null) => {
  const form = new FormData()
  form.append('payment', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (support) form.append('support', support)
  return useApi<PaymentDto>('/v1/admin/payments', { method: 'POST', body: form })
}
```

### Download con presigned URL

```typescript
const { url } = await useApi<{ url: string }>(`/v1/admin/payments/${uuid}/support`);
window.open(url, '_blank');
```

### Silenciar el toast global (el componente maneja el error)

```typescript
try {
  await useApi('/v1/auth/login', { method: 'POST', body: credentials, skipAuth: true, silent: true });
} catch (e) {
  // mostrar el error en el propio form, sin el toast global
}
```

## Manejo de errores en componentes

`useApi` ya lanza un `ApiError { status, problem, message }` y ya mostró el toast global (salvo `silent`) — el componente solo maneja lo específico de ese endpoint:

```vue
<script setup>
const error = ref<string | null>(null)
const loading = ref(false)

async function approve() {
  loading.value = true
  error.value = null
  try {
    await useApi(`/v1/admin/payments/${uuid}/approve`, {
      method: 'PUT',
      body: { notes: 'Validado en estado de cuenta' },
    })
  } catch (e) {
    const err = e as ApiError
    if (err.status === 409) {
      error.value = 'Este pago ya fue procesado por otro operador'
    }
    // El toast global ya cubrió 403/422/500; acá solo el caso específico (409).
  } finally {
    loading.value = false
  }
}
</script>
```

## Composables específicos por dominio

Un composable por vertical, cada método es una llamada directa a `useApi()` — no hay wrapper intermedio. Patrón real (`useAllies.ts`):

```typescript
// composables/useAllies.ts (resumido — ver el archivo real para el set completo de endpoints)
export const useAllies = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AllyListItemDto>>('/v1/admin/allies', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) => useApi<AllyDto>(`/v1/admin/allies/${uuid}`)
  const create = (body: CreateAllyRequest) => useApi<AllyDto>('/v1/admin/allies', { method: 'POST', body })
  const update = (uuid: string, body: UpdateAllyRequest) => useApi<AllyDto>(`/v1/admin/allies/${uuid}`, { method: 'PUT', body })
  // `physical` distingue soft-delete (default) de borrado físico (cuando no hay FKs apuntando al registro).
  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/allies/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  return { list, get, create, update, remove }
}
```

Uso:
```vue
const allies = useAllies()
const list = await allies.list({ page: 0, size: 20 })
```

## Tipos TypeScript

**Corrección 2026-10-09:** los DTOs reales usan `uuid` (no `id`), **camelCase** (no snake_case — [ADR 0019 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0019-api-json-casing-contract.md)), y el patrón `_Display`/`_Uuid` del [ADR 0014](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0014-display-value-convention.md) para FKs y escalares presentacionales (ej. `city_Uuid`/`city_Display`, `status`/`status_Display`). Ejemplo real (`types/allies.ts`):

```typescript
// types/allies.ts
export interface AllyListItemDto {
  uuid: string
  name: string
  allyTypeNames?: string[]
  city_Uuid: string | null
  city_Display: string | null
  status?: string | null
  status_Display: string | null
  published: boolean
  // ...
}
```

La forma real de `Page<T>` está en [`03-state-management.md`](03-state-management.md) / [ADR 0019 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0019-api-json-casing-contract.md) — no es `PageDTO` con `total_elements`/`has_next` en snake_case.

A futuro: auto-generar desde OpenAPI con `openapi-typescript` (pendiente, sin ADR que lo congele — ver auditoría hallazgo H-FS-8).

## Reglas

- **Nunca usar `fetch` o `axios` directamente** — siempre `useApi()`.
- **No exponer detalles de errores del backend al usuario final** (e.g., stack traces, IDs internos).
- **Loading states explícitos:** todo botón debe deshabilitarse mientras se procesa.
- ~~**Idempotency key** en POST que puedan reintentarse (pagos, etc.)~~ — **corrección 2026-10-09:** no implementado; ningún header `X-Idempotency-Key` real en frontend ni backend. Si se necesita, diseñarlo como feature nueva, no asumir que ya existe.

## Referencias

- [05-auth-flow.md](05-auth-flow.md)
- [Hub `06-integration.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/06-integration.md)
