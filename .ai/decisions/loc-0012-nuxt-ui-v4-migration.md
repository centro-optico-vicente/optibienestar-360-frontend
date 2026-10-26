# ADR LOC-0012 (frontend) — Migración de Nuxt UI v3 a v4

**Estado:** Aceptado (2026-10-25, dueño) — implementado en [PR #255](https://github.com/centro-optico-vicente/optibienestar-360-frontend/pull/255)
**Fecha:** 2026-10-25
**Decisores:** equipo OptiBienestar 360 (pendiente de aceptación del dueño)
**Origen:** tarea "Migrar `@nuxt/ui` v3 → v4" en [`vertical-10` §Dependencias](../checklists/vertical-10-optimizacion-reportes-hardening.md)
**Relacionado:** [ADR LOC-0001 Nuxt UI + Tailwind](loc-0001-nuxt-ui-tailwind.md) · [hub ADR 0001 Stack](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0001-stack.md) (cita "Nuxt UI v3") · [hub ADR 0004 only free tools](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0004-only-free-tools.md)

## Contexto

### Versiones reales (verificadas en `package.json` y `pnpm-lock.yaml` de `origin/main`, 2026-10-25)

La documentación estaba desactualizada en ambos sentidos; este es el estado real:

| Paquete | `package.json` | Resuelto en lockfile | Última publicada (npm) |
|---|---|---|---|
| `nuxt` | `^4.0.0` | **4.2.2** | 4.6.2 |
| `@nuxt/ui` | `^3.0.0` | **3.3.7** | 4.12.0 |
| `tailwindcss` / `@tailwindcss/vite` | `^4.3.0` | 4.3.0 | — |
| `reka-ui` (transitiva) | — | 2.6.0 | v4.12 fija 2.11.0 |
| `vue` | `^3.5.0` | 3.5.31 | — |
| `vite` | — | 7.3.1 | — |
| `zod` / `vee-validate` | `^3.23.0` / `^4.13.2` | 3.25.76 / 4.15.1 | — |

- `.nvmrc` = 22; `engines.node >=20`; CI usa Node 22.
- El **hub ADR 0001 dice "Nuxt 3"** para el frontend: es falso hoy (Nuxt 4 desde el scaffold, nunca enmendado — el propio ADR lo admite en su línea "migrado de Nuxt 3 a 4"). La parte "Nuxt UI v3" sí es cierta. Si este ADR se acepta, el hub ADR 0001 necesita enmienda de versiones.
- `^3.0.0` impide que pnpm suba a v4 sin editar `package.json`.

### Estado de v3

La última release de la rama 3.x en npm es **3.3.7 (2025-10-23)**; v4.0.0 salió el 2025-09-23 y hay 23 releases estables 4.x desde entonces (hoy 4.12.0, publicada 2026-10-15). **No hay parches 3.x desde hace ~12 meses** (inferencia del registro; no se confirmó una política oficial de soporte). Quedarse en v3 significa no recibir correcciones de Nuxt UI ni de Reka UI (v3.3.7 fija 2.6.0, v4.12 fija 2.11.0).

### Cambios incompatibles v3 → v4 (guía oficial)

Fuente: <https://ui.nuxt.com/docs/getting-started/migration/v4> (consultada 2026-10-25) y las notas de la release v4.0.0. **La guía declara que no hay codemod: todo es manual.** La release 4.0.0 es principalmente la fusión de Nuxt UI Pro en `@nuxt/ui`.

| Cambio | Aplica a este repo | Evidencia (grep en `origin/main`) |
|---|---|---|
| Requiere **Nuxt ≥ 4.1** | Cumple (4.2.2) | lockfile |
| Tailwind v4 | Cumple (4.3.0); v4.12 pide `^4.3.3` → bump menor del lockfile | `package.json` |
| `@nuxt/ui-pro` → `@nuxt/ui`, `uiPro` → `ui`, imports/CSS/vite plugin | **No aplica**: el repo nunca usó Pro | 0 coincidencias de `ui-pro`/`uiPro` |
| `UButtonGroup` → `UFieldGroup` | **Aplica** | 2 usos en 2 archivos: `ListRefreshMenu.vue`, `ReportPrintButton.vue` |
| `UPageMarquee` → `UMarquee`; `UPageAccordion` eliminado | No aplica | 0 usos |
| Modificador `nullify` → `nullable` (+ nuevo `optional`) en `UInput/UInputNumber/UTextarea` | No aplica | 0 usos de `.nullify` en `.vue` |
| `UForm`: las transformaciones del schema solo afectan los datos de `@submit`, ya no mutan el estado | **Revisar, riesgo bajo**: no hay transformaciones en los schemas | 46 `<UForm>` en 25 archivos; 0 `.transform(`/`z.coerce`/`.preprocess(` en `app/` |
| `UForm` anidados exigen `nested` + `name` | No aplica | Ningún `<UForm>` con `nested` o `:name=`; los archivos con 2-3 apariciones de `<UForm` son comentarios o formularios en modales distintos (revisado en los 6 archivos con más de una) |
| Utilidades de contenido (`findPageBreadcrumb/Headline`), componentes Chat/AI SDK | No aplica | 0 usos |

**Lo que la guía no cubre (no verificado):** cambios de comportamiento o de nombres de slots/variantes de tema entre 4.0 y 4.12 (23 minors). El repo tiene **62 usos de `:ui="…"`/`ui="…"` en 41 archivos** (50 de ellos sobrescriben el slot `content`, típicamente `UModal`), más la configuración de `app.config.ts` (colores `primary/secondary/info/warning/neutral`, `button.defaultVariants`) y `@theme static` en `main.css`. Si algún slot se renombró, el efecto es **visual y silencioso** (typecheck no lo detecta).

### Superficie de uso (conteo de etiquetas `<U…>` en `app/**/*.vue`)

`UButton` 731 · `UFormField` 644 · `UInput` 359 · `UIcon` 243 · `USelectMenu` 237 · `UTooltip` 192 · `UBadge` 149 · `UModal` 126 · `USkeleton` 75 · `UForm` 73 · `UTextarea` 53 · `UCheckbox` 50 · `UPagination` 47 · `USwitch` 43 · `UAlert` 20 · `UTabs` 13 · `USelect` 11 · `UPopover` 7 · `UDropdownMenu` 6 · `UInputNumber` 3 · `UCalendar` 3 · `USeparator` 2 · `UButtonGroup` 2 · `URadioGroup` 1 · `UApp` 1. **No hay `UTable`** (las tablas son propias), ni `UDashboard*`, `UPage*`, `UChat*`.

Además `app.vue` importa `es, en` desde `@nuxt/ui/locale` y usa `useToast` — que la API de locale y `useToast` se mantengan en v4 **no se verificó** contra la documentación v4.

### Premisas obsoletas de la tarea original

La tarea del checklist decía "hacerlo antes de construir los verticales 3–10 evita rework y habilita los componentes Pro (tablas/dashboards)". Hoy: los verticales ya están construidos (249 commits en `main`, ~70 páginas y 83 componentes); las tablas son propias y no hay planes de usar componentes Pro. El argumento de "evitar rework" ya no aplica; el de "Pro gratis" es opcional.

### Condiciones de prueba

Regla vigente: **no se corre build/typecheck/tests en local**; solo CI. El CI actual ejecuta `i18n:check`, `pnpm typecheck`, `pnpm generate` y un smoke de Docker (shell, `/config.js`, fallback SPA, redirects). **No hay tests unitarios ni E2E** (sin vitest/playwright en `package.json`; Playwright sigue pendiente en vertical-10) **ni pruebas visuales**. No hay Dependabot/Renovate (`.github/` solo tiene `ci.yaml` y `publish.yaml`).

## Decisión (propuesta)

**Hacer la migración ahora, en un único PR pequeño de bump, validado por CI y por una revisión visual manual en TEST antes de publicar release.** Razones:

1. La superficie incompatible real es mínima: **2 archivos** (`UButtonGroup`) + revisión de `UForm` sin nada que cambiar según el grep. No hay Pro, `nullify`, formularios anidados ni transformaciones de schema.
2. v3 no recibe parches desde 2025-10-23 y cada mes de espera acumula más minors (hoy 23) entre las dos versiones, lo que agranda el riesgo oculto (slots/theme) que la guía no cubre.
3. Requisitos ya cumplidos (Nuxt 4.2.2, Tailwind 4, Vue 3.5, zod 3.25 dentro del peer `^3.24 || ^4`).
4. El riesgo principal (regresión visual por `:ui`) es el mismo hoy o en seis meses, pero con más pantallas; es más barato revisarlo ahora.

Condición: no mezclar con otro cambio (ni la estrategia de rendering de ADR LOC-0013 (propuesto en otro PR) ni los tipos generados de ADR LOC-0011) para poder aislar causas y revertir limpio.

## Alternativas

| Opción | Pros | Contras |
|---|---|---|
| **A. Migrar ahora (propuesta)** | Superficie mínima; vuelve a recibir parches; da acceso a los componentes que eran Pro. | Sin red de seguridad automática visual; lockfile hay que regenerarlo sin correr pnpm local (ver Preguntas). |
| B. Diferir (hasta tener E2E/visual) | Menos riesgo de regresión silenciosa si se construyen pruebas primero. | Playwright no tiene fecha; v3 queda sin parches; la brecha crece. |
| C. No migrar (quedarse en 3.3.7 indefinidamente) | Cero esfuerzo. | Sin correcciones ni seguridad de UI/Reka; bloquea futuros upgrades de Nuxt si Nuxt UI exige ≥ cierta versión (no verificado). |
| D. Sustituir librería | — | Rechazada: ya evaluado en [LOC-0001](loc-0001-nuxt-ui-tailwind.md), muy superior en costo. |

## Plan por fases (cada fase = un PR; todo validado solo por CI)

1. **Fase 1 — Bump + renombre (un PR):** `@nuxt/ui` a `^4.0.0` (resolver a la última 4.x), `UButtonGroup` → `UFieldGroup` en los 2 archivos, `tailwindcss`/`@tailwindcss/vite` al mínimo que exija la 4.x resuelta, actualizar `pnpm-lock.yaml`. CI: `typecheck` + `generate` + smoke. Verificar en el CI que `@nuxt/ui/locale` sigue exportando `es`/`en`.
2. **Fase 2 — Revisión visual manual (dueño o equipo) en TEST:** despliegue de la imagen del PR a TEST y recorrido de: login/recuperar clave, dashboard, usuarios/roles, catálogos, un modal con `:ui` (aliados, pagos), `USelectMenu` (el más usado, 237), calendario (`UCalendar`), paginación, tooltips, tema de marca (`app.config.ts`, `@theme`). Lista de comprobación en el PR.
3. **Fase 3 — Correcciones de slot/tema** si aparecen (PR aparte o en el mismo antes de mergear).
4. **Fase 4 — Docs:** enmendar [LOC-0001](loc-0001-nuxt-ui-tailwind.md) y `.ai/` ("Nuxt UI v3" → v4), proponer enmienda al hub ADR 0001 (versiones Nuxt 4 / Nuxt UI v4) y marcar la tarea de vertical-10.

**Pruebas (mientras no haya E2E):** CI (`typecheck`, `generate`, smoke Docker) + revisión visual guiada con checklist. Mejora recomendada, fuera de este ADR: Playwright con capturas de las 5-6 pantallas críticas (tarea ya existente en vertical-10).

**Rollback:** `git revert` del PR de bump (cambios confinados a `package.json`, lockfile y 2 componentes). Si ya se publicó la imagen, redeploy del tag anterior (la imagen es estática y sin estado, [LOC-0006](loc-0006-ci-cd-docker-runtime-config.md)).

## Consecuencias

### Positivas
- Se vuelve a una rama mantenida de Nuxt UI/Reka UI; menor deuda de actualización.
- Componentes antes exclusivos de Pro disponibles sin costo (cumple hub ADR 0004).

### Negativas / a mitigar
- Riesgo de regresión visual silenciosa en overrides `:ui` y tema (mitigado con revisión manual).
- Hay que actualizar la documentación (ADR LOC-0001, `.ai/`, hub ADR 0001).

## Resolución de las preguntas (2026-10-25)

1. **Lockfile:** el dueño ejecuta `pnpm install` en la rama del PR #255 y sube `pnpm-lock.yaml` (no se corre pnpm en local por regla del proyecto).
2. **Revisión visual en TEST:** la hace el dueño con la lista de comprobación del PR #255, antes de publicar el release.
3. **Versión:** se sube a la última 4.x (`^4.11.3`; resuelve 4.12.0). La guía oficial solo cubre 4.0, por eso la revisión visual es obligatoria.
4. **Hub ADR 0001** ("Nuxt 3" / "Nuxt UI v3"): sigue pendiente de enmienda; no se hizo en este cambio.

Verificado al implementar (npm, 4.11.3 y 4.12.0): `@nuxt/ui/locale` sigue exportando; Node requerido `^20.19.0 || >=22.12.0`; tailwind `^4.3.3`, por eso se subió `tailwindcss` en `package.json`. Sin verificar: `useToast` (la guía v4 no lo menciona).
