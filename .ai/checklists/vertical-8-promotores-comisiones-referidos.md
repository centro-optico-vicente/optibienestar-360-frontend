# Vista 8 — Promotores, Comisiones y Referidos

> Gestión de promotores, cierre de ciclo de comisiones, portal del promotor y referidos del afiliado. Depende de Pagos.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [ ] [P0/C3] Página `pages/admin/promoters/index.vue` + wizard
- [ ] [P0/C3] Página `pages/admin/commissions/index.vue` (cierre ciclo)

## Portales

- [ ] [P0/C3] Página `pages/promotor/dashboard.vue`
- [ ] [P0/C2] Página `pages/afiliado/referrals.vue`

## Adicionales v2 — Referidos con Metas, Cobranza Delegada y Comisiones Escalonadas

> Equivalente UI del [backend vertical-8 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-8-promotores-comisiones-referidos.md) (ítems PDF #2, #4, #5). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md).

### Referidos con metas (PDF #2)

- [ ] [v2] [P0/C2] Admin: CRUD de programas de referidos `pages/admin/referral-programs/` (`POST /v1/admin/referral-programs`) — meta (`goal_count`), estrategia EXPIRES/ACCUMULATES, vigencia.
- [ ] [v2] [P0/C2] Afiliado (`pages/afiliado/referrals.vue`): progreso hacia la meta + recompensas pendientes (`GET /v1/me/referral-rewards`) + **canje eligiendo el tipo de beneficio al momento** (`POST /v1/me/referral-rewards/{uuid}/claim`).

### Promotores: dashboard + enlace permanente (PDF #4)

- [ ] [v2] [P0/C3] `pages/promotor/dashboard.vue` contra `GET /v1/promoter/me`: afiliados activos, cobranza al-día/vencida (totales + drill-down al afiliado), comisiones del período, posición en leaderboard.
- [ ] [v2] [P0/C2] Mostrar el `referral_code` único del promotor (para compartir; tracking de altas).
- [x] [v2] [P0/C2] Admin: acción "Asignar/Trasladar promotor" (`POST /v1/admin/members/{uuid}/assign-promoter`, permiso `MEMBER_ASSIGN_PROMOTER`) con `reason`. Aclarar en UI que es **enlace permanente** y no retroactivo. _(Implementado 2026-08-07: columna "Promotor" (nombre + link) en `pages/dashboard/members/index.vue`; `components/MemberPromoterCard.vue` en el detalle del afiliado con promotor actual, botón "Cambiar promotor" (selección de promotor destino) o "Vincular por código" (cuando no hay promotor — `assign-promoter` acepta `promoterUuid` XOR `referralCode`), tabla de histórico (`GET .../promoter-history`) y aviso de enlace permanente/no retroactivo. Tipos nuevos en `types/members.ts` (`MemberPromoterAssignmentDto`, `AssignPromoterRequest`); métodos `assignPromoter`/`promoterHistory` en `useMembers.ts`. Junto con esto se agregó soporte de confirmación de afiliado — `components/MemberConfirmationCard.vue` (fecha de creación + confirmación + botón "Confirmar manualmente", `POST .../confirm`, permiso `MEMBER_CONFIRM`), no cubierto por ningún ítem previo de este checklist. `pnpm typecheck` verde.)_

### Cobranza delegada (PDF #2.b)

- [ ] [v2] [P0/C2] En el drill-down de un afiliado del promotor: registrar **recordatorio** (`POST /v1/promoter/me/contacts/{memberUuid}/reminder`) y **promesa de pago** (`.../payment-promise` con monto + fecha).
- [ ] [v2] [P0/C2] Historial de gestiones (`GET /v1/promoter/me/contacts?memberUuid=...`) + **collection-score** (`GET /v1/promoter/me/collection-score`) como indicador % de cartera al día. El promotor solo ve/gestiona sus propios afiliados.

### Comisiones escalonadas y leaderboard (PDF #5)

- [ ] [v2] [P0/C2] Admin: configuración de `commission_tiers` (umbral, % o monto plano, `period_strategy`, `applies_to`) en `pages/admin/commissions/`.
- [ ] [v2] [P0/C2] Página de **leaderboard** (`GET /v1/admin/leaderboard?period=&strategy=`) — top promotores reales (excluye el promotor sistema INSTITUCION), premios top 3. Filtro por estrategia de período.
- [ ] [v2] [P0/C1] El promotor sistema `INSTITUCION` (atribución por defecto) NO aparece en el leaderboard público pero sí en reportes financieros internos del admin — la UI debe respetar ese filtro.

## Adicionales v3 — Escala/cobranza de comisión y salto de mensualidad por referido

> Equivalente UI del [backend vertical-8 §Adicionales v3](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-8-promotores-comisiones-referidos.md) (ítems A/B/C). Mapa: [`../scope-additions-v3.md`](../scope-additions-v3.md) · [ADR 0013](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0013-incentives-engine-v3.md).

- [x] [v3] [P1/C2] Admin (`pages/dashboard/commission-rules/`, ruta reconciliada — no existe árbol `pages/admin/*`): editor de la **escala de comisión por inscripción** (bandas + **bono por escala**) sobre `commission_tiers` + `commission_bonus_rules`, CRUD completo (crear/editar/eliminar/reactivar). _(El backend recalcula; la UI configura y muestra. PR [#56](https://github.com/fenix-core/optibienestar-360-frontend/pull/56), mergeado a `main` 2026-08-06. Backend re-seedeó las bandas reales (0/41/61/76/101 → 25/30/35/35/35%) y los 4 bonos apilables en el PR [#180](https://github.com/fenix-core/optibienestar-360-backend/pull/180) — ya visibles en esta misma UI sin cambios, tiers sin `planType` ya soportados.)_
- [x] [v3] [P1/C2] Admin: editor de **tiers de cobranza** (`collection_commission_tiers`: días → %), pestaña "Comisión de cobranza" en la misma página, con checkbox "Incluir inactivos". _(PR [#56](https://github.com/fenix-core/optibienestar-360-frontend/pull/56).)_ **Pendiente:** campo **día de corte** (`billing_start_day`) en la ficha de la membresía — el enganche backend en `CommissionService` ya se implementó (PR [#179](https://github.com/fenix-core/optibienestar-360-backend/pull/179), default = día de `enrolled_at`), pero el admin todavía no puede **editarlo** en la UI; queda como el único gap de este ítem.
- [x] [v3] [P1/C3] Admin (`pages/dashboard/commissions/`): acción **"Re-ratear cierre de mes"** (`POST /v1/admin/commissions/re-rate`, permiso `COMMISSION_RE_RATE`, backend PR [#180](https://github.com/fenix-core/optibienestar-360-backend/pull/180)) — recalcula retroactivamente las comisiones `INSCRIPTION` PENDING del período a la banda más alta alcanzada por cada promotor. _(Implementado 2026-08-10: `CommissionReRatingModal.vue`, mismo flujo de 2 fases preview/confirmar que `CommissionPayoutModal.vue` (dry-run primero, con desglose por promotor y delta señalizado en verde/rojo). `useCommissions().reRate`, tipos `CommissionReRatingRequest/Response` en `types/promoters.ts`, permiso `COMMISSION_RE_RATE` en `types/permissions.ts`.)_
- [ ] [v3] [P1/C2] Afiliado (`pages/afiliado/referrals.vue`): progreso hacia el **salto de mensualidad** (3 referidos → 1 mes gratis, 9 → 3), con los meses ya ganados (subsidios auto-otorgados, `GET /v1/me/subsidies`) y aviso de que el conteo resetea por mes. _(Reusa la vista de subsidios; ver [vista-12](vertical-12-subsidios-y-exoneraciones.md).)_
