# Vista 10 — Optimización, Reportes y QA

> Cross-cutting: performance del SPA, dashboards/reportes y pruebas E2E. Se ejecuta al final, sobre el resto de las vistas.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Optimización

- [ ] [P1/C2] Lazy loading componentes Nuxt pesados (`<LazyComponent>`)
- [ ] [P1/C2] Virtualización tablas grandes

## Reportes

- [ ] [P1/C3] Página `pages/admin/dashboard.vue` con cards KPIs + gráficos (Chart.js o ECharts)
- [ ] [P1/C3] Página `pages/admin/reports/index.vue`
- [ ] [P2/C2] Filtros rango de fechas con date pickers

## QA

- [ ] [P1/C3] Tests E2E Playwright (flujos críticos: registro afiliado, pago, validador)

## Dependencias

- [ ] [P1/C3] Migrar `@nuxt/ui` v3 → v4: bump del dep + guía de migración oficial + re-testear las vistas ya construidas (login, dashboard, users, roles, catalogs). Tailwind v4 (4.3.0) ya está → prerequisito cubierto. **Hacerlo antes** de construir los verticales 3–10 evita rework y habilita los componentes Pro (tablas/dashboards) gratis.

## Rendering (SSR)

> Solicitado por el equipo: pasar de SPA a Universal Rendering. Hoy es SPA por decisión congelada ([ADR 0003](../decisions/0003-spa-mode.md)); migrar implica superseder ese ADR y rehacer el despliegue de [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md).

- [ ] [P2/C2] Escribir ADR que supersede [ADR 0003](../decisions/0003-spa-mode.md): adoptar Universal Rendering (`ssr: true`) y revisar [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md)
- [ ] [P2/C5] Migrar a Universal (`ssr: true`): imagen **Node** en lugar de Nginx estático, reescribir Dockerfiles + smoke tests del CI + wiring Traefik. El env var (`NUXT_PUBLIC_API_BASE_URL`) pasa a leerse nativo en runtime → elimina la inyección por `/config.js`. Manejar cookies/JWT e hidratación server-side.
