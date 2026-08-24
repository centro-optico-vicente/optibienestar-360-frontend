# Specs del frontend — índice

> Specs cross-stack en [hub maestro](https://github.com/fenix-core/centro-optico-vicente/tree/main/.ai/specs).

## Specs disponibles

| # | Spec | Foco |
|---|---|---|
| 01 | [Project structure](01-project-structure.md) | pages/ layouts/ components/ composables/ stores/ middleware/ |
| 02 | [Routing & layouts](02-routing-layouts.md) | Layouts por rol + middleware auth/permission |
| 03 | [State management](03-state-management.md) | Pinia stores + persistencia |
| 04 | [API client](04-api-client.md) | $fetch wrapper + interceptor JWT |
| 05 | [Auth flow](05-auth-flow.md) | Login + refresh + logout |
| 06 | [i18n](06-i18n.md) | Español default + estructura mensajes |
| 07 | [Forms](07-forms.md) | vee-validate + zod + UX errores |
| 08 | [Tables](08-tables.md) | Paginación + RSQL + export |
| 09 | [Permissions](09-permissions.md) | usePermissions + v-permission |
| 10 | [Design system](10-design-system.md) | Nuxt UI overrides + componentes propios |
| 12 | [Auditoría](12-audit.md) | Config de auditoría, bitácoras de login/reportes, timeline de cambios |

## Specs cross-stack relevantes

- [Hub `06-integration.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/06-integration.md) — REST contracts
- [Hub `03-security.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/03-security.md) — CORS, JWT
- [Hub `05-domain-model.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/specs/05-domain-model.md) — modelo conceptual
