# Vista 10 — Optimización, Reportes y QA

> Cross-cutting: performance del SPA, dashboards/reportes y pruebas E2E. Se ejecuta al final, sobre el resto de las vistas.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Optimización

- [ ] [P1/C2] Lazy loading componentes Nuxt pesados (`<LazyComponent>`)
- [ ] [P1/C2] Virtualización tablas grandes

## Reportes

> Diseño congelado en [ADR 0012](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0012-reporting-documents-engine.md) (motor cross-stack) · contrato backend: [spec 15](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/specs/15-reporting-documents.md).
> **Rutas reconciliadas**: este checklist decía `pages/admin/dashboard.vue` / `pages/admin/reports/index.vue`, pero **no existe árbol `pages/admin/*`** — la app usa `pages/dashboard/*` y el nav ya apunta a `/dashboard/reports` (hoy cae en el catch-all "en construcción").
> **Regla dura**: nunca streamear bytes por `useApi` (es JSON-only y `window.open` no manda `Authorization`) — siempre presigned URL + `window.open`, como ya hace `usePayments.supportUrl()` → `viewSupport()`.

- [ ] [P1/C3] Página `pages/dashboard/reports/index.vue` (la ruta del nav ya existe; deja de caer en el catch-all)
- [ ] [P1/C3] KPI cards + gráficos en `pages/dashboard/index.vue` — **reemplazar los mocks actuales** ("Pagos pendientes: 64", "Recaudación: $48,250") por datos reales de `GET /v1/admin/dashboard`. Librería de gráficos: Chart.js o ECharts (ambas OSS) — elección diferida a implementación
- [ ] [P1/C2] `composables/useReports.ts` — `dashboard()`, `memberships()/allies()/commissions()` (KPIs JSON) y `exportReport(type, format)` → `window.open(res.url)` (clonar patrón `usePayments.supportUrl`)
- [ ] [P1/C3] `composables/useDocuments.ts` — `generate(documentType, format, params, delivery)`, `get(uuid)` (polling ante 202 hasta `READY`), `downloadUrl(uuid)` → `window.open`, `list()`, `emailDoc(uuid, …)`
- [ ] [P1/C2] `types/documents.ts` — `DocumentDto`, `DocumentUrlDto` (misma forma que `PaymentSupportUrlDto`), enums `DocumentFormat` (PDF/XLSX/CSV/TICKET_PDF) y `DeliveryMode` (DOWNLOAD/EMAIL_ATTACHMENT/EMAIL_LINK) + helpers de label
- [ ] [P1/C2] Control "Generar documento": selector de **formato** (PDF/XLSX/CSV/Ticket) + **modo de entrega** (Descargar / Enviar adjunto / Enviar enlace). Reusar el patrón de modal existente (`PaymentReviewModal`)
- [ ] [P1/C2] Generación por entidad: botón "Recibo" en `pages/dashboard/payments/[uuid].vue` (PDF/ticket) y planilla en el detalle de afiliado
- [ ] [P1/C1] Cablear el permiso **`REPORT_EXPORT`** (hoy declarado en `types/permissions.ts` y **sin uso en ninguna parte**) a los controles de exportación; sumar los `DOCUMENT_VIEW_ALL`/`VIEW_OWN`/`GENERATE` nuevos al catálogo
- [ ] [P2/C2] "Mis documentos" en el portal del afiliado (`DOCUMENT_VIEW_OWN`) — descargar sus propios recibos/carnet
- [ ] [P2/C2] Filtros rango de fechas con date pickers
- [ ] [P2/C1] Los tickets se imprimen desde el visor de PDF del navegador (v1 = `TICKET_PDF` 58/80 mm). ESC/POS con auto-corte/gaveta queda diferido (requeriría agente local/WebUSB)

## QA

- [ ] [P1/C3] Tests E2E Playwright (flujos críticos: registro afiliado, pago, validador)

## Contrato de tipos con el backend

> Auditoría 2026-07-15: **6 desfases reales** entre los tipos del frontend y lo que el backend manda por el cable (1 corregido, 5 pendientes en los verticales 3 y 4). Diagnóstico del patrón: [`../dto-shape-mismatches.md`](../dto-shape-mismatches.md).
> El denominador común es que los `*Dto` del frontend se escriben a mano, y **TypeScript valida el código contra el tipo, no el tipo contra la realidad** — por eso los 6 pasaron typecheck, build y CI sin ruido.

- [ ] [P1/C3] **Generar los tipos desde el OpenAPI del backend** — `springdoc-openapi` ya está y los controllers declaran su tipo de retorno exacto, así que `/v3/api-docs` es fiel. Generar `app/types/api.d.ts` con `openapi-typescript` convierte cada desfase futuro en error de compilación. Decidir: ¿se genera en CI contra un backend levantado, o se commitea el esquema? Es cambio de tooling → **merece ADR propio**.
- [ ] [P2/C2] Alternativa táctica si no se toma el generador: espejar el cable dividiendo `AllyDto` → `AllyListItemDto` + `AllyDetailDto` y `PublicAllyDto` → `PublicAllyListItemDto` + `PublicAllyDetailDto`. Mata los 5 síntomas pendientes pero no la clase.

## Dependencias

- [ ] [P1/C3] Migrar `@nuxt/ui` v3 → v4: bump del dep + guía de migración oficial + re-testear las vistas ya construidas (login, dashboard, users, roles, catalogs). Tailwind v4 (4.3.0) ya está → prerequisito cubierto. **Hacerlo antes** de construir los verticales 3–10 evita rework y habilita los componentes Pro (tablas/dashboards) gratis.

## Rendering (SSR)

> Solicitado por el equipo: pasar de SPA a Universal Rendering. Hoy es SPA por decisión congelada ([ADR 0003](../decisions/0003-spa-mode.md)); migrar implica superseder ese ADR y rehacer el despliegue de [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md).

- [ ] [P2/C2] Escribir ADR que supersede [ADR 0003](../decisions/0003-spa-mode.md): adoptar Universal Rendering (`ssr: true`) y revisar [ADR 0006](../decisions/0006-ci-cd-docker-runtime-config.md)
- [ ] [P2/C5] Migrar a Universal (`ssr: true`): imagen **Node** en lugar de Nginx estático, reescribir Dockerfiles + smoke tests del CI + wiring Traefik. El env var (`NUXT_PUBLIC_API_BASE_URL`) pasa a leerse nativo en runtime → elimina la inyección por `/config.js`. Manejar cookies/JWT e hidratación server-side.
