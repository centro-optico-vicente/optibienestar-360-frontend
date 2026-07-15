# Vista 4 — Afiliados y Familia

> Alta y gestión de afiliados, vista 360°, historia médica (con permiso) y portal del afiliado.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Bugs verificados — desfases de forma DTO

> Auditados el 2026-07-15 contra los records del backend. Confirmados en la fuente, no son sospechas. Patrón común: [`../dto-shape-mismatches.md`](../dto-shape-mismatches.md).
>
> **`MemberDetailDto` no tiene un campo `beneficiaries`.** Trae `activeBeneficiariesCount` (un entero) y los beneficiarios viven en un sub-recurso dedicado (`GET /v1/admin/members/{uuid}/beneficiaries`). El tipo del frontend declara `beneficiaries?: BeneficiaryDto[]` (`types/members.ts:72`) — y el comentario de cabecera de ese archivo ("el detalle incluye beneficiaries[]") es justamente la mentira que propagó el error.

- [ ] [P0/C1] **El portal del afiliado le dice a un titular familiar que su familia no está cubierta** — `pages/afiliado/index.vue:145,152` lee `member.beneficiaries`, que **nunca llega**, y la página **no tiene ningún fetch de respaldo** (verificado: cero llamadas a `listBeneficiaries`). El panel "Beneficiarios cubiertos" siempre muestra el estado vacío, incluso con beneficiarios cargados en BD. Fix: llamar al sub-recurso desde el portal.
- [ ] [P1/C1] **Pestaña de beneficiarios vacía al cargar el detalle admin** — `pages/dashboard/members/[uuid].vue:57` siembra `beneficiaries.value = member.value.beneficiaries ?? []` → siempre `[]`. El fetch correcto (`loadBeneficiaries()`, línea ~78) **ya existe**, pero `onMounted` (línea ~355) no lo llama: solo se dispara tras crear/editar (líneas ~205 y ~231), así que la pestaña se auto-repara sola al primer cambio. Fix de una línea en `onMounted`.
- [ ] [P1/C1] Corregir `types/members.ts:72` — quitar `beneficiaries?: BeneficiaryDto[]` de `MemberDetailDto` y el comentario de cabecera que lo afirma, para que el tipo deje de certificar un campo inexistente.

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
