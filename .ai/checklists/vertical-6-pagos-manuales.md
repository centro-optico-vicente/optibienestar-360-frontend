# Vista 6 — Pagos manuales

> Cola de aprobación de pagos, preview de soporte, registro manual y listado en portal afiliado. Depende de Membresías.
> **Estado: entregado en [PR #16](https://github.com/fenix-core/optibienestar-360-frontend/pull/16)** (`feat(payments): dar soporte frontend a pagos manuales`). Consume `/v1/admin/payments` + `/v1/me/payments`. Verde en `nuxt typecheck` + `nuxt build` (Node 20).
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [x] [P0/C3] Cola de pagos `pages/dashboard/payments/index.vue` (pendientes + **filtro por estado** RSQL `status==` + búsqueda free-text + paginación + acciones inline aprobar/rechazar sobre PENDING). _(Ruta bajo `/dashboard`, no `/admin` — el panel no usa el prefijo `/admin`.)_
- [x] [P0/C3] Detalle `pages/dashboard/payments/[uuid].vue` (comprobante vía **URL presignada** `GET …/support` + acciones aprobar/rechazar + revisión/metadatos).
- [x] [P0/C2] Modal "Registrar pago" `components/PaymentFormModal.vue` (cascada afiliado → membresía + **upload de comprobante** multipart). _(Se abre desde la cola; no desde el detalle de membresía — ese vertical aún no está construido.)_
- [x] [P0/C2] Modal aprobar/rechazar `components/PaymentReviewModal.vue` (compartido por cola y detalle; el rechazo exige motivo, la aprobación lleva nota opcional).

## Portal afiliado

- [x] [P0/C2] "Mis pagos" del afiliado `components/MyPaymentsCard.vue`, incrustado en `pages/afiliado/index.vue` (auto-gateado por `PAYMENT_VIEW_OWN`, consume `GET /v1/me/payments`). _(Se entregó como card dentro del portal en vez de una página `pages/afiliado/payments.vue` aparte.)_

## Base entregada (además de las vistas)

- [x] Composables `composables/usePayments.ts` (`list`/`get`/`register` multipart/`approve`/`reject`/`supportUrl`/`mine`) + `composables/useMemberships.ts` (`listForMember`, para el selector del registro).
- [x] Tipos `types/payments.ts` (`PaymentDto`, `PaymentCreate/Approve/Reject`, `PaymentSupportUrlDto`, enums `PaymentMethod`/`PaymentStatus` + helpers de label/color) y `types/memberships.ts` (`MembershipDto`).

## Pendiente / mejoras (no bloqueante)

- [ ] Mostrar el **nombre del afiliado** en la cola (hoy la fila muestra `planCode` + referencia) — requiere ampliar `PaymentDto` en el backend con el nombre del titular.
- [ ] KPI real de **"Pagos pendientes"** en el dashboard (hoy es mock; poblar con `filter=status==PENDING`).
- [ ] **i18n**: extraer los strings del UI de pagos a keys `$t` — registrado en [vertical-11 · Fase 1b](vertical-11-i18n.md).

## Dependencias de permisos

- Registrar un pago exige 3 authorities: `PAYMENT_REGISTER` + `MEMBER_VIEW_ALL` (buscar afiliado) + `MEMBERSHIP_VIEW_ALL` (selector de membresía). El rol ADMIN las tiene.
- Ver comprobante: con R2 deshabilitado en el backend (`storage.r2.enabled=false`, default) el endpoint `…/support` devuelve 422 — el botón queda visible pero la descarga no funciona hasta habilitar R2.
