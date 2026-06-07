# Vista 12 — Subsidios y Exoneraciones (Adicionales v2)

> 🆕 **Vista nueva, parte de Adicionales v2.** Equivalente UI del [backend vertical-12](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/checklists/vertical-12-subsidios-y-exoneraciones.md). Ítem PDF #1 — "Gestión de Subsidios y Exoneraciones".
> Mapa de trazabilidad: [`../scope-additions-v2.md`](../scope-additions-v2.md) · Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)
>
> **Caso de uso (PDF):** controles para omitir o subsidiar el pago de mensualidades a perfiles especiales (fundaciones, iglesias, casos de bajos recursos) manteniendo registro formal en auditoría. UI permission-gated por `SUBSIDY_APPROVE` y `ALLOWS_DISCOUNT`.

## Admin — gestión de subsidios

- [ ] [v2] [P0/C3] Página `pages/admin/subsidies/index.vue` — tabla de subsidios (filtro por afiliado, estado activo/revocado, vigencia) contra `GET /v1/admin/subsidies?memberId=...` (RSQL + paginación). Columnas: afiliado, `percentage` (badge "100% exonerado" vs "X% subsidio"), vigencia (`valid_from`–`valid_until`), autorizó, estado.
- [ ] [v2] [P0/C2] Modal/página `new.vue` — crear subsidio (`POST /v1/admin/subsidies`): selector de afiliado, `percentage` (slider/input 0–100), `reason` **obligatorio**, `valid_from`, `valid_until` (opcional = indefinido). Solo visible/habilitado con permiso `SUBSIDY_APPROVE`.
- [ ] [v2] [P0/C2] Editar subsidio (`PUT /v1/admin/subsidies/{uuid}`) y revocar (`DELETE` soft → `active=false`) con confirmación + `reason`. Gated por `SUBSIDY_APPROVE`.
- [ ] [v2] [P0/C2] Vista de **historial de auditoría** del subsidio (`GET /v1/admin/subsidies/{uuid}/log`) — timeline inmutable CREATED/REVOKED/MODIFIED con actor, fecha, before/after, reason. El PDF exige "registro formal en auditoría".

## Admin — descuentos puntuales (permiso `ALLOWS_DISCOUNT`)

- [ ] [v2] [P0/C2] En la vista de un pago PENDING (vista-6 Pagos), acción "Aplicar descuento" → `POST /v1/admin/payments/{uuid}/discount` con `reason` obligatorio. Distinto de subsidio: aplica a UN pago, no es recurrente. Botón gated por `ALLOWS_DISCOUNT`.

## Portal afiliado — transparencia

- [ ] [v2] [P0/C2] En `pages/afiliado/` mostrar los subsidios activos del titular (`GET /v1/me/subsidies`) — solo lectura, sin edición. Badge "Tu mensualidad está exonerada/subsidiada X%".

## Cambios asociados en otras vistas

> Subsidios no es módulo aislado: afecta cómo se ve la solvencia y los recibos.

- [ ] [v2] [P0/C2] **vista-5 (Membresías)** — el badge de estado debe reflejar `ACTIVE/SOLVENT` por subsidio 100% aunque NO exista pago (el backend lo computa así). Mostrar "Solvente por subsidio" diferenciado de "Solvente por pago" cuando el backend lo exponga.
- [ ] [v2] [P0/C2] **vista-6 (Pagos) / carnet** — los recibos generados muestran "Subsidio aplicado: X%" como línea separada del monto base.

## Pendientes (TBD) — dependen de decisión de negocio

- [ ] [v2] [P0/C1] **TBD:** ¿UI soporta subsidios parciales (X%) o solo exoneración 100%? (la columna `percentage` del backend ya lo permite — alinear con contrato comercial).
- [ ] [v2] [P0/C1] **TBD:** ¿se notifica al titular (in-app/email) cuando se le otorga/revoca un subsidio? — depende del módulo de notificaciones (vista-9).
