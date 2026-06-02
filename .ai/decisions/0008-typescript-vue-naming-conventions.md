# ADR 0008 (local frontend) — Convenciones de naming TypeScript / Vue

**Estado:** Aceptado
**Fecha:** 2026-06-01
**Fuente cross-stack:** [ADR 0009 (espejo local) — Convenciones de código](0009-code-conventions.md) · [original en el hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0009-code-conventions.md)
**Equivalente backend:** [ADR 0007 — Java naming conventions](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/decisions/0007-java-naming-conventions.md)

## Decisión

Todo código TypeScript/Vue en este repositorio sigue las convenciones del ADR 0009 del hub. Este documento las repite para referencia rápida dentro del repo.

### Idioma

- **Código** (componentes, composables, stores, tipos, funciones, variables, comentarios): **inglés**
- **Datos visibles al usuario** (textos de UI, labels, mensajes): **español venezolano** vía i18n (`i18n/locales/es.json`)
- **Documentación `.ai/`**: **español**

### Naming por tipo

| Tipo | Convención | Ejemplo |
|---|---|---|
| Interfaces / types | `PascalCase` | `Member`, `PaymentDto`, `ApiResponse`, `ProblemDetail` |
| Funciones | `camelCase` | `loadMembers()`, `formatCurrency()` |
| Variables y campos | `camelCase` | `accessToken`, `currentBalance` |
| Composables | `useXxx` | `useApi()`, `useAuth()`, `usePermissions()` |
| Stores (Pinia) | `useXxxStore` | `useAuthStore()`, `useCatalogStore()` |
| Componentes Vue | `PascalCase` (multi-word) | `DigitalCard.vue`, `PaymentForm.vue` |
| Pages | `kebab-case.vue` | `pages/admin/members.vue`, `pages/afiliado/usage-history.vue` |
| Plugins | `kebab-case[.client/.server].ts` | `00.runtime-config.client.ts`, `can.ts` |
| Constantes de módulo | `UPPER_SNAKE_CASE` | `DEFAULT_LOCALE`, `MAX_RETRIES` |
| Clases CSS / Tailwind | `kebab-case` | `card-container`, `text-primary` |
| Claves i18n | `snake_case` o `dot.notation` | `auth.invalid_credentials`, `members.title` |
| JSON keys (hacia la API) | `snake_case` | `{ "member_id": "uuid", "next_due_date": "..." }` |

### Naming descriptivo

Nombres concretos que describen el propósito, no abreviaciones ni genéricos:

| ❌ Evitar | ✅ Preferir |
|---|---|
| `e`, `err`, `ex` (salvo catch de una línea) | `error`, `fetchError`, `validationError` |
| `data`, `result`, `value` solos | `memberData`, `validationResult`, `currentValue` |
| `m`, `p`, `a` | `member`, `payment`, `ally` |
| `arr`, `obj`, `tmp` | `currencies`, `paymentData`, `parsedAmount` |
| `getData`, `doStuff`, `handle` | `fetchActiveMembers`, `recalculateBalance`, `handlePaymentApproval` |
| `i`, `j` fuera de loops triviales | `index`, `attemptCount` |

### Comentarios

Default: **no escribir comentarios.** Solo cuando el **por qué** no es obvio:

```typescript
// Numeric prefix (00.) makes this plugin run first so useApi reads the resolved baseURL.
export default defineNuxtPlugin(() => { ... })

// Workaround for Nuxt UI Bug #4567: tooltips break in mobile Safari
```

No comentar lo que el nombre ya dice. No comentar PRs, fechas, autores (eso es git blame). No usar bloques separadores (`// === STORES ===`).

> Los textos visibles al usuario van en **español** y se resuelven vía i18n (`$t('auth.invalid_credentials')`), nunca hardcodeados en inglés en el template.
