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
