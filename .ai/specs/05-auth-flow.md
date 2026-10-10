# 05 — Auth flow

> **Reescrito 2026-10-09** (ver [auditoría 2026-09-23](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/notes/2026-09-23_audit.md) hallazgo F-SPEC-05): el diseño original asumía cookie httpOnly, login en `/login.vue`, un `authStore.login()` monolítico y redirect por mapa de roles. Nada de eso es real. Este documento ya refleja el código real (`useAuth.ts` + `stores/auth.ts` + `pages/index.vue`).

## Login flow

```
[Usuario en / (NO /login — ese archivo no existe)]
  ↓
[Ingresa email + password, validado con zod]
  ↓
[useAuth().login({email, password}) → POST /v1/auth/login (skipAuth, silent)]
  ↓
[Backend responde LoginResponse: {user, accessToken, refreshToken} — SIN Set-Cookie, SIN httpOnly]
  ↓
[store.setSession(data) → accessToken+user en sessionStorage, refreshToken en localStorage,
 decodifica permissions/activeRole del JWT, programa refresh proactivo ~60s antes de expirar]
  ↓
[Redirect a route.query.redirect o '/dashboard' por default — SIN mapa role→path]
```

## Implementación login page (real, resumida)

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const route = useRoute()
const toast = useToast()
const apiError = ref<string | null>(null)
const lockedUntil = ref<Date | null>(null)  // HTTP 423 — cuenta bloqueada por intentos fallidos
const isLocked = computed(() => !!lockedUntil.value && lockedUntil.value > new Date())

