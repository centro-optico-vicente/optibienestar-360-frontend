# ADR 0002 (local frontend) — Pinia para state management

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

Para `auth` store: cookies httpOnly (manejadas por el backend al login).
Para `ui` preferences (sidebar collapsed, etc.): `useStorage()` de VueUse → localStorage.

NO persistir:
- accessToken en localStorage (riesgo XSS)
- datos sensibles

## Alternativas descartadas

- **Vuex 4:** API más vieja, menos type-safe
- **Sin store global (composables solos):** Auth y permisos necesitan estado global accesible desde middleware
