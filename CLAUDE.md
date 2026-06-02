# optisalud-plus-frontend

Frontend admin/multi-rol del ecosistema **OptiSalud Plus**. Nuxt 4 (SPA, `ssr: false`) + Nuxt UI + Tailwind CSS + Pinia.

**Parte del ecosistema:** [centro-optico-vicente](https://github.com/fenix-core/centro-optico-vicente) (hub maestro)

## Documentación

Toda la documentación para asistencia IA vive en [`.ai/`](.ai/). **Empezar por [`.ai/CLAUDE.md`](.ai/CLAUDE.md)**.

Para decisiones cross-stack (infraestructura, modelo de datos, contracts REST con backend), ver el **hub maestro**: [centro-optico-vicente/.ai](https://github.com/fenix-core/centro-optico-vicente/tree/main/.ai).

| Necesito | Archivo |
|---|---|
| Brief de entrada al frontend | [`.ai/CLAUDE.md`](.ai/CLAUDE.md) |
| Checklist (tareas frontend) | [`.ai/checklist.md`](.ai/checklist.md) |
| Estructura del proyecto | [`.ai/specs/01-project-structure.md`](.ai/specs/01-project-structure.md) |
| Cliente API y auth | [`.ai/specs/04-api-client.md`](.ai/specs/04-api-client.md) |
| Sistema de permisos | [`.ai/specs/09-permissions.md`](.ai/specs/09-permissions.md) |
| Playbooks (nueva página, form, tabla) | [`.ai/playbooks/`](.ai/playbooks/) |
| CI/CD + Docker + config en runtime | [`.ai/decisions/0006-ci-cd-docker-runtime-config.md`](.ai/decisions/0006-ci-cd-docker-runtime-config.md) · [`docker/`](docker/) |
| Skills + MCP de Claude Code | [`.ai/skills.md`](.ai/skills.md) · [`.ai/playbooks/install-skills.md`](.ai/playbooks/install-skills.md) |
| Agente Nuxt experto | [`.claude/agents/nuxt-expert.md`](.claude/agents/nuxt-expert.md) |

## Stack

- **Vue 3** + **Nuxt 4** — **SPA** (`ssr: false`, [ADR 0003](.ai/decisions/0003-spa-mode.md))
- **Nuxt UI** (componentes accesibles, Tailwind incluido)
- **Pinia** (state management) + **VueUse**
- **@nuxtjs/i18n** (español default, [ADR 0010](.ai/decisions/0010-localization-venezuela.md))
- **vee-validate + zod** (forms)
- **$fetch** nativo con interceptor JWT (`composables/useApi.ts`)
- **Despliegue:** imagen Docker (Nginx sirviendo SPA estático) + config en runtime ([ADR 0006](.ai/decisions/0006-ci-cd-docker-runtime-config.md))

## Multi-rol

El mismo app sirve a varios roles (`SYSTEM`, `ADMINISTRADOR`, `OPERADOR`, `ALIADO`, `AFILIADO`, `PROMOTOR`):

- `SYSTEM`, `ADMINISTRADOR`, `OPERADOR` → panel administrativo (`/dashboard/*`: usuarios, roles, catálogos…)
- `ALIADO` → validador y registro de uso (portal aliado — en construcción)
- `AFILIADO` → portal propio + carnet digital (en construcción)
- `PROMOTOR` → dashboard de ventas (en construcción)

Navegación condicional por rol/permiso. Layout `dashboard.vue` adapta el sidebar; el control de acceso se hace con middleware (`auth.global`, `can`, `role`), el composable `usePermissions()` y la directiva `v-can`.

## Cómo correr

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

API backend vía `NUXT_PUBLIC_API_BASE_URL` (ver [`README.md`](README.md) → Environment variables).

## Estado actual

Bootstrap completo: auth (login/recuperación), RBAC editable (usuarios + roles + permisos), catálogos, layouts, middleware, i18n, imagen Docker y CI/CD ya construidos. Portales aliado/afiliado/promotor y módulos de negocio (afiliados, membresías, pagos, validador) **pendientes**. Ver [`.ai/context/current-state.md`](.ai/context/current-state.md) y [`.ai/checklist.md`](.ai/checklist.md).