const onSubmit = async (event: FormSubmitEvent<{ email: string, password: string }>) => {
  try {
    const result = await login(event.data)
    toast.add({ title: t('auth.login.welcomeTitle'), color: 'success' })
    await router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard')
  } catch (err) {
    const e = err as ApiError
    if (e?.status === 423 && e.problem?.lockedUntil) lockedUntil.value = new Date(e.problem.lockedUntil)
    apiError.value = e?.message || t('auth.login.errorFallback')
  }
}
</script>
```

Validación con **zod** (`email` + `password` min 8 chars), textos **i18n** (`$t()`, bilingüe es/en), sin campo "identifier" (solo email).

## `useAuth()` — composable real (no un método monolítico en el store)

```typescript
// composables/useAuth.ts (resumido — ver el archivo real para change-password/locale/switch-role)
export const useAuth = () => {
  const store = useAuthStore()
  const router = useRouter()

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    const data = await useApi<LoginResponse>('/v1/auth/login', {
      method: 'POST', body: payload, skipAuth: true, silent: true, // el componente maneja 423/errores
    })
    store.setSession(data)
    return data
  }

  const logout = async (): Promise<void> => {
    try {
      if (store.accessToken) {
        await useApi('/v1/auth/logout', {
          method: 'POST',
          body: store.refreshToken ? { refreshToken: store.refreshToken } : undefined,
          silent: true,
        }).catch(() => null)
      }
    } finally {
      store.clearSession()
      await router.push('/')
    }
  }

  // + changePassword, fetchMe, updateLocale, fetchMyRoles, switchActiveRole, recoverPassword, resetPassword
  return { login, logout, /* ... */ }
}
```

**`switchActiveRole(roleUuid)`** es una feature real sin equivalente en el diseño original: un usuario con varios roles asignados puede cambiar cuál está activo en la sesión actual (cierra la sesión y abre una nueva con `permissions`/`activeRole` recalculados) — alimenta un selector de rol en el sidebar.

## Refresh — proactivo + reactivo, no solo en el middleware

El store programa un refresh **proactivo** ~60s antes de que expire el accessToken (`scheduleRefresh()`/`isAccessExpiringSoon()`), y `useApi` hace un pre-flight que también refresca si hace falta antes de mandar una request. El middleware `auth.global.ts` real es mucho más simple que el diseño original — ver [`02-routing-layouts.md`](02-routing-layouts.md) para su contenido exacto; no redirige por una lista de `publicPaths` codificada, usa `PUBLIC_ROUTES`/`PUBLIC_PREFIXES`.

```typescript
// stores/auth.ts (resumido)
async tryRefresh(): Promise<boolean> {
  if (!this.refreshToken) return false
  if (refreshing) return refreshing  // single-flight: requests concurrentes comparten la promesa
  refreshing = (async () => {
    try {
      const data = await $fetch<RefreshResponse>('/v1/auth/refresh', {
        baseURL: useRuntimeConfig().public.apiBaseUrl,
        method: 'POST',
        body: { refreshToken: this.refreshToken },  // camelCase, no refresh_token
      })
      this.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch { this.clearSession(); return false }
  })()
  try { return await refreshing } finally { refreshing = null }
}
```

## Manejo de 401 en requests

`useApi` reintenta automáticamente, UNA vez, llamándose a sí mismo recursivo — no hay `onResponseError` de `$fetch.create` (ese diseño nunca se construyó así). Ver [`04-api-client.md`](04-api-client.md) para el código real completo.

## Logout

```typescript
// useAuth().logout() — real
const logout = async (): Promise<void> => {
  try {
    if (store.accessToken) {
      await useApi('/v1/auth/logout', {
        method: 'POST',
        body: store.refreshToken ? { refreshToken: store.refreshToken } : undefined,  // camelCase
        silent: true,
      }).catch(() => null)
    }
  } finally {
    store.clearSession()  // limpia sessionStorage + localStorage, NO hay cookie que limpiar
    await router.push('/')
  }
}
```

Backend mueve el refresh token a blacklist Redis. **No hay cookie httpOnly que limpiar** — `clearSession()` borra las claves de `sessionStorage`/`localStorage`.

## Recover password flow

```
[Usuario en /recover-password]
  ↓
[Ingresa email (zod: email válido) — NO cédula, solo email]
  ↓
[useAuth().recoverPassword(email) → POST /v1/auth/recover-password {email}]
  ↓
[Backend envía email con link: .../reset-password?token=...]
  ↓
[Usuario abre link → /reset-password (token leído de route.query.token)]
  ↓
[Ingresa nuevo password]
  ↓
[useAuth().resetPassword(token, newPassword) → POST /v1/auth/reset-password {token, newPassword}]
  ↓
[Backend valida token + actualiza password]
  ↓
[Redirect a / (NO /login, ese archivo no existe) con toast de éxito]
```

## Reglas

> **Corrección 2026-10-09:** las dos reglas de storage de abajo describían el diseño original (cookie httpOnly) y **contradicen directamente el código real** — no se tocó el código, se corrige la documentación para que deje de mentir. El storage real está formalizado en [ADR 0024 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0024-jwt-token-storage.md): decisión intencional (continuidad de sesión multi-pestaña) + CSP como mitigación XSS (ver `docker/default.conf`).

- **Access token en `sessionStorage`** (tab-scoped, no sobrevive a una pestaña nueva) — **no** "nunca en localStorage"; si vive en `sessionStorage` es igual de expuesto a XSS que `localStorage`.
- **Refresh token en `localStorage`** (compartido entre pestañas, "recordar sesión") — **no** cookie httpOnly. El backend no emite cookies de auth.
- **Cambio password / cambio rol** → invalidar JWTs vigentes (backend blacklist) — esto sí es real (`changePassword()`/`switchActiveRole()` fuerzan nueva sesión).
- **Cierre de pestaña**: el accessToken de esa pestaña se pierde (`sessionStorage`), pero el refreshToken en `localStorage` permite recuperar sesión sin re-login al volver (`hydrate()` intenta refresh si falta accessToken y hay refreshToken).
- **Bloqueo anti-brute-force** lo hace el backend (HTTP 423 + `problem.lockedUntil`); el frontend deshabilita el submit hasta esa fecha.

## Tests

> **Corrección 2026-10-09:** no hay directorio `tests/` en este repo — sin Vitest ni Playwright configurados (ver [`01-project-structure.md`](01-project-structure.md)). El ejemplo de abajo es aspiracional, no algo que corra hoy; además usaba `store.login()` (no existe, es `useAuth().login()`) y el rol `ADMIN` (real: `ADMINISTRADOR`). Si se configura testing a futuro, el equivalente real sería:

```typescript
test('login redirects to /dashboard and sets activeRole', async () => {
  const { login } = useAuth()
  const store = useAuthStore()
  await login({ email: 'admin@x.com', password: 'pass' })
  expect(store.activeRole).toBe('ADMINISTRADOR')
})
```

## Referencias

- [03-state-management.md](03-state-management.md)
- [04-api-client.md](04-api-client.md)
- [02-routing-layouts.md](02-routing-layouts.md)
- [Hub `03-security.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/03-security.md)
