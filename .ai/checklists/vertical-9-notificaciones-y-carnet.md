# Vista 9 — Portal afiliado y Carnet digital

> Dashboard del afiliado, carnet digital (`<DigitalCard>`), familia e historial de uso. Depende de Afiliados, Membresías y Pagos.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Portal afiliado

- [ ] [P0/C3] Página `pages/members/index.vue` (dashboard: carnet + estado + accesos)
- [ ] [P0/C3] Componente `<DigitalCard>` (tarjeta crédito + QR + status visual)
- [ ] [P0/C2] Página `pages/members/family.vue`
- [ ] [P0/C2] Página `pages/members/usage-history.vue`
- [ ] [P1/C2] Botón "Compartir carnet" (download PDF/imagen)

## Notificaciones en el sistema ([hub ADR 0039](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0039-in-app-notifications.md))

- [x] [P1/C3] Cliente genérico de notificaciones (`useNotifications`, registro de tipos, toast que se puede cerrar) + aviso al aprobar un aliado o afiliado con permisos nuevos sin volver a iniciar sesión (`approval-watch`) — #373 — 2026-11-14
- [ ] [P2/C2] Campana con contador e historial de notificaciones (fuera de alcance del ADR 0039 por ahora)
