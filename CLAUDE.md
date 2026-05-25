# optisalud-plus-frontend

Frontend admin/multi-rol del ecosistema **OptiSalud Plus**. Nuxt 3 + Nuxt UI + Tailwind CSS + Pinia.

**Parte del ecosistema:** [centro-optico-vicente](https://github.com/fenix-core/centro-optico-vicente) (hub maestro)

## Documentación

Toda la documentación para asistencia IA vive en [`.ai/`](.ai/). **Empezar por [`.ai/CLAUDE.md`](.ai/CLAUDE.md)**.

Para decisiones cross-stack (infraestructura, modelo de datos, contracts REST con backend), ver el **hub maestro**: [`../centro-optico-vicente/.ai/`](../centro-optico-vicente/.ai/).

| Necesito | Archivo |
|---|---|
| Brief de entrada al frontend | [`.ai/CLAUDE.md`](.ai/CLAUDE.md) |
| Checklist (tareas frontend) | [`.ai/checklist.md`](.ai/checklist.md) |
| Estructura del proyecto | [`.ai/specs/01-project-structure.md`](.ai/specs/01-project-structure.md) |
| Cliente API y auth | [`.ai/specs/04-api-client.md`](.ai/specs/04-api-client.md) |
| Sistema de permisos | [`.ai/specs/09-permissions.md`](.ai/specs/09-permissions.md) |
| Playbooks (nueva página, form, tabla) | [`.ai/playbooks/`](.ai/playbooks/) |
| Skills + MCP de Claude Code | [`.ai/skills.md`](.ai/skills.md) · [`.ai/playbooks/install-skills.md`](.ai/playbooks/install-skills.md) |
| Agente Nuxt experto | [`.claude/agents/nuxt-expert.md`](.claude/agents/nuxt-expert.md) |

## Stack

- **Vue 3** + **Nuxt 3** (modo SPA o universal a decidir)
- **Nuxt UI** (componentes accesibles, Tailwind incluido)
- **Pinia** (state management)
- **VueUse** (composables utility)
- **@nuxtjs/i18n** (español default)
- **vee-validate + zod** (forms)
- **$fetch** nativo con interceptor JWT

## Multi-rol

El mismo app sirve a:
- ADMIN, OPERADOR → panel administrativo (`/admin/*`)
- ALIADO_USER → validador y registro uso (`/aliado/*`)
- AFILIADO_USER → portal propio + carnet digital (`/afiliado/*`)
- PROMOTOR → dashboard ventas (`/promotor/*`)

Navegación condicional por rol. Layout `dashboard.vue` adapta sidebar según permisos.

## Cómo correr

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

API backend en `http://localhost:8080` (configurable via env).

## Estado actual

**Repo completamente vacío**. Bootstrap pendiente (Tarea 1.9 del checklist). Ver [`.ai/context/current-state.md`](.ai/context/current-state.md).
