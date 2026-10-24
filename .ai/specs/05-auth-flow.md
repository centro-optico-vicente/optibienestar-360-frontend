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
[Usuario en /recuperar-clave]
  ↓
[Ingresa email (zod: email válido) — NO cédula, solo email]
  ↓
[useAuth().recoverPassword(email) → POST /v1/auth/recover-password {email}]
  ↓
[Backend envía email con un botón/enlace y el mismo token como código de respaldo:
 APP_FRONTEND_URL + /restablecer-clave?token=... (o /en/reset-password?token=... si el destinatario es `en`)]
  ↓
[Usuario abre el enlace — /reset-password redirige 301 conservando ?token=]
  ↓
[La página lee route.query.token una vez, lo guarda en memoria y lo quita de la URL con router.replace (sin recargar);
 <meta name="referrer" content="no-referrer"> para que no salga en el Referer]
  ↓
[Sin ?token= (o si la API rechaza el del enlace) → campo «Código de recuperación» para pegar el código del correo]
  ↓
[Ingresa nuevo password (zod igual a la política del backend: 8–128 caracteres, sin reglas de complejidad;
 la API rechaza las últimas N contraseñas con auth.password.history.repeat)]
  ↓
[useAuth().resetPassword(token, newPassword) → POST /v1/auth/reset-password {token, newPassword}]
  ↓
[Backend valida token + actualiza password]
  ↓
[Redirect a / (NO /login, ese archivo no existe) con toast de éxito]
```

## Aceptación de contratos y «Mis contratos»

Detalle del backend: [backend spec 18 — Contratos (T&C)](https://github.com/centro-optico-vicente/optibienestar-360-backend/blob/main/.ai/specs/18-terms-acceptance.md).

- **Modal por pasos** (`TermsAcceptanceModal` + `usePendingTerms`): `app.vue` llama `GET /v1/me/terms/pending` tras hidratar la sesión. El modal muestra **un documento por paso** («Documento X de N»), primero los obligatorios. Lo obligatorio viene en `mandatory`, el `isMandatory` de la versión, que el admin configura en Organización → Términos con el switch «Obligatorio» (default: AFILIADO sí, los demás no). Un cambio ahí se aplica de inmediato a la versión vigente sin pedir que se acepte de nuevo. Mientras haya un obligatorio pendiente, el modal no se puede cerrar.
- **Contratos omitibles** (`mandatory: false`): botón «Recordar más tarde» → `snooze()` los oculta 5 min (en `sessionStorage`; un `useIntervalFn` de `app.vue` los vuelve a mostrar). Mientras estén pendientes, su módulo queda bloqueado: `layouts/dashboard.vue` muestra `TermsBlockedNotice` en lugar de la página (`gatedTermType`: `/advisors` → ASESOR, `/allies` → ALIADO), `AppNavItem` pone un candado y, ante un 403 `terms.pending` del backend en cualquier otra pantalla, `useApi` muestra un toast con la acción «Aceptar ahora» (`openNow(termType)`).
- Los convenios ALIADO llegan **uno por convenio** (backend V189): si la misma plantilla aplica a dos aliados del usuario, son dos ítems, cada uno con los datos de su aliado. El modal los agrupa por aliado («Convenio con {aliado}»). Clave de cada ítem: versión + convenio (`pendingTermKey`).
- Si el ítem trae `previousAcceptance`, aparece la pestaña **«Cambios»**: diff por línea entre el texto aceptado antes y el nuevo (verde = agregado, rojo = quitado, gris = igual). El diff es propio (`app/utils/lineDiff.ts`, LCS por línea), sin dependencias nuevas.
- Cada paso se acepta con `POST /v1/me/terms/{termsVersionUuid}/accept` (body `{ allyAgreementUuid }` solo para ALIADO). `POST /v1/me/terms/accept { items: [...] }` sigue disponible para aceptar varios a la vez (`acceptAll`).
- **«Mis contratos»** (`/dashboard/contracts`, entrada en `OTHER_NAV` junto a «Cambiar contraseña», sin permiso: cualquier usuario autenticado): `GET /v1/me/terms/acceptances`, agrupado por tipo y, para ALIADO, por aliado; cada fila muestra versión, fecha y canal, y se expande para leer el texto tal como se aceptó. Las aceptaciones anteriores a V189 se marcan como texto reconstruido.
- Las variables MONEY/NUMBER de las plantillas (`plan.monthlyFee`, etc.) salen del endpoint de variables del editor (`/dashboard/organization`); el monto se escribe en su moneda con la cláusula «o su equivalente en bolívares a la tasa oficial del BCV vigente el día del pago», nunca convertido.

## Política de seguridad (admin)

`/dashboard/security/policy` edita la única política activa del backend (`GET`/`PUT /v1/admin/security-policy`, `useSecurityPolicy()`). Permisos: `SECURITY_POLICY_VIEW` (ver) / `SECURITY_POLICY_UPDATE` (editar). El PUT envía los 5 campos siempre (reemplazo completo).

| Campo | Mín. | `0` significa |
|---|---|---|
| `maxLoginAttempts` | 1 | — |
| `lockoutDurationMinutes` | 1 | — |
| `daysPasswordExpires` | 0 | sin fecha de expiración en contraseñas nuevas (el login aún no rechaza vencidas) |
| `passwordHistoryCount` | 0 | se permite repetir la misma contraseña |
| `maxConcurrentSessions` | 1 | — (se guarda, aún no se aplica en el login) |

Los mínimos viven en `SECURITY_POLICY_MIN` (`types/securityPolicy.ts`) y se reflejan en el schema zod y en `:min` de `UInputNumber`; el backend los valida igual (Bean Validation + CHECKs V191).

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
