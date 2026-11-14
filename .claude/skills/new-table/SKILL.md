---
name: new-table
description: Crear un listado o tabla con filtros, búsqueda, orden y paginación contra un endpoint del backend. Usar al construir pantallas de listado.
---
# Nueva tabla

1. Seguir [`.ai/playbooks/new-table.md`](../../../.ai/playbooks/new-table.md) y copiar una tabla vecina con filtros parecidos.
2. Consumir el `*ListItemDto` compacto con `?q=` + RSQL + paginación del backend; búsqueda debounced ([`.ai/specs/14-list-search-debounce.md`](../../../.ai/specs/14-list-search-debounce.md)).
3. Números alineados a la derecha y formateados con `useFormatters()`; columnas `_Display` del backend para FK/enum/fecha.
4. Acciones de fila protegidas con `v-can`; editar abre el formulario que carga el detalle.
5. Spec: `.ai/specs/08-tables.md` (buscar la sección).
