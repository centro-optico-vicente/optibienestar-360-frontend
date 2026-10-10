# ADR LOC-0002 (frontend) — Pinia para state management

**Estado:** Aceptado
**Fecha:** 2026-05-18

## Decisión

Usar **Pinia** vía `@pinia/nuxt` para state global.

## Razón

- State management oficial recomendado por Vue 3 / Nuxt
- API más simple que Vuex
- Type-safe con TypeScript
- Composable con `useXxxStore()`
- Auto-imported en Nuxt

## Stores planeados

| Store | Responsabilidad |
|---|---|
| `useAuthStore()` | user, accessToken, refreshToken, permissions |
| `useCatalogsStore()` | catálogos cacheados (especialidades, ciudades, etc.) |
| `useNotificationsStore()` | toast notifications transientes |
| `useUiStore()` | sidebar collapse, theme, prefs UI |

## Persistencia

> **Corrección 2026-10-09:** esta sección describía cookies httpOnly y prohibía `localStorage` para el accessToken — el real es justo lo contrario, formalizado en [ADR 0024 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0024-jwt-token-storage.md).

Para `auth` store (real, `app/stores/auth.ts`): `accessToken`+`user` en `sessionStorage` (por pestaña), `refreshToken` en `localStorage` (compartido, permite que una pestaña nueva recupere sesión sin re-login) — decisión intencional, no cookies httpOnly (el backend no las emite). CSP (`docker/default.conf`) como mitigación XSS compensatoria.

## Alternativas descartadas

- **Vuex 4:** API más vieja, menos type-safe
- **Sin store global (composables solos):** Auth y permisos necesitan estado global accesible desde middleware
