---
paths:
  - "app/composables/**"
  - "app/stores/**"
  - "app/types/**"
---
# Composables, stores y tipos

- Toda llamada HTTP por `useApi()`; un composable `useX` por recurso con `list/get/create/update/remove` siguiendo a los vecinos (ej. `useBankCatalog.ts`, `useAllies.ts`).
- Listado → `*ListItem` compacto; detalle → `GET /{uuid}`. No mezclar las dos formas en un mismo tipo.
- Tipos de la API: preferir los de `app/types/api.d.ts` (generado, `pnpm api:generate`); buscar con `grep`, no leer entero. Diferencias conocidas en `.ai/dto-shape-mismatches.md`.
- Formateo de fechas/montos con `useFormatters()` (`dd-MM-yyyy`, `es-VE`); no `toLocaleString` suelto.
- Pinia solo para estado compartido entre pantallas (sesión, catálogos cacheados); el resto, estado local.
