# Skills y MCP servers (frontend)

Inventario de skills, plugins de Claude Code y servidores MCP que asisten la construcción de este repo (**Nuxt 4** SPA + Nuxt UI + Tailwind + Pinia).

> **Cómo instalarlos:** ver [`playbooks/install-skills.md`](playbooks/install-skills.md).
> **MCP de Nuxt:** ver [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).
>
> **Disponibilidad:** 🟢 = disponible en el entorno Claude Code (o built-in) · 🟡 = a instalar (plugin externo / marketplace).

---

## 1. Skills UI/UX

Para las vistas pendientes (verticales 3–10 del [`checklist.md`](checklist.md)).

### 🟡 `ui-ux-pro-max` ([nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill))

Generador de **design system** completo a partir de los requerimientos del proyecto (67 estilos UI, 161 paletas, 57 pairings de fuentes, guidelines UX). Soporta Vue/Nuxt.

**Cuándo invocar:**
- Antes de crear una vista nueva con identidad fuerte (carnet digital, dashboards).
- Pedir un audit de coherencia visual cross-rol.

**Restricción local:** la paleta heredada (`#245E9E`, `#9FD537`, `#1094C5`) ya está congelada — ver [`context/design-tokens.md`](context/design-tokens.md). Usar el skill para **expandir** (estados, neutros, semánticos), no para reemplazarla.

### 🟡 `impeccable` ([pbakaus/impeccable](https://github.com/pbakaus/impeccable))

**Pulido y crítica** de diseño (23 comandos slash, 27 reglas anti-pattern).

| Comando | Uso |
|---|---|
| `/audit <componente>` | Auditoría completa contra reglas |
| `/polish <componente>` | Refina espaciado, jerarquía, motion |
| `/critique <componente>` | Crítica con razonamiento |
| `/animate <componente>` | Añade motion design coherente |
| `/bolder` · `/quieter` | Ajusta peso visual |

**Cuándo invocar:** tras crear un componente Nuxt UI; en PRs con cambios de UI; pasada de QA visual pre-release.

### 🟢 `design-is` (Dieter Rams audit)

Audita un diseño contra los 10 principios de Rams y deriva un plan. Útil como **segunda opinión** independiente de `impeccable` antes de un release o en rediseños.

> **No invocar `ui-ux-pro-max` e `impeccable` a la vez** para una misma vista: el primero genera, el segundo pule.

---

## 2. Nuxt — código y visibilidad de la app

### 🟢 Agente `nuxt-expert` (`.claude/agents/`)

Archivo: [`../.claude/agents/nuxt-expert.md`](../.claude/agents/nuxt-expert.md) · modelo: `sonnet`. Desarrollador senior **Nuxt 4 / Vue 3 / Pinia / TypeScript** que genera código con plantillas estrictas (types, stores, composables, componentes, páginas) y TS sin `any`.

**Trigger:** crear/modificar componentes, pages, layouts, middleware; módulos/plugins; tipos TS; **SSR/SSG/hybrid rendering** (relevante para la tarea de migración a Universal — vertical-10).

**Invocación:** `Task` tool con `subagent_type: nuxt-expert`.

> Los agentes en `.claude/agents/` **sí van al repo** — son configuración compartida del equipo.

### 🟡 MCP `nuxt-mcp-dev`

Expone la app **corriendo en dev** como servidor MCP (routes, componentes auto-importados, módulos, runtime config). Ya está cableado en `nuxt.config.ts`; endpoint `http://localhost:3000/__mcp/sse`.

> ⚠️ **Experimental** (upstream). Solo en dev local, nunca en build de producción. Detalles: [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).

---

## 3. Infra / deploy

La imagen Docker + CI ya existen ([ADR 0006](decisions/0006-ci-cd-docker-runtime-config.md)); estos skills aplican al mantenimiento y a la **migración a Universal/SSR** (vertical-10).

