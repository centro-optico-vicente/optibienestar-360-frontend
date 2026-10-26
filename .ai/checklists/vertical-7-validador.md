# Vista 7 — Validador

> Pantalla del aliado para validar afiliados (cédula → resultado visual), registrar uso e historial. Depende de Aliados.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)
>
> **Estado:** núcleo construido. El portal resuelve su `allyUuid` vía `GET /v1/me/allies`
> ([backend #131](https://github.com/fenix-core/optibienestar-360-backend/pull/131)) — antes se pedía
> tecleado a mano. Se cablearon los 3 permisos que estaban declarados sin uso:
> `ALLY_VALIDATE_MEMBER`, `ALLY_REGISTER_USAGE`, `ALLY_VIEW_OWN`.
>
> **Regla dura:** solo `ACTIVE` autoriza aplicar el beneficio. `isValidationActionable()`
> (en `types/validator.ts`) es la única fuente de esa decisión — no duplicar el chequeo
> de status en las páginas.

## Portal aliado

- [x] [P0/C3] Página `pages/allies/validator.vue` (input cédula + resultado visual)
- [x] [P0/C2] Modal "Registrar Uso" (servicio + monto + notas) — `components/BenefitUsageModal.vue`
- [x] [P0/C3] Página `pages/allies/history.vue`
- [ ] [P1/C2] Soporte lector código de barras / QR — el input ya acepta escaneo (un lector teclea + Enter, que ya dispara la validación); falta cámara/QR
- [ ] [P1/C2] Selector de producto o servicio: hoy lee el detalle **público** del aliado (`products`, con fallback al deprecado `services`; un `ALIADO` no tiene `ALLY_PRODUCT_VIEW_ALL`, así que el sub-recurso admin le está cerrado). Solo devuelve ofertas APPROVED+PUBLISHED y da 404 si el aliado no está publicado → degrada a "sin producto". Sin producto, el modal pide la **categoría** (`productCategoryUuid`, obligatoria para el backend). El body usa `allyProductUuid` (hub ADR 0026). Si se necesita el catálogo completo, hace falta un `GET /v1/me/allies/{uuid}/products` en el backend
