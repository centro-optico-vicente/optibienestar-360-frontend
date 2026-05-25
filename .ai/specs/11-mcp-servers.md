# 11 — MCP servers

Servidores [Model Context Protocol](https://modelcontextprotocol.io) que asisten al desarrollo del frontend dándole a Claude Code visibilidad introspectiva del proyecto Nuxt en vivo.

---

## 1. `nuxt-mcp-dev` (Anthony Fu)

Repo: https://github.com/antfu/nuxt-mcp · npm: `nuxt-mcp-dev` · estado: **experimental**.

### Qué expone a Claude Code

Cuando `pnpm dev` está corriendo, el MCP server entrega información en vivo sobre:

- Estructura de `pages/` y rutas generadas (file-based routing).
- Componentes auto-importados (resueltos por Nuxt).
- Módulos activos y su configuración.
- `runtimeConfig` y variables de entorno expuestas.
- Hooks de build y rendering.
- Composables auto-importados desde `composables/`.
- Stores Pinia detectados (vía `@pinia/nuxt`).

Esto significa que Claude Code puede preguntar al proyecto **corriendo** en vez de inferir desde archivos estáticos.

### Instalación

Solo aplica **después** de Tarea 1.9 (cuando exista `nuxt.config.ts`).

```bash
nvm use 22                    # requiere Node ≥18
pnpm add -D nuxt-mcp-dev
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    'nuxt-mcp-dev',           // <- solo en dev
  ],
})
```

> **Tip:** condicionar por entorno para no shippearlo al build prod:
> ```ts
> modules: [
>   '@nuxt/ui',
>   ...(process.env.NODE_ENV === 'development' ? ['nuxt-mcp-dev'] : []),
> ],
> ```

### Auto-configuración de Claude Code

Al ejecutar `pnpm dev`, el módulo detecta el editor activo (VS Code, Cursor, Windsurf, **Claude Code**) y **actualiza automáticamente** los archivos de configuración correspondientes. No requiere editar manualmente `.mcp.json`.

### Endpoint

`http://localhost:3000/__mcp/sse` (Server-Sent Events).

Si Claude Code necesita configuración manual, agregar a `.mcp.json` en la raíz del repo:

```json
{
  "mcpServers": {
    "nuxt-mcp-dev": {
      "type": "sse",
      "url": "http://localhost:3000/__mcp/sse"
    }
  }
}
```

### Verificación

1. `pnpm dev` corriendo.
2. En Claude Code: `/mcp` → debe aparecer `nuxt-mcp-dev` como conectado.
3. Probar: pedir "lista las rutas registradas en la app". Claude debe responder con datos en vivo del runtime, no de leer `pages/`.

### Restricciones

- **Dev only.** Nunca incluir en build de producción (riesgo de exponer estructura interna).
- Requiere `pnpm dev` activo — si está caído, las herramientas MCP fallan.
- Marcado como **experimental** por el autor; revisar cada minor release antes de upgrade.

---

## 2. Servidores MCP candidatos (no instalados aún)

### `@nuxtjs/mcp-toolkit`

Para **construir** servidores MCP propios dentro de la app Nuxt (no para consumirlos). Útil si en el futuro queremos exponer dominio del negocio (planes, comisiones, validaciones) como herramientas MCP para asistentes — pero eso pertenece al **backend**, no al frontend admin. Evaluar antes de FASE 6.

### Anthropic skills marketplace

`/plugin marketplace add anthropics/skills` da acceso a:
- `mcp-server-generation` — para generar un MCP custom si surge la necesidad.

---

## 3. Cómo encaja con el resto del stack

| Componente | Provee a Claude Code |
|---|---|
| `nuxt-mcp-dev` | Estado runtime del Nuxt local (rutas, módulos, composables) |
| Skills UI/UX (`ui-ux-pro-max`, `impeccable`) | Conocimiento de diseño y reglas anti-pattern |
| `.ai/specs/*.md` | Decisiones congeladas y convenciones del proyecto |
| `CLAUDE.md` (root + `.ai/`) | Brief de entrada |

Los tres se combinan: el MCP da hechos del runtime, los skills dan recomendaciones, y los specs/CLAUDE.md dan las constraints del negocio.

---

## 4. Tareas relacionadas en el checklist

- Tarea 1.9 (cimientos) — añadir `nuxt-mcp-dev` al `nuxt.config.ts` al mismo tiempo que el resto de módulos.
- Tarea 5.12 (QA) — el MCP ayuda a Claude a generar tests Playwright que conozcan las rutas reales.
