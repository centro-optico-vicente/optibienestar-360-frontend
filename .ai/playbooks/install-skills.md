# Playbook — Instalar skills y MCP servers

Pasos exactos para dejar el repo equipado con `ui-ux-pro-max`, `impeccable` y (post-bootstrap) `nuxt-mcp-dev`.

> **Quién ejecuta qué:** los slash commands (`/plugin ...`, `/mcp`) los corre el usuario dentro de Claude Code. Los comandos bash los puede correr Claude o tú.

---

## Paso 0 — Prerequisitos

```bash
# El default del sistema es Node v14, que es demasiado viejo.
nvm use 22
node --version    # debe imprimir v22.x
```

Para que persista por sesión de terminal podés agregar `nvm use 22` a tu `.bashrc`/`.zshrc`, o crear un `.nvmrc` en el repo (recomendado tras bootstrap).

---

## Paso 1 — Instalar `ui-ux-pro-max`

**Dentro de Claude Code, ejecutar:**

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
```

```
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

**Verificación:**

```
/plugin list
```

Debe aparecer `ui-ux-pro-max` como instalado. Probar invocándolo:

> "Genera la expansión de la paleta heredada (#245E9E, #9FD537, #1094C5) con estados (success/warning/error), neutros y semánticos, para un panel admin de salud."

---

## Paso 2 — Instalar `impeccable`

**Dentro de Claude Code:**

```
/plugin marketplace add pbakaus/impeccable
```

```
/plugin install impeccable@impeccable
```

**Verificación:**

```
/audit --help
```

Debe listar comandos (`/audit`, `/polish`, `/critique`, `/animate`, etc.).

---

## Paso 3 — (Opcional) Marketplace oficial Anthropic

```
/plugin marketplace add anthropics/skills
/plugin install web-app-testing@anthropic-agent-skills
```

Solo `web-app-testing` por ahora (lo usaremos en Tarea 5.12 para los E2E Playwright). El resto del bundle es opcional.

---

## Paso 4 — `nuxt-mcp-dev` (POST Tarea 1.9)

> ⚠️ **No ejecutar hasta que exista `nuxt.config.ts`** (después del `npx nuxi init .`).

```bash
nvm use 22
pnpm add -D nuxt-mcp-dev
```

Editar `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    ...(process.env.NODE_ENV === 'development' ? ['nuxt-mcp-dev'] : []),
  ],
})
```

**Levantar dev y verificar:**

```bash
pnpm dev
```

En otra ventana de Claude Code:

```
/mcp
```

Debe listar `nuxt-mcp-dev` como conectado. Si no, agregar manualmente `.mcp.json` en la raíz (ver [`../specs/11-mcp-servers.md`](../specs/11-mcp-servers.md)).

---

## Paso 5 — Post-install

1. Confirmar que `.claude/plugins/` y `.claude/skills/` están en `.gitignore` (cada dev instala lo suyo).
2. Actualizar [`../context/current-state.md`](../context/current-state.md) con la fecha de instalación y skills activos.
3. Hacer commit únicamente de los cambios en `.ai/` (specs y este playbook).

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `/plugin marketplace add` falla con error de red | Repo privado o tipo de URL | Confirmar que el repo es público; reintentar |
| `uipro-cli` falla con `ENGINE_INCOMPATIBLE` | Node v14 activo | `nvm use 22` antes |
| `nuxt-mcp-dev` no aparece en `/mcp` | Dev server caído o módulo no cargado | `pnpm dev` corriendo; revisar consola Nuxt por errores del módulo |
| Skills no se autocompletan tras instalar | Cache de Claude Code | Reiniciar Claude Code |
| `impeccable` instala pero `/audit` no existe | Plugin no activado | `/plugin list` y `/plugin enable impeccable` |

---

## Desinstalar

```
/plugin uninstall ui-ux-pro-max
/plugin uninstall impeccable
/plugin marketplace remove nextlevelbuilder/ui-ux-pro-max-skill
/plugin marketplace remove pbakaus/impeccable
```

Para `nuxt-mcp-dev`:

```bash
pnpm remove nuxt-mcp-dev
# luego eliminar la línea del array modules en nuxt.config.ts
```
