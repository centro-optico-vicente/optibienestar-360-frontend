# Vista 3 — Aliados

> Vistas de directorio y gestión de aliados (clínicas, farmacias, ambulancias). Requiere el portal del propio aliado.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [ ] [P0/C3] Página `pages/admin/allies/index.vue` (tabla + filtros + búsqueda)
- [ ] [P0/C3] Página `pages/admin/allies/new.vue` + `[id].vue` (wizard multi-step)

## Portal aliado

- [ ] [P0/C3] Página `pages/aliado/dashboard.vue` (vista del propio aliado)

## Adicionales v2 — Flujo de Aprobación de Servicios

> Equivalente UI del [backend vertical-3 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-3-aliados.md) (ítem PDF #6). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md).

### Portal aliado

- [ ] [v2] [P0/C2] Form "Proponer servicio" en `pages/aliado/` → `POST /v1/aliado/services` (categoría + nombre/desc/precio + `discount_pct` + requiere cita). El servicio entra en `PROPOSED`. Selector de aliado si el usuario pertenece a varios.
- [ ] [v2] [P0/C2] Listado de servicios propios del aliado con **badge de estado** (PROPOSED/IN_REVIEW/APPROVED/REJECTED/REMOVED) y, en REJECTED/REMOVED, el `review_reason`.
- [ ] [v2] [P0/C2] Acción "Retirar servicio" sobre un APPROVED (`DELETE /v1/aliado/services/{uuid}` → transiciona a REMOVED). Solo OWNER/STAFF.
- [ ] [v2] [P0/C2] Vista de historial de revisión del servicio (`GET /v1/aliado/services/{uuid}/log`) — log compartido admin↔aliado.

### Admin — cola de revisión

- [ ] [v2] [P0/C3] Página `pages/admin/ally-services/pending.vue` — cola de revisión (`GET /v1/admin/ally-services/pending`, filtrable por aliado/tipo).
- [ ] [v2] [P0/C2] Acciones aprobar / rechazar / remover (`POST .../{uuid}/approve|reject|remove`) — reject/remove exigen `reason`. Botones gated por permiso `ALLY_SERVICE_APPROVE`.
- [ ] [v2] [P0/C2] Vista de historial de revisión admin (`GET /v1/admin/ally-services/{uuid}/log`) — mismo log que ve el aliado.
- [ ] [v2] [P0/C1] El directorio público (`pages` públicas) solo muestra servicios `APPROVED` (el backend ya filtra; el front no debe asumir otros estados visibles).
