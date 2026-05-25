# `.ai/` — Contexto IA del frontend

Esta carpeta contiene la documentación específica del frontend admin Nuxt 3. Para visión cross-stack, ver [hub maestro](../../centro-optico-vicente/.ai/).

## Estructura

```
.ai/
├── CLAUDE.md
├── README.md
├── checklist.md            # Subset frontend del checklist maestro
├── skills.md
│
├── context/
│   ├── MEMORY.md
│   ├── current-state.md
│   └── design-tokens.md    # Paleta heredada del landing
│
├── specs/
│   ├── 00-overview.md
│   ├── 01-project-structure.md
│   ├── 02-routing-layouts.md
│   ├── 03-state-management.md
│   ├── 04-api-client.md
│   ├── 05-auth-flow.md
│   ├── 06-i18n.md
│   ├── 07-forms.md
│   ├── 08-tables.md
│   ├── 09-permissions.md
│   ├── 10-design-system.md
│   └── 11-mcp-servers.md
│
├── decisions/
│   ├── 0001-nuxt-ui-tailwind.md
│   ├── 0002-pinia-state.md
│   ├── 0003-spa-mode.md
│   └── 0004-mobile-first.md
│
└── playbooks/
    ├── new-page.md
    ├── new-form.md
    ├── new-table.md
    ├── new-role-views.md
    └── install-skills.md
```

## Cómo navegarla

| Cuando necesites… | Ve a |
|---|---|
| Onboarding | [`CLAUDE.md`](CLAUDE.md) |
| Qué hacer hoy | [`checklist.md`](checklist.md) |
| Estructura del proyecto | [`specs/01-project-structure.md`](specs/01-project-structure.md) |
| Cómo hacer requests al backend | [`specs/04-api-client.md`](specs/04-api-client.md) |
| Cómo manejo auth/login | [`specs/05-auth-flow.md`](specs/05-auth-flow.md) |
| Cómo mostrar/ocultar por permiso | [`specs/09-permissions.md`](specs/09-permissions.md) |
| Crear página/form/tabla | [`playbooks/`](playbooks/) |
| Paleta de colores | [`context/design-tokens.md`](context/design-tokens.md) |
| Skills y MCP de Claude Code | [`skills.md`](skills.md) + [`playbooks/install-skills.md`](playbooks/install-skills.md) |
| MCP de Nuxt (post-bootstrap) | [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md) |
