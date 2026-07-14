# Vista 5 — Planes y Membresías

> Gestión de planes y vista de detalle de membresía. Depende de Afiliados.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [ ] [P0/C3] Página `pages/admin/plans/index.vue` + `new.vue`
- [ ] [P0/C2] Vista detalle membresía en `pages/admin/members/[id]`

## Adicionales v2 — Planes Familiares, Corporativos y Solvencia con Subsidio

> Equivalente UI del [backend vertical-5 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-5-planes-y-membresias.md) (ítems PDF #3 y #7). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md).
> Tarifas flyer: Individual $10, Familiar $20, Corporativo $5/pers, Afiliado Adicional $5, Mensual $5.

### Planes con tipo y beneficiarios

- [ ] [v2] [P0/C2] Form de plan (`new.vue`) — campos `type` (INDIVIDUAL/FAMILIAR/CORPORATIVO), `included_beneficiaries`, `max_beneficiaries` (vacío = sin tope), `extra_beneficiary_inscription_fee`. Mostrar tipo como badge en el listado.
- [ ] [v2] [P0/C2] Selector de plan en el alta de afiliado refleja inscripción + mensualidad + beneficiarios incluidos según `type` (alimentado por el catálogo de planes).

### Contratos corporativos

- [ ] [v2] [P0/C3] Página `pages/admin/corporate-contracts/` — CRUD de contratos (`POST/GET /v1/admin/corporate-contracts`): institución, RIF, contacto, `payer_mode` (INSTITUTION_BULK/INDIVIDUAL_PAYER), conteo esperado/actual de miembros.
- [ ] [v2] [P0/C2] Alta de miembros en bloque del contrato (`POST .../{uuid}/members`, CSV o lista) + listado de miembros del contrato (`GET .../{uuid}/members`).
- [ ] [v2] [P0/C2] En la facturación, reflejar `payer_mode`: BULK = se cobra al contrato; INDIVIDUAL = se cobra al miembro.

### Solvencia con subsidio (cross-ref vista-12)

- [ ] [v2] [P0/C2] El badge de estado de membresía muestra `ACTIVE/SOLVENT` por **subsidio 100%** aunque no haya pago. Diferenciar visualmente "Solvente por subsidio" vs "Solvente por pago" cuando el backend lo exponga. Ver [vista-12](vertical-12-subsidios-y-exoneraciones.md).

### Pendientes (TBD) — dependen de decisión de negocio

- [ ] [v2] [P0/C1] **TBD:** `max_beneficiaries` real del plan Familiar (flyer no lo aclara — asumimos 5).
- [ ] [v2] [P0/C1] **TBD:** "$5/persona" del Corporativo = mensualidad, inscripción, o ambas; `payer_mode` por contrato o mixto.
- [ ] [v2] [P0/C1] **TBD:** naming "Planes 1+/2+/3+ (Premium)" del PDF vs Individual/Familiar/Corporativo del flyer — define si hace falta un `tier` además del `type` (afecta labels de UI).
