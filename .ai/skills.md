# Skills y MCP servers (frontend)

Inventario de skills, plugins de Claude Code y servidores MCP que asisten la construcción de este repo (**Nuxt 4** SPA + Nuxt UI + Tailwind + Pinia).

> **Cómo instalarlos:** ver [`playbooks/install-skills.md`](playbooks/install-skills.md).
> **MCP de Nuxt:** ver [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).
>
> **Encaje:** 🟢 alto · 🟡 limitado/opcional · 🔴 no aplica a este repo.

---

## 1. Instalados en el repo (`.claude/skills/`)

> Inventariados en [`../skills-lock.json`](../skills-lock.json). No se versionan los SKILL.md (`.gitignore` ignora `.claude/skills/`), pero el lock sí documenta qué tiene cada dev.

### UI / diseño

| Skill | Encaje | Para qué |
|---|---|---|
| `ui-ux-pro-max` | 🟢 | Design system: estilos, paletas, font pairings, guidelines UX, charts. |
| `nuxt-ui` | 🟢 | Componentes `@nuxt/ui`. **Nota:** apunta a v4; el repo está en `@nuxt/ui ^3` (ver tarea de migración v4 en vertical-10). |
| `web-design-guidelines` | 🟢 | Auditar UI contra Web Interface Guidelines + accesibilidad. |

### Vue / Nuxt — código

| Skill | Encaje | Para qué |
|---|---|---|
| `vue-best-practices` | 🟢 | Composition API + `<script setup>` + TS + Pinia + Vite. |
| `vue-debug-guides` | 🟢 | Debugging Vue 3, runtime/async, **SSR/hidratación** (útil para la migración SSR). |
| `vue` | 🔴 | Renderer de `@json-render/vue` (UIs desde specs JSON). **El repo no usa json-render** → considerar desinstalar. |

### Infra / deploy

| Skill | Encaje | Para qué |
|---|---|---|
| `docker-expert` | 🟢 | Dockerfiles multi-stage, optimización/hardening de la imagen ([ADR 0006](decisions/0006-ci-cd-docker-runtime-config.md)). |
| `docker-compose-orchestration` | 🟢 | Wiring del servicio frontend en el compose del hub. |
| `github-actions-docs` | 🟢 | Mantener `.github/workflows/ci.yaml` y `publish.yaml`. |
| `traefik` | 🟢 | Reverse proxy v3 del hub (labels, routers, TLS). |
| `wrangler` | 🟡 | CLI de **Cloudflare Workers/Pages**. El deploy es **VPS Contabo + Docker + Traefik** (no Workers), y Cloudflare se usa solo para DNS/R2 → de poco uso salvo que se adopten Workers/Pages. El skill general `cloudflare` sería más apto para DNS/R2 si hiciera falta. |

### Otros

| Skill | Encaje | Para qué |
|---|---|---|
| `tailwind` | 🟡 | Cubre Tailwind v4 **browser-runtime (HyperFrames)**; aquí Tailwind es **build-time vía Nuxt UI**. Útil solo como referencia de sintaxis v4. |
| `typescript-mcp-server-generator` | 🟡 | Generar un MCP propio en TS (futuro/opcional). |

**Limpieza sugerida:** `vue` (🔴, no aplica). Revisar `wrangler` y `tailwind` (🟡) si no se usan Workers/Pages ni el runtime de browser.

---

## 2. Agente + MCP de Nuxt

### 🟢 Agente `nuxt-expert` (`.claude/agents/`)

Archivo: [`../.claude/agents/nuxt-expert.md`](../.claude/agents/nuxt-expert.md) · modelo: `sonnet`. Senior **Nuxt 4 / Vue 3 / Pinia / TS**. Trigger: componentes, pages, layouts, middleware, tipos, **SSR/SSG/hybrid**. Invocación: `Task` tool con `subagent_type: nuxt-expert`.

> Los agentes en `.claude/agents/` **sí van al repo** — config compartida del equipo.

### 🟡 MCP `nuxt-mcp-dev`

App en dev como servidor MCP (routes, auto-imports, runtime config). Endpoint `http://localhost:3000/__mcp/sse`. **Experimental**, solo dev local. Detalles: [`specs/11-mcp-servers.md`](specs/11-mcp-servers.md).

---

## 3. Seguridad (🟢 disponibles en el entorno, NO instalados en el repo)

El frontend es 100% auth/RBAC (JWT, cookies httpOnly, refresh, permisos). Usables ya; instalar en el repo solo si se quieren pinear para el equipo.

| Skill | Para qué |
|---|---|
| `owasp-security` | XSS, manejo/almacenamiento de tokens, OWASP Top 10 en el cliente. |
| `api-security-best-practices` | Consumo seguro de la API, validación de inputs, authz en cliente. |
| `/security-review` (built-in) | Revisión de seguridad del diff en PRs sensibles (login, permisos). |

---

## 4. A instalar si se necesitan (🟡)

| Skill | Origen | Cuándo |
|---|---|---|
| `web-app-testing` | marketplace `anthropics/skills` | E2E Playwright — vertical-10 (QA) |
| `document-skills` | marketplace `anthropics/skills` | PDFs: carnet digital (vertical-9), comprobantes (vertical-6) |
| `impeccable` / `design-is` | externos / claude-mem | Auditoría de UI extra (opcional; ya cubierto por `web-design-guidelines`) |

---

## 5. Built-ins de Claude Code (sin instalar)

- **`/code-review`** — diff (bugs + simplificación) antes de mergear.
- **`/verify`** · **`/run`** — correr la app y validar un cambio.
- **`/security-review`** — ver §3.

---

## 6. Reglas operativas

1. **Scope:** skills/plugins solo en este repo (`./.claude/`). No tocar `~/.claude/`.
2. **Versionado:** según [`.gitignore`](../.gitignore), `.claude/{plugins,skills,cache}/` y `.claude/settings.local.json` **NO se commitean**. Lo único versionado es **`.claude/agents/`** (ej. `nuxt-expert.md`). El inventario de skills vive en [`../skills-lock.json`](../skills-lock.json).
3. **Conflictos:** si un skill contradice un ADR local ([`decisions/`](decisions/)), **prevalece el ADR**. Documentar la divergencia.
4. **MCP Nuxt:** experimental, solo dev local.
5. **No invocar simultáneamente** un generador (`ui-ux-pro-max`) y un auditor (`web-design-guidelines`) para la misma vista: primero generar, después auditar.

---

## 7. Orden recomendado de adopción

El bootstrap (FASE 0/1) ya está hecho; el proyecto está en **FASE 5 (vistas por vertical)**.

1. **Cada vista nueva (verticales 3–10):**
   - Código con `nuxt-expert` + `vue-best-practices` (+ `nuxt-mcp-dev` en dev) + `nuxt-ui`.
   - Diseño con `ui-ux-pro-max`; auditar con `web-design-guidelines`.
2. **PRs sensibles (auth, permisos, pagos):**
   - `/code-review` + `/security-review` (+ `owasp-security` / `api-security-best-practices`).
3. **Deploy / debug / migración SSR (vertical-10):**
   - `docker-expert` + `docker-compose-orchestration` + `github-actions-docs` + `traefik`; `vue-debug-guides` + `nuxt-expert` para el rendering.
4. **QA / pre-release:**
   - `web-app-testing` (E2E) + `web-design-guidelines` por flujos críticos (login, validador, carnet, pago).
5. **Documentos (verticales 6 y 9):**
   - `document-skills` para carnet digital y comprobantes PDF.
