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
- [ ] [v2] [P0/C2] Admin: acción "Asignar/Trasladar promotor" (`POST /v1/admin/members/{uuid}/assign-promoter`, permiso `MEMBER_ASSIGN_PROMOTER`) con `reason`. Aclarar en UI que es **enlace permanente** y no retroactivo.

### Cobranza delegada (PDF #2.b)

- [ ] [v2] [P0/C2] En el drill-down de un afiliado del promotor: registrar **recordatorio** (`POST /v1/promoter/me/contacts/{memberUuid}/reminder`) y **promesa de pago** (`.../payment-promise` con monto + fecha).
- [ ] [v2] [P0/C2] Historial de gestiones (`GET /v1/promoter/me/contacts?memberUuid=...`) + **collection-score** (`GET /v1/promoter/me/collection-score`) como indicador % de cartera al día. El promotor solo ve/gestiona sus propios afiliados.

### Comisiones escalonadas y leaderboard (PDF #5)

- [ ] [v2] [P0/C2] Admin: configuración de `commission_tiers` (umbral, % o monto plano, `period_strategy`, `applies_to`) en `pages/admin/commissions/`.
- [ ] [v2] [P0/C2] Página de **leaderboard** (`GET /v1/admin/leaderboard?period=&strategy=`) — top promotores reales (excluye el promotor sistema INSTITUCION), premios top 3. Filtro por estrategia de período.
- [ ] [v2] [P0/C1] El promotor sistema `INSTITUCION` (atribución por defecto) NO aparece en el leaderboard público pero sí en reportes financieros internos del admin — la UI debe respetar ese filtro.