| Skill | Disp. | Para qué |
|---|---|---|
| `docker-expert` · `docker-compose-orchestration` | 🟢 | Dockerfiles multi-stage; al migrar a SSR, imagen Node en vez de Nginx estático |
| `github-actions-docs` | 🟢 | Mantener `.github/workflows/ci.yaml` y `publish.yaml` |
| `traefik` | 🟢 | Wiring del servicio frontend tras Traefik v3 en el hub |
| `cloudflare` | 🟢 | DNS / R2 / Cloudflare del despliegue |

---

## 4. Seguridad

El frontend es 100% auth/RBAC (JWT, cookies httpOnly, refresh, permisos por rol) → conviene apoyo de seguridad.

| Skill | Disp. | Para qué |
|---|---|---|
| `owasp-security` | 🟢 | XSS, manejo de tokens, almacenamiento seguro, OWASP Top 10 en el cliente |
| `api-security-best-practices` | 🟢 | Consumo seguro de la API, validación de inputs, authz en cliente |
| `/security-review` (built-in) | 🟢 | Revisión de seguridad del diff en PRs sensibles (login, permisos) |

---

## 5. QA y extras

| Skill | Disp. | Para qué |
|---|---|---|
| `web-app-testing` (marketplace Anthropic) | 🟡 | Playwright para los E2E del vertical-10 (registro, pago, validador) |
| `document-skills` (marketplace Anthropic) | 🟡 | Generar PDFs: carnet digital (vertical-9), comprobantes de pago (vertical-6) |
| `mcp-server-generation` (marketplace Anthropic) | 🟡 | Si hiciera falta un MCP propio (opcional) |

---

## 6. Built-ins de Claude Code (sin instalar)

- 🟢 **`/code-review`** — revisar el diff (bugs + simplificación) antes de mergear.
- 🟢 **`/verify`** · **`/run`** — correr la app y validar un cambio en la práctica.
- 🟢 **`/security-review`** — ver sección 4.

---

## 7. Marketplace oficial de Anthropic

```
/plugin marketplace add anthropics/skills
```

Incluye `web-app-testing`, `document-skills`, `mcp-server-generation` (sección 5).

---

## 8. Reglas operativas

1. **Scope:** los skills/plugins se instalan **solo en este repo** (`./.claude/`). No tocar `~/.claude/`.
2. **Versionado:** según [`.gitignore`](../.gitignore), `.claude/{plugins,skills,cache}/` y `.claude/settings.local.json` **NO se commitean**. Lo único versionado es **`.claude/agents/`** (config compartida del equipo, ej. `nuxt-expert.md`).
3. **Conflictos:** si un skill recomienda algo que contradice un ADR local ([`decisions/`](decisions/)), **prevalece el ADR**. Documentar la divergencia en el ADR.
4. **MCP Nuxt:** experimental, solo dev local.
5. **No invocar simultáneamente** `ui-ux-pro-max` e `impeccable` para una misma vista.

---

## 9. Orden recomendado de adopción

El bootstrap (FASE 0/1) ya está hecho; el proyecto está en **FASE 5 (vistas por vertical)**.

1. **Para cada vista nueva (verticales 3–10):**
   - Generar con `nuxt-expert` (+ `nuxt-mcp-dev` activo en dev).
   - Diseño con `ui-ux-pro-max`, pulir con `impeccable` (`/audit`, `/polish`).
2. **En PRs sensibles (auth, permisos, pagos):**
   - `/code-review` + `/security-review` (+ `owasp-security` / `api-security-best-practices`).
3. **Para la migración a Universal/SSR (vertical-10):**
   - `nuxt-expert` (rendering) + `docker-expert` + `github-actions-docs` + `traefik`.
4. **QA / pre-release:**
   - `web-app-testing` (E2E), `design-is` / `impeccable` `/critique` por flujos críticos (login, validador, carnet, pago).
5. **Documentos (verticales 6 y 9):**
   - `document-skills` para carnet digital y comprobantes PDF.
