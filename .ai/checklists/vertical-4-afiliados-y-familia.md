# Vista 4 — Afiliados y Familia

> Alta y gestión de afiliados, vista 360°, historia médica (con permiso) y portal del afiliado.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [ ] [P0/C3] Página `pages/admin/members/index.vue` (filtros)
- [ ] [P0/C3] Página `pages/admin/members/new.vue` wizard
- [ ] [P0/C3] Página `pages/admin/members/[id]/index.vue` (vista 360°)
- [ ] [P0/C2] Página `pages/admin/members/[id]/medical-record.vue` (con permiso)

## Portal afiliado

- [ ] [P0/C2] Página `pages/afiliado/dashboard.vue` (carnet + familia + pagos)

## Adicionales v2 — Inclusión y Modificación de Beneficiarios

> Equivalente UI del [backend vertical-4 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-4-afiliados-y-familia.md) (ítem PDF #7). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md). Reemplaza el límite hardcoded "máx 3 beneficiarios" — ahora es por plan.

- [ ] [v2] [P0/C2] Grilla familiar en la vista 360° del afiliado — al agregar beneficiario, mostrar si entra **sin cargo** (dentro de `plan.included_beneficiaries`) o si dispara **cobro de inscripción extra** ($5 según flyer). El backend genera el `payment` extra automáticamente; el front lo refleja.
- [ ] [v2] [P0/C2] Bloquear/avisar al alcanzar el tope duro `plan.max_beneficiaries` (manejar el 422 `member.beneficiary.cap_exceeded` con mensaje claro).
- [ ] [v2] [P0/C2] Columna/indicador `extraInscriptionPaid` por beneficiario (pagó su inscripción extra o pendiente) + link al pago (`inscriptionPaymentUuid`) — extiende el listado de `GET /v1/admin/members/{uuid}/beneficiaries`.
- [ ] [v2] [P0/C2] Eliminar/sustituir beneficiario (`DELETE .../{benUuid}`) con aviso explícito: **no reembolsa inscripción ni cambia la mensualidad del titular** (la mensualidad no depende del conteo de beneficiarios).
- [ ] [v2] [P0/C1] Actualizar el mensaje de validación `members.validations.max_beneficiaries` de [`specs/06-i18n.md`](../specs/06-i18n.md) — hoy dice "Máximo 3 beneficiarios" hardcoded; debe ser parametrizable por plan.
