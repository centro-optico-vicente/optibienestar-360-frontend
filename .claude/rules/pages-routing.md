---
paths:
  - "app/pages/**"
  - "app/layouts/**"
  - "app/middleware/**"
  - "nuxt.config.ts"
  - "docker/default.conf"
---
# Páginas, rutas y layouts

- Rutas autenticadas en **inglés y plural**: `/dashboard/*` (admin), `/allies/*` (aliado), `/members/*` (afiliado), `/advisors/*` (asesor). Públicas en **español** (`/aliados`, `/afiliarse`, `/solicitar-alianza`, `/recuperar-clave`, `/restablecer-clave`, `/catalogo`), cada una con su par en inglés (`/en`, `/en/allies`, `/en/join`, `/en/forgot-password`, `/en/reset-password`) vía alias de ruta + `hreflang` ([`.ai/specs/06-i18n.md`](../../.ai/specs/06-i18n.md)).
- "promoter/promotor" no va en ninguna URL: usar `advisor`. Rutas viejas se mantienen con **301** en `nuxt.config.ts` (`routeRules`) **y** `docker/default.conf`; al renombrar una ruta, agregar ambas.
- Proteger con `definePageMeta({ middleware: 'can', permission: 'X_VIEW' })` (o `role`); el sidebar sale del menú data-driven (`useNav`), no de listas en el layout.
- API del backend: admin `/v1/admin/…`, propio `/v1/me/…` o `/v1/<rol>/me/…`, público `/v1/public/…`.
- Mobile-first ([LOC-0004](../../.ai/decisions/loc-0004-mobile-first.md)). Formularios de editar cargan el detalle por `GET /{uuid}`.
