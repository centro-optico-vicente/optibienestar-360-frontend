# Checklist frontend (subset del maestro)

> Subset filtrado por tag `[F]` del [checklist maestro](../../centro-optico-vicente/.ai/checklist.md).

## FASE 0 — Bootstrap

- [ ] [P0/C2] Crear estructura `.ai/` en este repo
- [ ] [P1/C1] Instalar skills `nuxt-best-practices` + `tailwind-css` + `accessibility-a11y`

## FASE 1 — Bootstrap frontend Nuxt 3

### Tarea 1.9 — Cimientos

- [ ] [P0/C2] Inicializar Nuxt 3 (`npx nuxi init .`)
- [ ] [P0/C2] Instalar Nuxt UI (`@nuxt/ui` + Tailwind autoincluido)
- [ ] [P0/C2] Instalar módulos: `@pinia/nuxt`, `@vueuse/nuxt`, `@nuxtjs/i18n`, `@nuxt/icon`, `@nuxt/image`
- [ ] [P0/C2] Configurar `nuxt.config.ts` con runtimeConfig (API_BASE_URL)
- [ ] [P0/C2] Tailwind paleta heredada del web (azul, lime) en `tailwind.config.ts`
- [ ] [P0/C2] Importar Manrope desde Google Fonts
- [ ] [P0/C2] `app.vue` + layout `default.vue` con header + sidebar + main
- [ ] [P0/C2] Layout `auth.vue` sin sidebar
- [ ] [P0/C2] Composable `useApi.ts` wrapper $fetch con interceptor JWT
- [ ] [P0/C3] Composable `useAuth.ts` con login/logout/refresh + cookies httpOnly
- [ ] [P0/C2] Store `auth.ts` (Pinia) con user, token, refreshToken, permissions
- [ ] [P0/C2] Middleware `auth.global.ts` (redirect /login si no auth + refresh silencioso)
- [ ] [P0/C2] Middleware `permission.ts` (verifica permission por ruta)
- [ ] [P0/C2] Página `pages/login.vue` + `pages/recover-password.vue`
- [ ] [P0/C2] Página placeholder `pages/index.vue` (redirect según rol)
- [ ] [P0/C2] Configurar i18n con español default
- [ ] [P0/C2] `Dockerfile` multi-stage (Nuxt build + Node Alpine runtime)
- [ ] [P0/C2] GitHub Actions: build + push imagen Docker Hub `fenixcoreenterprises/optisalud-plus-frontend`

## FASE 5 — Vistas por módulo

### Tarea 5.2 — Auth + Users

- [ ] [P0/C2] Página `pages/login.vue` funcional con form + manejo errores
- [ ] [P0/C2] Páginas `pages/recover-password.vue` + `pages/reset-password.vue`
- [ ] [P0/C3] Página `pages/admin/users/index.vue` (listado + filtros) + `[id].vue` (detalle/edición)
- [ ] [P0/C2] Composable `usePermissions()` + directiva `v-permission`
- [ ] [P0/C2] Layout `dashboard.vue` con navegación condicional por rol

### Tarea 5.3 — Aliados

- [ ] [P0/C3] Página `pages/admin/allies/index.vue` (tabla + filtros + búsqueda)
- [ ] [P0/C3] Página `pages/admin/allies/new.vue` + `[id].vue` (wizard multi-step)
- [ ] [P0/C3] Página `pages/aliado/dashboard.vue` (vista del propio aliado)

### Tarea 5.4 — Afiliados

- [ ] [P0/C3] Página `pages/admin/members/index.vue` (filtros)
- [ ] [P0/C3] Página `pages/admin/members/new.vue` wizard
- [ ] [P0/C3] Página `pages/admin/members/[id]/index.vue` (vista 360°)
- [ ] [P0/C2] Página `pages/admin/members/[id]/medical-record.vue` (con permiso)
- [ ] [P0/C2] Página `pages/afiliado/dashboard.vue` (carnet + familia + pagos)

### Tarea 5.5 — Planes y Membresías

- [ ] [P0/C3] Página `pages/admin/plans/index.vue` + `new.vue`
- [ ] [P0/C2] Vista detalle membresía en `pages/admin/members/[id]`

### Tarea 5.6 — Pagos

- [ ] [P0/C3] Página `pages/admin/payments/index.vue` (cola pendientes + filtros)
- [ ] [P0/C3] Página `pages/admin/payments/[id].vue` (preview soporte + acciones)
- [ ] [P0/C2] Modal "Registrar Pago" desde detalle membresía
- [ ] [P0/C2] Listado en portal afiliado `pages/afiliado/payments.vue`

### Tarea 5.7 — Promotores

- [ ] [P0/C3] Página `pages/admin/promoters/index.vue` + wizard
- [ ] [P0/C3] Página `pages/admin/commissions/index.vue` (cierre ciclo)
- [ ] [P0/C3] Página `pages/promotor/dashboard.vue`
- [ ] [P0/C2] Página `pages/afiliado/referrals.vue`

### Tarea 5.8 — Validador

- [ ] [P0/C3] Página `pages/aliado/validator.vue` (input cédula + resultado visual)
- [ ] [P0/C2] Modal "Registrar Uso" (servicio + monto + notas)
- [ ] [P0/C3] Página `pages/aliado/history.vue`
- [ ] [P1/C2] Soporte lector código de barras / QR

### Tarea 5.9 — Portal afiliado

- [ ] [P0/C3] Página `pages/afiliado/index.vue` (dashboard: carnet + estado + accesos)
- [ ] [P0/C3] Componente `<DigitalCard>` (tarjeta crédito + QR + status visual)
- [ ] [P0/C2] Página `pages/afiliado/family.vue`
- [ ] [P0/C2] Página `pages/afiliado/usage-history.vue`
- [ ] [P1/C2] Botón "Compartir carnet" (download PDF/imagen)

### Tarea 5.10 — Optimización

- [ ] [P1/C2] Lazy loading componentes Nuxt pesados (`<LazyComponent>`)
- [ ] [P1/C2] Virtualización tablas grandes

### Tarea 5.11 — Reportes

- [ ] [P1/C3] Página `pages/admin/dashboard.vue` con cards KPIs + gráficos (Chart.js o ECharts)
- [ ] [P1/C3] Página `pages/admin/reports/index.vue`
- [ ] [P2/C2] Filtros rango de fechas con date pickers

### Tarea 5.12 — QA

- [ ] [P1/C3] Tests E2E Playwright (flujos críticos: registro afiliado, pago, validador)

## Notas

- Sincronizar con [checklist maestro](../../centro-optico-vicente/.ai/checklist.md) tag `[F]`.
- Actualizar [`context/current-state.md`](context/current-state.md) tras cada sesión.
