# Estado actual del frontend (snapshot)

> **Actualizado:** 2026-06-01

## Resumen

| Aspecto | Estado |
|---|---|
| Bootstrap Nuxt 4 (SPA, `ssr: false`) | ✅ Hecho |
| Nuxt UI / Tailwind | ✅ Instalados |
| Pinia + VueUse + i18n (`es`) | ✅ Configurados |
| Auth (login, recover/reset password) | ✅ Hecho |
| RBAC editable (usuarios + roles + permisos) | ✅ Hecho |
| Catálogos (gestión de datos maestros) | ✅ Hecho |
| Layouts (`auth`, `dashboard`, `default`) | ✅ Hecho |
| Middleware (`auth.global`, `can`, `role`) | ✅ Hecho |
| Composables (10: `useApi`, `useAuth`, `usePermissions`, `useRoles`, `useUsers`, `useCatalog`…) | ✅ Hecho |
| Imagen Docker (Nginx + config en runtime) | ✅ Hecho (ADR 0006) |
| CI/CD (GitHub Actions) + `.githooks/` | ✅ Hecho |
| Portales aliado / afiliado / promotor | ❌ Pendientes |
| Módulos negocio (afiliados, membresías, pagos, validador) | ❌ Pendientes |
| Tests E2E | ❌ Pendientes |

## Estructura del repo HOY

```
optibienestar-360-frontend/
├── app/
│   ├── pages/              # login, recover/reset-password, 403, index
│   │   └── dashboard/      # index, users/, roles/, catalogs/, change-password, [...slug]
│   ├── layouts/            # auth.vue, dashboard.vue, default.vue
│   ├── composables/        # 10 (useApi, useAuth, usePermissions, useRoles, useUsers, useCatalog, …)
│   ├── middleware/         # auth.global.ts, can.ts, role.ts
│   ├── stores/             # auth.ts (Pinia)
│   ├── plugins/            # can.ts (v-can), 00.runtime-config.client.ts
│   ├── utils/              # catalog-registry.ts
│   ├── components/ · types/ · assets/
├── i18n/locales/es.json
├── docker/                 # alpine/debian Dockerfiles + nginx conf + entrypoint
├── .github/workflows/      # ci.yaml + publish.yaml
├── .githooks/              # pre-push (regla cero)
├── public/config.js        # runtime config placeholder (dev)
├── nuxt.config.ts · app.config.ts · package.json · pnpm-lock.yaml
├── CLAUDE.md · README.md · .ai/
└── LICENSE · .gitignore
```

## Roles del sistema

`SYSTEM`, `ADMINISTRADOR`, `OPERADOR`, `ALIADO`, `AFILIADO`, `PROMOTOR`. Hoy el panel
admin (`/dashboard/*`) cubre `SYSTEM`/`ADMINISTRADOR`/`OPERADOR`; los portales de
`ALIADO`/`AFILIADO`/`PROMOTOR` están pendientes.

## Próximos pasos

Por vertical en [`../checklist.md`](../checklist.md) (orden en [`../checklist-vertical.md`](../checklist-vertical.md)):
las vistas 1 (Auth/RBAC) y 2 (Catálogos) están completas; siguen 3 (Aliados),
4 (Afiliados), 5 (Membresías), 6 (Pagos), 7 (Validador), 8 (Promotores),
9 (Portal/Carnet) y 10 (Optimización/Reportes/QA).

## Cambios recientes

- **2026-06-01** — Imagen Docker + CI/CD + config en runtime ([ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md)); `.githooks/`; ADRs locales 0006–0010; checklist separado por fase/vertical.
- **2026-05-31** — RBAC editable: gestión de usuarios, roles y permisos por dominio.
- **2026-05-18** — Bootstrap del `.ai/` local del frontend.
