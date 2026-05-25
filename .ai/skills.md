# Skills y MCP servers (frontend)

Inventario de skills, plugins de Claude Code y servidores MCP que asisten la construcción de este repo (Nuxt 3 + Nuxt UI + Tailwind + Pinia).

> **Cómo instalarlos:** ver [`playbooks/install-skills.md`](playbooks/install-skills.md).
> **MCP de Nuxt (post-bootstrap):** ver [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).

---

## 1. Skills UI/UX (instalación por slash command `/plugin`)

Ambos se distribuyen como **plugins de Claude Code** vía marketplace.

### `ui-ux-pro-max` ([nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill))

Generador de **design system** completo a partir de los requerimientos del proyecto.

| Asset | Cantidad |
|---|---|
| Estilos UI (Glassmorphism, Claymorphism, Minimalism…) | 67 |
| Paletas alineadas a vertical | 161 |
| Pairings de fuentes (Google Fonts) | 57 |
| Reglas de razonamiento por industria | 161 |
| Stacks soportados (Vue/Nuxt incluido) | 15 |
| Guidelines UX + anti-patterns | 99 |

**Cuándo invocar:**
- Bootstrap del diseño inicial (Tarea 1.9 — paleta, tipografía, tokens).
- Antes de crear una vista nueva con requerimientos de identidad fuerte.
- Pedir un audit de coherencia visual cross-rol.

**Restricción local:** la paleta heredada (`#245E9E`, `#9FD537`, `#1094C5`) ya está congelada — ver [`context/design-tokens.md`](context/design-tokens.md). Usar el skill para **expandir** la paleta (estados, neutros, semánticos), no para reemplazarla.

### `impeccable` ([pbakaus/impeccable](https://github.com/pbakaus/impeccable))

**Pulido y crítica** de diseño con 23 comandos slash y 27 reglas anti-pattern deterministas.

| Comando | Uso |
|---|---|
| `/audit <componente>` | Auditoría completa contra reglas |
| `/polish <componente>` | Refina espaciado, jerarquía, motion |
| `/critique <componente>` | Crítica con razonamiento |
| `/animate <componente>` | Añade motion design coherente |
| `/bolder` / `/quieter` | Ajusta peso visual |

**Cuándo invocar:**
- Después de crear un componente Nuxt UI para refinarlo.
- Antes de un release para hacer pasada de QA visual.
- En PRs con cambios de UI sensibles.

Referencias de dominio: typography, color, motion, spatial, interaction, responsive, UX writing.

---

## 2. MCP Server — `nuxt-mcp-dev` (post-bootstrap)

Módulo Nuxt de Anthony Fu que expone tu app **corriendo en dev** como servidor MCP, dando a Claude Code visibilidad completa de routes, componentes auto-importados, módulos, runtime config y hooks.

```ts
// nuxt.config.ts  (añadir en Tarea 1.9)
export default defineNuxtConfig({
  modules: ['nuxt-mcp-dev'],
})
```

Auto-configura Claude Code en el primer `pnpm dev`. Endpoint: `http://localhost:3000/__mcp/sse`.

> ⚠️ Marcado como **experimental** por upstream. Solo activar en dev local, nunca en build de producción.

Detalles completos: [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).

---

## 3. Agentes de Claude Code (`.claude/agents/`)

A diferencia de los skills (consejos puntuales) y plugins (extensiones globales), los **agentes** son sub-procesos especializados con instrucciones detalladas, modelo propio y se invocan vía la Task tool.

### `nuxt-expert`

Archivo: [`.claude/agents/nuxt-expert.md`](../.claude/agents/nuxt-expert.md) · modelo: `sonnet`

Desarrollador senior experto en **Nuxt 4+ / Vue 3 / Pinia / TypeScript**. Genera código siguiendo plantillas estrictas (types, constants, stores, composables, componentes, páginas, API routes) y reglas TypeScript sin `any`.

**Trigger automático:**
- Crear/modificar componentes, pages, layouts, middleware Nuxt.
- Implementar server API routes.
- Configurar módulos, plugins, build settings.
- Trabajar con composables y auto-imports.
- Tipos TypeScript para features Nuxt.
- SSR/SSG/hybrid rendering.

**Invocación manual:** desde otro agente o desde Claude principal vía Task tool con `subagent_type: nuxt-expert`.

**Pre-condición clave (regla del propio agente):** debe consultar MCP antes de responder. Cuando esté instalado `nuxt-mcp-dev` (post Tarea 1.9) usará el SSE local; antes de eso debe apoyarse en documentación oficial.

> Los agentes en `.claude/agents/` **sí van al repo** — son configuración compartida del equipo, no estado local.

---

## 4. Marketplace oficial de Anthropic (opcional)

```
/plugin marketplace add anthropics/skills
```

Skills útiles del bundle:
- `web-app-testing` — Playwright para los E2E de Tarea 5.12.
- `mcp-server-generation` — útil si necesitamos un MCP propio (ej. expone catálogo de planes).
- `document-skills` — generar PDFs (carnet digital, comprobantes de pago).

---

## 5. Reglas operativas

1. **Scope:** todos los skills se instalan **solo en este repo** (`./.claude/skills/` o `./.claude/plugins/`). No tocar `~/.claude/`.
2. **Versionado:** NO commitear `.claude/skills/*` ni `.claude/plugins/*` (ya están en `.gitignore` salvo `.claude/settings.local.json` que sí va a `.gitignore`). Ver `.gitignore`.
3. **Conflictos:** si un skill recomienda algo que contradice un ADR local (`decisions/00xx-*.md`), **prevalece el ADR**. Documentar la divergencia en el ADR.
4. **MCP Nuxt:** solo se activa cuando exista `nuxt.config.ts` (post Tarea 1.9). Antes de eso no aplica.
5. **No invocar simultáneamente** `ui-ux-pro-max` y `impeccable` para una misma vista: usar el primero para generar, el segundo para pulir.

---

## 6. Orden recomendado de adopción

1. **Hoy (pre-bootstrap):**
   - Instalar `ui-ux-pro-max` → expandir la paleta heredada a tokens completos.
   - Instalar `impeccable` → tener los comandos listos.
2. **Durante Tarea 1.9 (bootstrap Nuxt):**
   - Añadir `nuxt-mcp-dev` al `nuxt.config.ts`.
3. **Durante Tarea 5.x (vistas por módulo):**
   - Generar componentes con apoyo de los skills.
   - Pulir con `/audit` y `/polish` antes de mergear.
4. **Pre-release:**
   - Pasada `/critique` por flujos críticos (login, validador, carnet, pago).
