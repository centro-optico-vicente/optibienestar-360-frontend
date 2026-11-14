# optibienestar-360-frontend

Panel admin y portales de **OptiBienestar 360**: Nuxt 4 **SPA** (`ssr: false`) + Vue 3 + Nuxt UI v4 + Tailwind v4 + Pinia + VueUse + `@nuxtjs/i18n` (es/en) + vee-validate/zod. Imagen Docker con Nginx y config en runtime. Docs del repo en `.ai/` (español); visión cross-stack en el hub [`../centro-optico-vicente`](https://github.com/fenix-core/centro-optico-vicente/tree/main/.ai) (ADR sin prefijo = del hub; `LOC-` = de este repo).

Código en `app/{pages,components,composables,stores,middleware,plugins,layouts,types,utils}`; traducciones en `i18n/locales/{es,en}.json`.

**Roles** (`ROLES` en `app/types/auth.ts`): `SYSTEM`/`ADMINISTRADOR`/`OPERADOR` → `/dashboard/*`; `ALIADO` → `/allies/*`; `AFILIADO` → `/members/*`; `ASESOR` → `/advisors/*`. Públicas en español (`/aliados`, `/afiliarse`, `/solicitar-alianza`…), con par en inglés bajo `/en/*`.

## Reglas duras

1. **Sin lógica de negocio** (precios, comisiones, solvencia): eso lo calcula el backend. El frontend valida formato y muestra.
2. **API solo vía `useApi()`** (`$fetch` + JWT); nunca axios. Listados usan el DTO compacto; los formularios de editar **cargan el detalle** con `GET /{uuid}`, nunca reutilizan la fila del listado.
3. **Permisos:** `usePermissions()`, directiva `v-can` y middleware (`auth.global`, `can`, `role`). Permisos granulares por acción.
4. **Sesión:** access token en `sessionStorage`, refresh en `localStorage` ([ADR 0024 del hub](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0024-jwt-token-storage.md)); no cookies httpOnly.
5. **Textos:** nada literal en plantillas; todo por clave i18n en **es y en**. Código, comentarios y commits en inglés. Términos del glosario (ASESOR/`advisor`, nunca "promotor" en UI ni URL).
6. **Selects** alimentados por catálogo/`/options` del backend, no listas fijas ([LOC-0005](.ai/decisions/loc-0005-catalog-backed-selects.md)).
7. **Git:** nunca commit a `main`; rama `<tipo>/<kebab>` con `--no-track`; sin `Co-Authored-By`. Requiere **Node ≥ 20** (`nvm use 20`).

## Archivos que NO se leen enteros

| Archivo | Usar en su lugar |
|---|---|
| `i18n/locales/{es,en}.json` (~300 KB c/u) | `node scripts/i18n-tool.mjs get/keys/find/set/rm/mv …` |
| `app/types/api.d.ts` (generado desde OpenAPI) | `grep -n 'NombreDto' app/types/api.d.ts` y leer solo ese rango |
| `pnpm-lock.yaml` | `grep` del paquete |
| Páginas muy grandes (ej. `dashboard/commission-rules/index.vue`, ~100 KB) | `grep -n` y leer por rangos |

## Qué leer según la tarea

| Tarea | Leer / usar |
|---|---|
| Nueva página, formulario, tabla, vistas de rol | skills `new-page`, `new-form`, `new-table` |
| Convención de un área | `.ai/specs/NN-*.md`: estructura 01, rutas/layouts 02, estado 03, API 04, auth 05, i18n 06, forms 07, tablas 08, permisos 09, diseño 10, búsqueda 14 |
| ¿Ya está decidido? | `.ai/decisions/README.md` (locales) y el índice del hub `../centro-optico-vicente/.ai/decisions/README.md` |
| Forma de un DTO / endpoint | `app/types/api.d.ts` (grep) o el controller en `../optibienestar-360-backend` |
| Qué existe / qué falta | `.ai/context/current-state.md` · `.ai/checklist.md` → `.ai/checklists/` |

Reglas extra que se cargan solas al tocar `pages/`, `i18n/` o composables/stores: `.claude/rules/`. Para dudas de Nuxt/Vue complejas: subagente `nuxt-expert`.

## Comandos

```bash
pnpm install && pnpm dev       # http://localhost:3000 (API: NUXT_PUBLIC_API_BASE_URL)
pnpm typecheck                 # vue-tsc
pnpm i18n:check                # paridad es/en
pnpm api:generate              # regenerar app/types/api.d.ts
```
